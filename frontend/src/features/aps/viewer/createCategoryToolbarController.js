const TOOLBAR_CATEGORIES = Object.freeze(['Furniture', 'Walls', 'Doors']);
const GROUP_ID = 'aps-category-controls';

function createInitialCategoryState() {
  return {
    active: false,
    dbIds: [],
    status: 'pending',
  };
}

function uniqueDbIds(dbIds) {
  return [...new Set((Array.isArray(dbIds) ? dbIds : []).filter(Number.isInteger))];
}

export function createCategoryToolbarController({
  colors,
  model,
  onFeedback = () => {},
  viewer,
  viewing,
}) {
  const categories = Object.fromEntries(
    TOOLBAR_CATEGORIES.map((category) => [category, createInitialCategoryState()]),
  );
  const buttons = new Map();
  let disposed = false;
  let group = null;
  let listenerAttached = false;
  let mounted = false;
  let toolbar = null;

  function syncButton(category) {
    const button = buttons.get(category);
    if (!button) return;
    const categoryState = categories[category];
    const available = categoryState.status === 'ready';
    const state = !available
      ? viewing.UI.Button.State.DISABLED
      : categoryState.active
        ? viewing.UI.Button.State.ACTIVE
        : viewing.UI.Button.State.INACTIVE;
    button.setState(state);
    button.container.setAttribute('aria-disabled', String(!available));
    button.container.setAttribute('aria-pressed', String(categoryState.active));
  }

  function applyCategory(category) {
    const categoryState = categories[category];
    for (const dbId of categoryState.dbIds) {
      viewer.setThemingColor(dbId, colors[category], model);
    }
  }

  function clearIds(dbIds) {
    for (const dbId of dbIds) viewer.setThemingColor(dbId, null, model);
  }

  function rebuildActiveCategories() {
    for (const category of TOOLBAR_CATEGORIES) {
      if (categories[category].active) applyCategory(category);
    }
  }

  function toggle(category) {
    if (disposed) return;
    const categoryState = categories[category];
    if (categoryState.status !== 'ready') return;
    if (categoryState.dbIds.length === 0) {
      categoryState.active = false;
      syncButton(category);
      onFeedback({
        category,
        kind: 'no-match',
        message: `No ${category} elements were found in this model.`,
      });
      return;
    }

    if (categoryState.active) {
      categoryState.active = false;
      clearIds(categoryState.dbIds);
      rebuildActiveCategories();
    } else {
      categoryState.active = true;
      applyCategory(category);
    }
    syncButton(category);
  }

  function createButton(category) {
    const button = new viewing.UI.Button(`aps-category-${category.toLowerCase()}`);
    const label = `Toggle ${category} color`;
    button.setToolTip(label);
    button.container.setAttribute('role', 'button');
    button.container.setAttribute('aria-label', label);
    button.container.tabIndex = 0;
    button.onClick = () => toggle(category);
    const handleKeyDown = (event) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      button.onClick();
    };
    button.container.addEventListener('keydown', handleKeyDown);
    button.releaseKeyboard = () => button.container.removeEventListener('keydown', handleKeyDown);
    buttons.set(category, button);
    syncButton(category);
    return button;
  }

  function removeToolbarListener() {
    if (!listenerAttached) return;
    viewer.removeEventListener(viewing.TOOLBAR_CREATED_EVENT, installControls);
    listenerAttached = false;
  }

  function installControls() {
    if (disposed || group) return;
    toolbar = viewer.getToolbar();
    if (!toolbar) return;
    removeToolbarListener();
    group = new viewing.UI.ControlGroup(GROUP_ID);
    for (const category of TOOLBAR_CATEGORIES) group.addControl(createButton(category));
    toolbar.addControl(group);
  }

  function mount() {
    if (disposed || mounted) return;
    mounted = true;
    installControls();
    if (!group && !listenerAttached) {
      viewer.addEventListener(viewing.TOOLBAR_CREATED_EVENT, installControls);
      listenerAttached = true;
    }
  }

  function setCategoryReady(category, dbIds) {
    if (disposed || !Object.prototype.hasOwnProperty.call(categories, category)) return;
    const categoryState = categories[category];
    if (categoryState.active) {
      clearIds(categoryState.dbIds);
      categoryState.active = false;
      rebuildActiveCategories();
    }
    categoryState.dbIds = uniqueDbIds(dbIds);
    categoryState.status = 'ready';
    syncButton(category);
  }

  function setCategoryFailed(category) {
    if (disposed || !Object.prototype.hasOwnProperty.call(categories, category)) return;
    const categoryState = categories[category];
    if (categoryState.active) {
      clearIds(categoryState.dbIds);
      categoryState.active = false;
      rebuildActiveCategories();
    }
    categoryState.dbIds = [];
    categoryState.status = 'failed';
    syncButton(category);
    onFeedback({
      category,
      kind: 'error',
      message: `${category} could not be analyzed. Retry loading the model or verify its properties.`,
    });
  }

  function reset() {
    const themedIds = new Set();
    for (const category of TOOLBAR_CATEGORIES) {
      const categoryState = categories[category];
      if (categoryState.active) {
        for (const dbId of categoryState.dbIds) themedIds.add(dbId);
      }
    }
    clearIds(themedIds);
    for (const category of TOOLBAR_CATEGORIES) {
      categories[category] = createInitialCategoryState();
      syncButton(category);
    }
  }

  function dispose() {
    if (disposed) return;
    reset();
    removeToolbarListener();
    for (const button of buttons.values()) {
      button.releaseKeyboard?.();
      button.onClick = () => {};
    }
    if (toolbar && group) toolbar.removeControl(group.id);
    buttons.clear();
    group = null;
    toolbar = null;
    disposed = true;
  }

  function getSnapshot() {
    return {
      categories: Object.fromEntries(
        TOOLBAR_CATEGORIES.map((category) => [category, {
          active: categories[category].active,
          matchCount: categories[category].dbIds.length,
          status: categories[category].status,
        }]),
      ),
    };
  }

  return Object.freeze({
    dispose,
    getSnapshot,
    mount,
    reset,
    setCategoryFailed,
    setCategoryReady,
  });
}
