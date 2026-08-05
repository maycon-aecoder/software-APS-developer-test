import { existsSync } from 'node:fs';
import path from 'node:path';
import { expect, test, vi } from 'vitest';

import { createBubbleNode, createDeferred } from './fixtures/viewerDoubles';

const subjectPath = path.resolve(
  process.cwd(),
  'src/features/aps/viewer/createViewerLifecycleCoordinator.js',
);
const subject = existsSync(subjectPath)
  ? await import(/* @vite-ignore */ subjectPath)
  : {
      createViewerLifecycleCoordinator: () => ({
        attachHost() {},
        dispose: async () => {},
        execute: async () => {},
        getSnapshot: () => ({ phase: 'unavailable', message: '' }),
        retry: async () => {},
        subscribe: () => () => {},
      }),
    };

const { createViewerLifecycleCoordinator } = subject;

const baseGenerations = Object.freeze({
  configuration: 1,
  authentication: 1,
  runtime: 1,
  model: 1,
  analysis: 1,
});
const baseCommand = Object.freeze({
  type: 'initialize',
  context: { userId: 'user-a', workspaceId: 'workspace-a' },
  configuration: {
    clientId: 'client-a',
    modelUrn: 'dGVzdC1tb2RlbA',
    hasClientSecret: true,
  },
  generations: baseGenerations,
});

function createHarness({
  documentLoad,
  documentRoot,
  initializer,
  loadAssets,
  loadDocumentNode,
  startResult = 0,
} = {}) {
  const calls = [];
  const viewable = createBubbleNode({ is3D: true, isGeometry: true });
  const documentValue = {
    getRoot: () => documentRoot ?? ({
      getDefaultGeometry: () => viewable,
      getChildren: () => [viewable],
    }),
  };
  let viewerNumber = 0;
  const viewers = [];

  const viewing = {
    Document: {
      load(documentId, onSuccess, onFailure) {
        calls.push(['document-load', documentId]);
        if (documentLoad) return documentLoad({ documentId, onFailure, onSuccess });
        onSuccess(documentValue);
        return undefined;
      },
    },
    GuiViewer3D: function GuiViewer3D(host) {
      const id = ++viewerNumber;
      const viewer = {
        id,
        model: null,
        finish: vi.fn(() => calls.push(['finish', id])),
        loadDocumentNode: vi.fn(async (documentObject, node, options) => {
          calls.push(['load-document-node', id, documentObject, node, options]);
          if (loadDocumentNode) return loadDocumentNode({ documentObject, id, node, options });
          const model = { id: `model-${id}-${calls.length}` };
          viewer.model = model;
          return model;
        }),
        start: vi.fn(() => {
          calls.push(['start', id, host]);
          return startResult;
        }),
        unloadModel: vi.fn((model) => {
          calls.push(['unload-model', id, model]);
          if (viewer.model === model) viewer.model = null;
          return true;
        }),
      };
      viewers.push(viewer);
      calls.push(['viewer-created', id, host]);
      return viewer;
    },
    Initializer: vi.fn((options, callback) => {
      calls.push(['initializer', options]);
      if (initializer) return initializer({ callback, options });
      callback();
      return undefined;
    }),
    shutdown: vi.fn(() => calls.push(['shutdown'])),
  };
  const registrations = [];
  const tokenProvider = {
    clear: vi.fn(() => calls.push(['token-clear'])),
    registerContext: vi.fn((context) => {
      const registration = {
        context,
        getAccessToken: vi.fn(),
        release: vi.fn(() => calls.push(['token-release'])),
      };
      registrations.push(registration);
      calls.push(['token-register', context]);
      return registration;
    }),
  };
  const states = [];
  const coordinator = createViewerLifecycleCoordinator({
    loadAssets: loadAssets ?? vi.fn().mockResolvedValue(viewing),
    onStateChange: (state) => states.push(state),
    tokenProvider,
  });
  coordinator.attachHost({ id: 'viewer-host' });

  return { calls, coordinator, documentValue, registrations, states, tokenProvider, viewable, viewers, viewing };
}

