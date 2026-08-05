export function createDeferred() {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });

  return { promise, reject, resolve };
}

export function createBubbleNode({ children = [], is3D = false, isGeometry = false } = {}) {
  return {
    getChildren: () => children,
    is3D: () => is3D,
    isGeometry: () => isGeometry,
  };
}

export function createPropertyFixture(overrides = {}) {
  return {
    dbId: 1,
    name: 'Test element',
    properties: [],
    ...overrides,
  };
}

export function createToolbarDouble() {
  const controls = new Map();

  return {
    addControl(control) {
      controls.set(control.id, control);
    },
    controls,
    removeControl(controlId) {
      controls.delete(controlId);
    },
  };
}

export function createViewerDouble() {
  const calls = [];

  return {
    calls,
    clearThemingColors() {
      calls.push(['clearThemingColors']);
    },
    finish() {
      calls.push(['finish']);
    },
    loadDocumentNode(document, node, options) {
      calls.push(['loadDocumentNode', document, node, options]);
      return Promise.resolve({ id: 'test-model' });
    },
    setThemingColor(dbId, color, model) {
      calls.push(['setThemingColor', dbId, color, model]);
    },
    unloadModel(model) {
      calls.push(['unloadModel', model]);
      return true;
    },
  };
}
