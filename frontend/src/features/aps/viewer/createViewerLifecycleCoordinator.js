import { toViewerDocumentId } from '../domain/modelUrn';
import { selectSupported3DViewable } from './select3DViewable';

const FAILURE_MESSAGES = Object.freeze({
  APS_CREDENTIALS_REJECTED:
    'APS could not authenticate with the saved Client ID and Client Secret. Verify both values and save them again.',
  APS_VIEWABLE_3D_NOT_FOUND:
    'The configured model does not contain a supported 3D view. Choose a translated model with 3D geometry.',
  APS_VIEWER_ASSET_LOAD_FAILED:
    'The 3D viewer files could not be loaded. Check your connection, then retry or reload the page.',
  APS_VIEWER_HOST_UNAVAILABLE:
    'The 3D viewer is not available in this workspace. Reload the page and try again.',
  APS_VIEWER_INITIALIZATION_FAILED:
    'The 3D viewer could not start. Check browser WebGL support, then retry or reload the page.',
  APS_VIEWER_START_FAILED:
    'The 3D viewer could not start. Check browser WebGL support, then retry or reload the page.',
});

const MODEL_FAILURE_MESSAGE =
  'The configured model could not be opened. Verify its URN, translation, and APS application access, then retry.';
const TOKEN_TEMPORARY_MESSAGE =
  'APS access is temporarily unavailable. Check your connection and retry loading the model.';
const CATEGORY_ANALYSIS_MESSAGE =
  'Some model categories could not be analyzed. Retry loading the model or verify its structure.';
const CATEGORY_CONTROLS_MESSAGE =
  'The model is ready, but category controls could not be prepared. Retry loading the model.';
const SUPPORTED_CATEGORY_RESULTS = new Set(['Furniture', 'Walls', 'Doors', 'Windows']);
const TOOLBAR_CATEGORY_RESULTS = new Set(['Furniture', 'Walls', 'Doors']);

function createFailure(code) {
  return Object.assign(new Error(code), { code });
}

function captureCommand(command, operationId) {
  return {
    operationId,
    type: command.type,
    changeType: command.changeType,
    context: {
      userId: command.context.userId,
      workspaceId: command.context.workspaceId,
    },
    configuration: {
      clientId: command.configuration.clientId,
      modelUrn: command.configuration.modelUrn,
      hasClientSecret: command.configuration.hasClientSecret,
    },
    generations: { ...command.generations },
  };
}

function sameRuntime(left, right) {
  return Boolean(
    left
      && right
      && left.context.userId === right.context.userId
      && left.context.workspaceId === right.context.workspaceId
      && left.generations.authentication === right.generations.authentication
      && left.generations.runtime === right.generations.runtime,
  );
}

function mapFailureMessage(code) {
  if (FAILURE_MESSAGES[code]) return FAILURE_MESSAGES[code];
  if (typeof code === 'string' && code.startsWith('APS_TOKEN_')) return TOKEN_TEMPORARY_MESSAGE;
  if (code === 'APS_CONFIGURATION_REQUIRED') {
    return 'APS settings are incomplete. Verify and save them before retrying the model.';
  }
  return MODEL_FAILURE_MESSAGE;
}

function loadDocument(viewing, documentId) {
  return new Promise((resolve, reject) => {
    try {
      viewing.Document.load(
        documentId,
        resolve,
        () => reject(createFailure('APS_DOCUMENT_LOAD_FAILED')),
      );
    } catch {
      reject(createFailure('APS_DOCUMENT_LOAD_FAILED'));
    }
  });
}

function initializeViewing(viewing, options) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const complete = () => {
      if (!settled) {
        settled = true;
        resolve();
      }
    };
    const fail = () => {
      if (!settled) {
        settled = true;
        reject(createFailure('APS_VIEWER_INITIALIZATION_FAILED'));
      }
    };

    try {
      const result = viewing.Initializer(options, complete);
      if (result && typeof result.then === 'function') result.then(complete, fail);
    } catch {
      fail();
    }
  });
}