function command(overrides = {}) {
  return {
    ...baseCommand,
    ...overrides,
    context: { ...baseCommand.context, ...overrides.context },
    configuration: { ...baseCommand.configuration, ...overrides.configuration },
    generations: { ...baseCommand.generations, ...overrides.generations },
  };
}

test('initializes one supported runtime, Viewer, token callback, document, and model', async () => {
  const harness = createHarness();

  await harness.coordinator.execute(command());

  expect(harness.viewing.Initializer).toHaveBeenCalledTimes(1);
  const initializerCall = harness.calls.find(([name]) => name === 'initializer');
  expect(initializerCall[1]).toEqual({
    env: 'AutodeskProduction2',
    api: 'streamingV2',
    getAccessToken: harness.registrations[0].getAccessToken,
  });
  expect(harness.registrations[0].context).toMatchObject({
    userId: 'user-a',
    workspaceId: 'workspace-a',
    authenticationGeneration: 1,
    runtimeGeneration: 1,
  });
  expect(harness.viewers).toHaveLength(1);
  expect(harness.calls).toContainEqual(['document-load', 'urn:dGVzdC1tb2RlbA']);
  expect(harness.viewers[0].loadDocumentNode).toHaveBeenCalledWith(
    harness.documentValue,
    harness.viewable,
    { keepCurrentModels: false },
  );
  expect(harness.coordinator.getSnapshot()).toMatchObject({ phase: 'ready' });
});

test('reuses the runtime and Viewer for URN-only replacement while unloading the old model', async () => {
  const harness = createHarness();
  await harness.coordinator.execute(command());
  const oldModel = harness.viewers[0]?.model;

  await harness.coordinator.execute(command({
    type: 'replace-model',
    changeType: 'urn-only',
    configuration: { modelUrn: 'bmV3LW1vZGVs' },
    generations: { configuration: 2, model: 2, analysis: 2 },
  }));

  expect(harness.viewers).toHaveLength(1);
  expect(harness.viewers[0]?.unloadModel).toHaveBeenCalledWith(oldModel);
  expect(harness.calls).toContainEqual(['document-load', 'urn:bmV3LW1vZGVs']);
  expect(harness.viewers[0]?.finish).not.toHaveBeenCalled();
  expect(harness.viewing.shutdown).not.toHaveBeenCalled();
  expect(harness.viewing.Initializer).toHaveBeenCalledTimes(1);
});

test('serially finishes, shuts down, clears, reinitializes, and loads after credential replacement', async () => {
  const harness = createHarness();
  await harness.coordinator.execute(command());
  const oldViewer = harness.viewers[0];

  await harness.coordinator.execute(command({
    type: 'reset-runtime',
    changeType: 'credential-replacement',
    configuration: { clientId: 'client-b', modelUrn: 'bmV3LW1vZGVs' },
    generations: {
      configuration: 2,
      authentication: 2,
      runtime: 2,
      model: 2,
      analysis: 2,
    },
  }));

  const finishIndex = harness.calls.findIndex(([name]) => name === 'finish');
  const shutdownIndex = harness.calls.findIndex(([name]) => name === 'shutdown');
  const secondInitializerIndex = harness.calls.findIndex(
    ([name], index) => name === 'initializer' && index > shutdownIndex,
  );
  const secondViewerIndex = harness.calls.findIndex(
    ([name, id]) => name === 'viewer-created' && id === 2,
  );
  expect(finishIndex).toBeGreaterThan(-1);
  expect(shutdownIndex).toBeGreaterThan(finishIndex);
  expect(secondInitializerIndex).toBeGreaterThan(shutdownIndex);
  expect(secondViewerIndex).toBeGreaterThan(secondInitializerIndex);
  expect(oldViewer.finish).toHaveBeenCalledTimes(1);
  expect(harness.tokenProvider.clear).toHaveBeenCalled();
  expect(harness.viewers).toHaveLength(2);
  expect(harness.registrations[1].context).toMatchObject({
    authenticationGeneration: 2,
    runtimeGeneration: 2,
  });
  expect(harness.calls).toContainEqual(['document-load', 'urn:bmV3LW1vZGVs']);
});

