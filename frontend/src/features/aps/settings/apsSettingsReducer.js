const EMPTY_ATTEMPTED = Object.freeze({
  clientId: '',
  clientSecret: '',
  modelUrn: '',
});

const INITIAL_GENERATIONS = Object.freeze({
  configuration: 0,
  authentication: 0,
  runtime: 0,
  model: 0,
  analysis: 0,
});

export function createInitialApsSettingsState() {
  return {
    phase: 'idle',
    context: null,
    attempted: { ...EMPTY_ATTEMPTED },
    committed: null,
    generations: { ...INITIAL_GENERATIONS },
    fieldErrors: {},
    message: '',
  };
}

export function apsSettingsReducer(state, action) {
  switch (action.type) {
    case 'context-loading':
      return {
        ...state,
        phase: 'loading',
        context: action.context,
        attempted: { ...EMPTY_ATTEMPTED },
        committed: null,
        fieldErrors: {},
        message: 'Loading saved APS settings…',
      };
    case 'context-cleared':
      return {
        ...createInitialApsSettingsState(),
        generations: state.generations,
      };
    case 'read-empty':
      return {
        ...state,
        phase: 'empty',
        attempted: { ...EMPTY_ATTEMPTED },
        committed: null,
        fieldErrors: {},
        message: 'Enter your APS application settings to load a model.',
      };
    case 'read-configured':
      return {
        ...state,
        phase: 'ready',
        attempted: {
          clientId: action.configuration.clientId,
          clientSecret: '',
          modelUrn: action.configuration.modelUrn,
        },
        committed: action.configuration,
        generations: action.generations,
        fieldErrors: {},
        message: 'Saved APS settings loaded. Preparing the configured model.',
      };
    case 'read-failed':
      return {
        ...state,
        phase: 'read-error',
        attempted: { ...EMPTY_ATTEMPTED },
        committed: null,
        fieldErrors: {},
        message: action.message,
      };
    case 'field-updated': {
      const fieldErrors = { ...state.fieldErrors };
      delete fieldErrors[action.field];
      return {
        ...state,
        attempted: { ...state.attempted, [action.field]: action.value },
        fieldErrors,
      };
    }
    case 'save-started':
      return {
        ...state,
        phase: 'saving',
        fieldErrors: {},
        message: 'Saving APS settings…',
      };
    case 'save-succeeded':
      return {
        ...state,
        phase: 'ready',
        attempted: action.attempted,
        committed: action.configuration,
        generations: action.generations,
        fieldErrors: {},
        message: action.message,
      };
    case 'save-failed':
      return {
        ...state,
        phase: 'save-error',
        fieldErrors: action.fieldErrors,
        message: action.message,
      };
    default:
      return state;
  }
}
