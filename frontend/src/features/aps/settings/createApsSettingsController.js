import {
  apsSettingsReducer,
  createInitialApsSettingsState,
} from './apsSettingsReducer';

const EDITABLE_FIELDS = new Set(['clientId', 'clientSecret', 'modelUrn']);
const CHANGE_TYPES = new Set(['urn-only', 'credential-replacement']);
const INVALID_SAVE_RESPONSE_MESSAGE =
  'The saved APS settings response could not be verified. Reload the page and try again.';

function isContextEqual(left, right) {
  return left?.userId === right?.userId && left?.workspaceId === right?.workspaceId;
}

function isSafeConfiguration(configuration) {
  return Boolean(
    configuration
      && typeof configuration.clientId === 'string'
      && typeof configuration.modelUrn === 'string'
      && configuration.hasClientSecret === true,
  );
}

function mapSafeConfiguration(configuration) {
  return {
    clientId: configuration.clientId,
    modelUrn: configuration.modelUrn,
    hasClientSecret: configuration.hasClientSecret,
  };
}

function normalizeFailure(error, fallbackMessage) {
  const response = error?.response?.data;
  const fieldErrors = {};
  if (response?.fieldErrors && typeof response.fieldErrors === 'object') {
    for (const field of EDITABLE_FIELDS) {
      if (typeof response.fieldErrors[field] === 'string') {
        fieldErrors[field] = response.fieldErrors[field];
      }
    }
  }

  return {
    message: typeof response?.message === 'string' && response.message.trim()
      ? response.message
      : fallbackMessage,
    fieldErrors,
  };
}

function advanceAll(generations) {
  return Object.fromEntries(
    Object.entries(generations).map(([name, value]) => [name, value + 1]),
  );
}

function advanceForSave(generations, changeType) {
  if (changeType === 'credential-replacement') return advanceAll(generations);
  return {
    ...generations,
    configuration: generations.configuration + 1,
    model: generations.model + 1,
    analysis: generations.analysis + 1,
  };
}

function reconcileAttempted(current, submitted, configuration) {
  return {
    clientId: current.clientId === submitted.clientId ? configuration.clientId : current.clientId,
    clientSecret: current.clientSecret === submitted.clientSecret ? '' : current.clientSecret,
    modelUrn: current.modelUrn === submitted.modelUrn ? configuration.modelUrn : current.modelUrn,
  };
}

export function createApsSettingsController({ api, onLifecycleCommand = () => {} }) {
  let state = createInitialApsSettingsState();
  let contextRevision = 0;
  let readOperation = 0;
  let saveOperation = 0;
  const listeners = new Set();

  function publish(action) {
    state = apsSettingsReducer(state, action);
    for (const listener of listeners) listener();
  }

  function isCurrent(revision, context) {
    return revision === contextRevision && isContextEqual(context, state.context);
  }

  function startRead(context, revision) {
    const operation = ++readOperation;
    void Promise.resolve()
      .then(() => api.getConfiguration())
      .then((result) => {
        if (!isCurrent(revision, context) || operation !== readOperation) return;

        if (result?.configured === false && result.configuration === null) {
          publish({ type: 'read-empty' });
          return;
        }
        if (result?.configured !== true || !isSafeConfiguration(result.configuration)) {
          publish({
            type: 'read-failed',
            message: 'Saved APS settings could not be verified. Retry loading them.',
          });
          return;
        }

        const configuration = mapSafeConfiguration(result.configuration);
        const generations = advanceAll(state.generations);
        publish({ type: 'read-configured', configuration, generations });
        onLifecycleCommand({
          type: 'initialize',
          context: { ...context },
          configuration,
          generations: { ...generations },
        });
      })
      .catch((error) => {
        if (!isCurrent(revision, context) || operation !== readOperation) return;
        const failure = normalizeFailure(
          error,
          'Saved APS settings could not be loaded. Check your connection and try again.',
        );
        publish({ type: 'read-failed', message: failure.message });
      });
  }

  function activateContext(context) {
    const activeContext = { userId: context.userId, workspaceId: context.workspaceId };
    const revision = ++contextRevision;
    ++saveOperation;
    publish({ type: 'context-loading', context: activeContext });
    startRead(activeContext, revision);
  }

  function retryRead() {
    if (!state.context || state.phase === 'loading') return;
    activateContext(state.context);
  }

  function updateField(field, value) {
    if (!EDITABLE_FIELDS.has(field)) return;
    publish({ type: 'field-updated', field, value });
  }

  async function save() {
    if (
      !state.context
      || state.phase === 'loading'
      || state.phase === 'read-error'
      || state.phase === 'saving'
      || state.phase === 'idle'
    ) {
      return false;
    }

    const context = { ...state.context };
    const revision = contextRevision;
    const operation = ++saveOperation;
    const submitted = { ...state.attempted };
    publish({ type: 'save-started' });

    try {
      const result = await api.saveConfiguration(submitted);
      if (!isCurrent(revision, context) || operation !== saveOperation) return false;
      if (
        result?.configured !== true
        || !isSafeConfiguration(result.configuration)
        || !CHANGE_TYPES.has(result.changeType)
      ) {
        publish({
          type: 'save-failed',
          message: INVALID_SAVE_RESPONSE_MESSAGE,
          fieldErrors: {},
        });
        return false;
      }

      const configuration = mapSafeConfiguration(result.configuration);
      const generations = advanceForSave(state.generations, result.changeType);
      const attempted = reconcileAttempted(state.attempted, submitted, configuration);
      const message = result.changeType === 'urn-only'
        ? 'APS settings saved. Preparing the configured model.'
        : 'APS settings saved. Preparing the configured model with the updated credentials.';
      publish({
        type: 'save-succeeded',
        attempted,
        configuration,
        generations,
        message,
      });
      onLifecycleCommand({
        type: result.changeType === 'urn-only' ? 'replace-model' : 'reset-runtime',
        changeType: result.changeType,
        context,
        configuration,
        generations: { ...generations },
      });
      return true;
    } catch (error) {
      if (!isCurrent(revision, context) || operation !== saveOperation) return false;
      const failure = normalizeFailure(
        error,
        'APS settings were not saved. Check your connection and try again.',
      );
      publish({ type: 'save-failed', ...failure });
      return false;
    }
  }

  function clearContext() {
    ++contextRevision;
    ++readOperation;
    ++saveOperation;
    publish({ type: 'context-cleared' });
  }

  return {
    activateContext,
    clearContext,
    getState: () => state,
    retryRead,
    save,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    updateField,
  };
}