test('skips finish and shutdown for first-save credential initialization with no owned runtime', async () => {
  const harness = createHarness();

  await harness.coordinator.execute(command({
    type: 'reset-runtime',
    changeType: 'credential-replacement',
  }));

  expect(harness.viewing.shutdown).not.toHaveBeenCalled();
  expect(harness.calls.filter(([name]) => name === 'finish')).toEqual([]);
  expect(harness.viewers).toHaveLength(1);
});

test('keeps a usable runtime empty on document failure and retries without shutdown', async () => {
  let attempt = 0;
  const harness = createHarness({
    documentLoad: ({ onFailure, onSuccess }) => {
      attempt += 1;
      if (attempt === 1) onFailure(5, 'raw-upstream-detail');
      else onSuccess(harness.documentValue);
    },
  });

  await harness.coordinator.execute(command());
  expect(harness.coordinator.getSnapshot()).toMatchObject({
    phase: 'load-failed',
    message: 'The configured model could not be opened. Verify its URN, translation, and APS application access, then retry.',
  });
  expect(JSON.stringify(harness.states)).not.toContain('raw-upstream-detail');

  await harness.coordinator.retry();
  expect(harness.coordinator.getSnapshot().phase).toBe('ready');
  expect(harness.viewers).toHaveLength(1);
  expect(harness.viewing.shutdown).not.toHaveBeenCalled();
  expect(harness.calls.filter(([name]) => name === 'initializer')).toHaveLength(1);
});

test('reports missing supported 3D geometry without loading a 2D fallback', async () => {
  const only2D = createBubbleNode({ is3D: false, isGeometry: true });
  const harness = createHarness({
    documentRoot: {
      getDefaultGeometry: () => only2D,
      getChildren: () => [only2D],
    },
  });

  await harness.coordinator.execute(command());

  expect(harness.coordinator.getSnapshot()).toMatchObject({
    phase: 'load-failed',
    message: 'The configured model does not contain a supported 3D view. Choose a translated model with 3D geometry.',
  });
  expect(harness.calls.filter(([name]) => name === 'load-document-node')).toEqual([]);
});

test('reports asset failure safely and retries through a fresh loader attempt', async () => {
  const loadAssets = vi
    .fn()
    .mockRejectedValueOnce(Object.assign(new Error('raw asset failure'), {
      code: 'APS_VIEWER_ASSET_LOAD_FAILED',
    }));
  const harness = createHarness({ loadAssets });
  loadAssets.mockResolvedValueOnce(harness.viewing);

  await harness.coordinator.execute(command());
  expect(harness.coordinator.getSnapshot()).toMatchObject({
    phase: 'load-failed',
    message: 'The 3D viewer files could not be loaded. Check your connection, then retry or reload the page.',
  });
  expect(JSON.stringify(harness.states)).not.toContain('raw asset failure');

  await harness.coordinator.retry();
  expect(loadAssets).toHaveBeenCalledTimes(2);
  expect(harness.coordinator.getSnapshot().phase).toBe('ready');
});

test('publishes only current credential feedback and ignores a prior runtime token error', async () => {
  const harness = createHarness();
  await harness.coordinator.execute(command());
  const oldRegistration = harness.registrations[0];
  await harness.coordinator.execute(command({
    type: 'reset-runtime',
    generations: {
      configuration: 2,
      authentication: 2,
      runtime: 2,
      model: 2,
      analysis: 2,
    },
  }));

  expect(harness.registrations).toHaveLength(2);
  oldRegistration.context.onError({ code: 'APS_CREDENTIALS_REJECTED' });
  expect(harness.coordinator.getSnapshot().phase).toBe('ready');

  harness.registrations[1].context.onError({ code: 'APS_CREDENTIALS_REJECTED' });
  expect(harness.coordinator.getSnapshot()).toMatchObject({
    phase: 'load-failed',
    message: 'APS could not authenticate with the saved Client ID and Client Secret. Verify both values and save them again.',
  });
});