export function createViewerLifecycleCoordinator({
  createModelAnalysis,
  createToolbarController,
  loadAssets,
  tokenProvider,
  onStateChange = () => {},
  logger = console,
}) {
  let snapshot = Object.freeze({
    phase: 'idle',
    message: 'Save APS settings to load a 3D model.',
  });
  let host = null;
  let activeCommand = null;
  let operationId = 0;
  let queue = Promise.resolve();
  let viewing = null;
  let runtimeOwned = false;
  let shutdownPending = false;
  let initialization = null;
  let registration = null;
  let viewer = null;
  let model = null;
  let modelAnalysis = null;
  let toolbarController = null;
  const subscribers = new Set();

  function publish(nextSnapshot) {
    snapshot = Object.freeze(nextSnapshot);
    onStateChange(snapshot);
    for (const subscriber of subscribers) subscriber();
  }

  function isOperationCurrent(command) {
    return activeCommand?.operationId === command.operationId;
  }

  function isRuntimeCurrent(command) {
    return sameRuntime(activeCommand, command);
  }

  function schedule(work) {
    const task = queue.catch(() => undefined).then(work);
    queue = task.catch(() => undefined);
    return task;
  }

  function logCategoryCleanupFailure() {
    logger.error('APS category analysis cleanup failed', {
      code: 'APS_CATEGORY_CLEANUP_FAILED',
    });
  }

  function resetModelExperience() {
    const ownedAnalysis = modelAnalysis;
    modelAnalysis = null;
    try {
      ownedAnalysis?.dispose();
    } catch {
      logCategoryCleanupFailure();
    }
    try {
      toolbarController?.setModel(null);
    } catch {
      logCategoryCleanupFailure();
    }
  }

  function disposeToolbar() {
    const ownedToolbar = toolbarController;
    toolbarController = null;
    try {
      ownedToolbar?.dispose();
    } catch {
      logCategoryCleanupFailure();
    }
  }

  function handleToolbarFeedback(controller, feedback) {
    if (controller !== toolbarController || !model) return;
    if (
      typeof feedback?.message !== 'string'
      || (
        !SUPPORTED_CATEGORY_RESULTS.has(feedback.category)
        && !(feedback.category === 'controls' && feedback.kind === 'error')
      )
    ) return;
    publish({
      ...snapshot,
      message: feedback.message,
      tone: feedback.kind === 'error' ? 'error' : 'info',
    });
  }

  function ensureToolbarController() {
    if (toolbarController || !createToolbarController) return true;
    let candidate = null;
    try {
      candidate = createToolbarController({
        viewer,
        viewing,
        onFeedback: (feedback) => handleToolbarFeedback(candidate, feedback),
      });
      toolbarController = candidate;
      candidate.mount();
      return true;
    } catch {
      if (toolbarController === candidate) toolbarController = null;
      try {
        candidate?.dispose();
      } catch {
        logCategoryCleanupFailure();
      }
      logger.error('APS category toolbar setup failed', {
        code: 'APS_CATEGORY_TOOLBAR_SETUP_FAILED',
      });
      return false;
    }
  }

  function publishCategoryResult(command, analysis, result) {
    if (
      analysis !== modelAnalysis
      || !isOperationCurrent(command)
      || !SUPPORTED_CATEGORY_RESULTS.has(result?.category)
      || !['ready', 'failed'].includes(result?.status)
    ) return;
    const safeResult = result.status === 'ready'
      ? {
        category: result.category,
        dbIds: [...new Set((Array.isArray(result.dbIds) ? result.dbIds : []).filter(Number.isInteger))],
        status: 'ready',
      }
      : { category: result.category, status: 'failed' };
    if (TOOLBAR_CATEGORY_RESULTS.has(result.category)) {
      try {
        if (safeResult.status === 'ready') {
          toolbarController?.setCategoryReady(result.category, safeResult.dbIds);
        } else {
          toolbarController?.setCategoryFailed(result.category);
        }
      } catch {
        logger.error('APS category toolbar update failed', {
          code: 'APS_CATEGORY_TOOLBAR_UPDATE_FAILED',
          category: result.category,
        });
        publish({ ...snapshot, message: CATEGORY_CONTROLS_MESSAGE, tone: 'error' });
      }
    }
    publish({
      ...snapshot,
      categories: {
        ...(snapshot.categories ?? {}),
        [result.category]: safeResult,
      },
    });
  }

  function startModelAnalysis(command) {
    if (!createModelAnalysis || !model) return;
    let analysis = null;
    try {
      analysis = createModelAnalysis({
        model,
        onDiagnostic: (diagnostic) => {
          if (analysis !== modelAnalysis || !isOperationCurrent(command)) return;
          const safeDiagnostic = {
            code: 'APS_CATEGORY_ANALYSIS_FAILED',
            stage: diagnostic?.stage === 'resolve' ? 'resolve' : 'read',
          };
          if (SUPPORTED_CATEGORY_RESULTS.has(diagnostic?.category)) {
            safeDiagnostic.category = diagnostic.category;
          }
          logger.error('APS category analysis failed', safeDiagnostic);
        },
        onCategoryResult: (result) => publishCategoryResult(command, analysis, result),
      });
      modelAnalysis = analysis;
      Promise.resolve(analysis.start()).catch(() => {
        if (analysis !== modelAnalysis || !isOperationCurrent(command)) return;
        logger.error('APS category analysis failed', { code: 'APS_CATEGORY_ANALYSIS_FAILED' });
        publish({ ...snapshot, message: CATEGORY_ANALYSIS_MESSAGE, tone: 'error' });
      });
    } catch {
      if (modelAnalysis === analysis) modelAnalysis = null;
      logger.error('APS category analysis failed', { code: 'APS_CATEGORY_ANALYSIS_FAILED' });
      publish({ ...snapshot, message: CATEGORY_ANALYSIS_MESSAGE, tone: 'error' });
    }
  }

  async function teardownRuntime() {
    const ownedViewer = viewer;
    const ownedViewing = viewing;
    const shouldShutdown = runtimeOwned;
    const ownedRegistration = registration;
    viewer = null;
    model = null;
    registration = null;
    initialization = null;
    let cleanupFailed = false;

    resetModelExperience();
    disposeToolbar();

    try {
      ownedRegistration?.release();
    } catch {
      cleanupFailed = true;
    }
    tokenProvider.clear();
    try {
      ownedViewer?.finish();
    } catch {
      cleanupFailed = true;
    }
    if (shouldShutdown && ownedViewing) {
      try {
        await ownedViewing.shutdown();
        runtimeOwned = false;
        shutdownPending = false;
        viewing = null;
      } catch {
        runtimeOwned = true;
        shutdownPending = true;
        viewing = ownedViewing;
        cleanupFailed = true;
      }
    } else {
      runtimeOwned = false;
      shutdownPending = false;
      viewing = null;
    }
    if (cleanupFailed) throw createFailure('APS_VIEWER_TEARDOWN_FAILED');
  }

  function handleTokenError(command, error) {
    if (!isRuntimeCurrent(command)) return;
    const code = typeof error?.code === 'string' ? error.code : 'APS_TOKEN_REQUEST_FAILED';
    publish({ phase: 'load-failed', message: mapFailureMessage(code), code });
  }

  async function ensureRuntime(command) {
    if (viewer) return;
    if (!host) throw createFailure('APS_VIEWER_HOST_UNAVAILABLE');

    viewing = await loadAssets();
    if (!isRuntimeCurrent(command)) return;

    registration = tokenProvider.registerContext({
      userId: command.context.userId,
      workspaceId: command.context.workspaceId,
      authenticationGeneration: command.generations.authentication,
      runtimeGeneration: command.generations.runtime,
      onError: (error) => handleTokenError(command, error),
    });
    const runtimeGeneration = command.generations.runtime;
    const promise = initializeViewing(viewing, {
      env: 'AutodeskProduction2',
      api: 'streamingV2',
      getAccessToken: registration.getAccessToken,
    });
    initialization = { runtimeGeneration, promise };

    try {
      await promise;
      runtimeOwned = true;
      shutdownPending = false;
      if (!isRuntimeCurrent(command)) {
        await teardownRuntime();
        return;
      }

      viewer = new viewing.GuiViewer3D(host);
      const startResult = viewer.start();
      if (typeof startResult === 'number' && startResult !== 0) {
        throw createFailure('APS_VIEWER_START_FAILED');
      }
    } finally {
      if (initialization?.runtimeGeneration === runtimeGeneration) initialization = null;
    }
  }

  async function loadCurrentModel(command) {
    if (!viewer || !viewing || !isOperationCurrent(command)) return;
    resetModelExperience();
    if (model) {
      viewer.unloadModel(model);
      model = null;
    }
    if (!isOperationCurrent(command)) return;
    let toolbarReady = ensureToolbarController();

    const documentObject = await loadDocument(
      viewing,
      toViewerDocumentId(command.configuration.modelUrn),
    );
    if (!isOperationCurrent(command)) return;
    const viewable = selectSupported3DViewable(documentObject.getRoot());
    const loadedModel = await viewer.loadDocumentNode(documentObject, viewable, {
      keepCurrentModels: false,
    });
    if (!isOperationCurrent(command)) {
      viewer.unloadModel(loadedModel);
      return;
    }

    model = loadedModel;
    try {
      toolbarController?.setModel(model);
    } catch {
      logCategoryCleanupFailure();
      toolbarReady = false;
    }
    publish({
      phase: 'ready',
      message: 'The configured 3D model is ready.',
      generations: { ...command.generations },
    });
    if (!toolbarReady) {
      publish({ ...snapshot, message: CATEGORY_CONTROLS_MESSAGE, tone: 'error' });
    }
    startModelAnalysis(command);
  }

  async function perform(command) {
    if (!isOperationCurrent(command)) return;
    publish({ phase: 'loading', message: 'Preparing the configured 3D model…' });

    try {
      if (!host) throw createFailure('APS_VIEWER_HOST_UNAVAILABLE');
      if (command.type === 'reset-runtime') await teardownRuntime();
      if (!isOperationCurrent(command)) return;
      await ensureRuntime(command);
      if (!isOperationCurrent(command)) return;
      await loadCurrentModel(command);
    } catch (error) {
      const code = typeof error?.code === 'string' ? error.code : 'APS_MODEL_LOAD_FAILED';
      if (
        code === 'APS_VIEWER_INITIALIZATION_FAILED'
        || code === 'APS_VIEWER_START_FAILED'
      ) {
        try {
          await teardownRuntime();
        } catch {
          logger.error('APS Viewer cleanup failed', { code: 'APS_VIEWER_TEARDOWN_FAILED' });
        }
      }
      if (!isOperationCurrent(command)) return;
      publish({ phase: 'load-failed', message: mapFailureMessage(code), code });
    }
  }

  function execute(sourceCommand) {
    const command = captureCommand(sourceCommand, ++operationId);
    activeCommand = command;
    return schedule(() => perform(command));
  }

  function retry() {
    if (!activeCommand) return Promise.resolve();
    const retryType = shutdownPending
      ? 'reset-runtime'
      : viewer
        ? 'replace-model'
        : 'initialize';
    return execute({ ...activeCommand, type: retryType });
  }

  function attachHost(nextHost) {
    host = nextHost;
  }

  function dispose() {
    activeCommand = null;
    ++operationId;
    host = null;
    tokenProvider.clear();
    return schedule(async () => {
      try {
        await teardownRuntime();
      } catch {
        logger.error('APS Viewer cleanup failed', { code: 'APS_VIEWER_TEARDOWN_FAILED' });
      }
      if (!activeCommand) {
        publish({ phase: 'idle', message: 'Save APS settings to load a 3D model.' });
      }
    });
  }

  return Object.freeze({
    attachHost,
    dispose,
    execute,
    getSnapshot: () => snapshot,
    retry,
    subscribe(subscriber) {
      subscribers.add(subscriber);
      return () => subscribers.delete(subscriber);
    },
  });
}