test('cleans partial initialization failure and allows one serialized retry', async () => {
  let attempt = 0;
  const harness = createHarness({
    initializer: ({ callback }) => {
      attempt += 1;
      if (attempt === 1) throw new Error('raw-initializer-detail');
      callback();
    },
  });

  await harness.coordinator.execute(command());
  expect(harness.coordinator.getSnapshot()).toMatchObject({
    phase: 'load-failed',
    message: 'The 3D viewer could not start. Check browser WebGL support, then retry or reload the page.',
  });
  expect(JSON.stringify(harness.states)).not.toContain('raw-initializer-detail');

  await harness.coordinator.retry();
  expect(harness.coordinator.getSnapshot().phase).toBe('ready');
  expect(harness.calls.filter(([name]) => name === 'initializer')).toHaveLength(2);
  expect(harness.viewers).toHaveLength(1);
});

test('finishes a Viewer created during partial startup and shuts down that runtime once', async () => {
  const harness = createHarness({ startResult: 1 });

  await harness.coordinator.execute(command());

  expect(harness.coordinator.getSnapshot().phase).toBe('load-failed');
  expect(harness.viewers).toHaveLength(1);
  expect(harness.viewers[0].finish).toHaveBeenCalledTimes(1);
  expect(harness.viewing.shutdown).toHaveBeenCalledTimes(1);
});

test('keeps a failed credential reset empty and retries without shutting down the cleared runtime twice', async () => {
  let initialization = 0;
  const harness = createHarness({
    initializer: ({ callback }) => {
      initialization += 1;
      if (initialization === 2) throw new Error('controlled reset failure');
      callback();
    },
  });
  await harness.coordinator.execute(command());

  await harness.coordinator.execute(command({
    type: 'reset-runtime',
    changeType: 'credential-replacement',
    generations: {
      configuration: 2,
      authentication: 2,
      runtime: 2,
      model: 2,
      analysis: 2,
    },
  }));

  expect(harness.coordinator.getSnapshot().phase).toBe('load-failed');
  expect(harness.viewers[0].finish).toHaveBeenCalledTimes(1);
  expect(harness.viewing.shutdown).toHaveBeenCalledTimes(1);

  await harness.coordinator.retry();
  expect(harness.coordinator.getSnapshot().phase).toBe('ready');
  expect(harness.viewing.shutdown).toHaveBeenCalledTimes(1);
  expect(harness.viewers).toHaveLength(2);
});

test('coalesces overlapping credential resets so only the newest generation reinitializes', async () => {
  const harness = createHarness();
  await harness.coordinator.execute(command());

  const second = harness.coordinator.execute(command({
    type: 'reset-runtime',
    generations: {
      configuration: 2,
      authentication: 2,
      runtime: 2,
      model: 2,
      analysis: 2,
    },
  }));
  const third = harness.coordinator.execute(command({
    type: 'reset-runtime',
    configuration: { modelUrn: 'bmV3LW1vZGVs' },
    generations: {
      configuration: 3,
      authentication: 3,
      runtime: 3,
      model: 3,
      analysis: 3,
    },
  }));
  await Promise.all([second, third]);

  expect(harness.viewing.Initializer).toHaveBeenCalledTimes(2);
  expect(harness.viewers).toHaveLength(2);
  expect(harness.viewing.shutdown).toHaveBeenCalledTimes(1);
  expect(harness.calls).toContainEqual(['document-load', 'urn:bmV3LW1vZGVs']);
});

test('suppresses stale document success after a newer model generation is requested', async () => {
  const oldDocument = createDeferred();
  const latestDocument = createDeferred();
  let request = 0;
  const harness = createHarness({
    documentLoad: ({ onSuccess }) => {
      request += 1;
      const deferred = request === 1 ? oldDocument : latestDocument;
      void deferred.promise.then(onSuccess);
    },
  });

  const oldExecution = harness.coordinator.execute(command());
  await vi.waitFor(() => expect(request).toBe(1));
  const latestExecution = harness.coordinator.execute(command({
    type: 'replace-model',
    configuration: { modelUrn: 'bmV3LW1vZGVs' },
    generations: { configuration: 2, model: 2, analysis: 2 },
  }));
  oldDocument.resolve(harness.documentValue);
  await oldExecution;
  latestDocument.resolve(harness.documentValue);
  await latestExecution;

  expect(harness.calls.filter(([name]) => name === 'load-document-node')).toHaveLength(1);
  expect(harness.calls).toContainEqual(['document-load', 'urn:bmV3LW1vZGVs']);
  expect(harness.coordinator.getSnapshot()).toMatchObject({ phase: 'ready' });
});

test('unloads a model that resolves after its model generation becomes obsolete', async () => {
  const staleModel = { id: 'stale-model' };
  const staleLoad = createDeferred();
  let modelLoad = 0;
  const harness = createHarness({
    loadDocumentNode: async () => {
      modelLoad += 1;
      if (modelLoad === 1) return { id: 'initial-model' };
      if (modelLoad === 2) return staleLoad.promise;
      return { id: 'latest-model' };
    },
  });
  await harness.coordinator.execute(command());

  const staleExecution = harness.coordinator.execute(command({
    type: 'replace-model',
    configuration: { modelUrn: 'c3RhbGUtbW9kZWw' },
    generations: { configuration: 2, model: 2, analysis: 2 },
  }));
  await vi.waitFor(() => expect(modelLoad).toBe(2));
  const latestExecution = harness.coordinator.execute(command({
    type: 'replace-model',
    configuration: { modelUrn: 'bGF0ZXN0LW1vZGVs' },
    generations: { configuration: 3, model: 3, analysis: 3 },
  }));
  staleLoad.resolve(staleModel);
  await Promise.all([staleExecution, latestExecution]);

  expect(harness.viewers[0].unloadModel).toHaveBeenCalledWith(staleModel);
  expect(harness.coordinator.getSnapshot()).toMatchObject({ phase: 'ready' });
  expect(harness.calls).toContainEqual(['document-load', 'urn:bGF0ZXN0LW1vZGVs']);
});

test('disposes owned Viewer/runtime once across duplicate teardown requests', async () => {
  const harness = createHarness();
  await harness.coordinator.execute(command());

  await Promise.all([harness.coordinator.dispose(), harness.coordinator.dispose()]);

  expect(harness.viewers).toHaveLength(1);
  expect(harness.viewers[0].finish).toHaveBeenCalledTimes(1);
  expect(harness.viewing.shutdown).toHaveBeenCalledTimes(1);
  expect(harness.coordinator.getSnapshot().phase).toBe('idle');
});

test('does not initialize or load without an attached host', async () => {
  const harness = createHarness();
  await harness.coordinator.dispose();

  await harness.coordinator.execute(command({ generations: { runtime: 2, model: 2 } }));

  expect(harness.calls.filter(([name]) => name === 'initializer')).toHaveLength(0);
  expect(harness.calls.filter(([name]) => name === 'document-load')).toHaveLength(0);
  expect(harness.coordinator.getSnapshot()).toMatchObject({
    phase: 'load-failed',
    message: 'The 3D viewer is not available in this workspace. Reload the page and try again.',
  });
});

test('serializes final release before a later host remount initializes again', async () => {
  const harness = createHarness();
  await harness.coordinator.execute(command());
  const release = harness.coordinator.dispose();
  harness.coordinator.attachHost({ id: 'remounted-host' });
  const remount = harness.coordinator.execute(command({
    generations: {
      configuration: 2,
      authentication: 2,
      runtime: 2,
      model: 2,
      analysis: 2,
    },
  }));
  await Promise.all([release, remount]);

  const shutdownIndex = harness.calls.findIndex(([name]) => name === 'shutdown');
  const secondInitializerIndex = harness.calls.findIndex(
    ([name], index) => name === 'initializer' && index > shutdownIndex,
  );
  expect(secondInitializerIndex).toBeGreaterThan(shutdownIndex);
  expect(harness.viewers).toHaveLength(2);
  expect(harness.viewing.shutdown).toHaveBeenCalledTimes(1);
});
