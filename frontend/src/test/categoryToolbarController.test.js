import { expect, test, vi } from 'vitest';
import { createCategoryToolbarController } from '../features/aps/viewer/createCategoryToolbarController';

function createHarness({ toolbarInitiallyAvailable = true } = {}) {
  const controls = [];
  const toolbar = {
    addControl: vi.fn((control) => controls.push(control)),
    removeControl: vi.fn((controlId) => {
      const index = controls.findIndex((control) => control.id === controlId);
      if (index >= 0) controls.splice(index, 1);
    }),
  };

  function Button(id) {
    this.id = id;
    this.container = document.createElement('div');
    this.icon = document.createElement('span');
    this.container.append(this.icon);
    this.setState = vi.fn((state) => {
      this.state = state;
    });
    this.setToolTip = vi.fn((tooltip) => {
      this.tooltip = tooltip;
    });
  }
  Button.State = {
    ACTIVE: 'active',
    DISABLED: 'disabled',
    INACTIVE: 'inactive',
  };

  function ControlGroup(id) {
    this.id = id;
    this.controls = [];
    this.addControl = vi.fn((control) => this.controls.push(control));
    this.removeControl = vi.fn((controlId) => {
      this.controls = this.controls.filter((control) => control.id !== controlId);
    });
  }

  let activeToolbar = toolbarInitiallyAvailable ? toolbar : null;
  const listeners = new Map();
  const viewer = {
    addEventListener: vi.fn((event, listener) => listeners.set(event, listener)),
    clearThemingColors: vi.fn(),
    getToolbar: vi.fn(() => activeToolbar),
    removeEventListener: vi.fn((event, listener) => {
      if (listeners.get(event) === listener) listeners.delete(event);
    }),
    setThemingColor: vi.fn(),
  };
  const viewing = {
    TOOLBAR_CREATED_EVENT: 'toolbar-created',
    UI: { Button, ControlGroup },
  };
  const colors = {
    Doors: { id: 'doors-color' },
    Furniture: { id: 'furniture-color' },
    Walls: { id: 'walls-color' },
  };
  const feedback = [];
  const model = { id: 'active-model' };
  const controller = createCategoryToolbarController({
    colors,
    model,
    onFeedback: (value) => feedback.push(value),
    viewer,
    viewing,
  });

  return {
    colors,
    controller,
    controls,
    feedback,
    listeners,
    model,
    setToolbarAvailable() {
      activeToolbar = toolbar;
      listeners.get('toolbar-created')?.();
    },
    toolbar,
    viewer,
  };
}

function findButton(harness, category) {
  return harness.controls[0]?.controls.find(
    (control) => control.id === `aps-category-${category.toLowerCase()}`,
  );
}

function mountAvailableToolbar(harness) {
  harness.controller.mount();
  expect(harness.controls).toHaveLength(1);
}

test('owns exactly one native group with labeled unavailable controls before category readiness', () => {
  const harness = createHarness();

  harness.controller.mount();
  harness.controller.mount();

  expect(harness.controls).toHaveLength(1);
  expect(harness.controls[0].id).toBe('aps-category-controls');
  expect(harness.controls[0].controls.map((control) => control.id)).toEqual([
    'aps-category-furniture',
    'aps-category-walls',
    'aps-category-doors',
  ]);
  for (const category of ['Furniture', 'Walls', 'Doors']) {
    const button = findButton(harness, category);
    expect(button.state).toBe('disabled');
    expect(button.container.getAttribute('role')).toBe('button');
    expect(button.container.getAttribute('aria-label')).toBe(`Toggle ${category} color`);
    expect(button.container.getAttribute('aria-disabled')).toBe('true');
    expect(button.container.getAttribute('aria-pressed')).toBe('false');
    expect(button.container.tabIndex).toBe(0);
    expect(button.icon.textContent).toBe(category.at(0));
    expect(button.icon.getAttribute('aria-hidden')).toBe('true');
    expect(button.tooltip).toBe(`Toggle ${category} color`);
  }
});

test('waits for the native toolbar event and ignores repeated creation notifications', () => {
  const harness = createHarness({ toolbarInitiallyAvailable: false });

  harness.controller.mount();
  expect(harness.controls).toHaveLength(0);
  expect(harness.viewer.addEventListener).toHaveBeenCalledWith(
    'toolbar-created',
    expect.any(Function),
  );

  harness.setToolbarAvailable();
  harness.setToolbarAvailable();
  expect(harness.controls).toHaveLength(1);
});

test('themes a ready category with its distinct color and active-model argument by keyboard', () => {
  const harness = createHarness();
  mountAvailableToolbar(harness);
  harness.controller.setCategoryReady('Furniture', [5, 6, 5]);
  const furniture = findButton(harness, 'Furniture');

  expect(furniture.state).toBe('inactive');
  expect(furniture.container.getAttribute('aria-disabled')).toBe('false');
  furniture.container.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));

  expect(furniture.state).toBe('active');
  expect(furniture.container.getAttribute('aria-pressed')).toBe('true');
  expect(harness.viewer.setThemingColor.mock.calls).toEqual([
    [5, harness.colors.Furniture, harness.model],
    [6, harness.colors.Furniture, harness.model],
  ]);
});

test('turning one overlapping category off preserves and reapplies the other active category', () => {
  const harness = createHarness();
  mountAvailableToolbar(harness);
  harness.controller.setCategoryReady('Furniture', [1, 2]);
  harness.controller.setCategoryReady('Doors', [2, 3]);
  findButton(harness, 'Furniture').onClick();
  findButton(harness, 'Doors').onClick();
  harness.viewer.setThemingColor.mockClear();

  findButton(harness, 'Furniture').onClick();

  expect(findButton(harness, 'Furniture').state).toBe('inactive');
  expect(findButton(harness, 'Doors').state).toBe('active');
  expect(harness.viewer.setThemingColor.mock.calls).toEqual([
    [1, null, harness.model],
    [2, null, harness.model],
    [2, harness.colors.Doors, harness.model],
    [3, harness.colors.Doors, harness.model],
  ]);
  expect(harness.viewer.clearThemingColors).not.toHaveBeenCalled();
});

test('reports zero matches distinctly while preserving other active controls and theming', () => {
  const harness = createHarness();
  mountAvailableToolbar(harness);
  harness.controller.setCategoryReady('Furniture', [7]);
  harness.controller.setCategoryReady('Walls', []);
  findButton(harness, 'Furniture').onClick();
  harness.viewer.setThemingColor.mockClear();

  findButton(harness, 'Walls').onClick();

  expect(findButton(harness, 'Walls').state).toBe('inactive');
  expect(findButton(harness, 'Furniture').state).toBe('active');
  expect(harness.viewer.setThemingColor).not.toHaveBeenCalled();
  expect(harness.feedback.at(-1)).toEqual({
    category: 'Walls',
    kind: 'no-match',
    message: 'No Walls elements were found in this model.',
  });
});

test('isolates one category-analysis failure and keeps resolved controls usable', () => {
  const harness = createHarness();
  mountAvailableToolbar(harness);
  harness.controller.setCategoryReady('Furniture', [8]);
  harness.controller.setCategoryFailed('Doors');

  expect(findButton(harness, 'Furniture').state).toBe('inactive');
  expect(findButton(harness, 'Doors').state).toBe('disabled');
  findButton(harness, 'Furniture').onClick();
  findButton(harness, 'Doors').onClick();
  expect(findButton(harness, 'Furniture').state).toBe('active');
  expect(harness.viewer.setThemingColor).toHaveBeenCalledTimes(1);
  expect(harness.feedback.at(-1)).toEqual({
    category: 'Doors',
    kind: 'error',
    message: 'Doors could not be analyzed. Retry loading the model or verify its properties.',
  });
});

test('reset clears all feature-owned theming and makes every control unavailable', () => {
  const harness = createHarness();
  mountAvailableToolbar(harness);
  harness.controller.setCategoryReady('Furniture', [1, 2]);
  harness.controller.setCategoryReady('Doors', [2, 3]);
  findButton(harness, 'Furniture').onClick();
  findButton(harness, 'Doors').onClick();
  harness.viewer.setThemingColor.mockClear();

  harness.controller.reset();

  expect(harness.viewer.setThemingColor.mock.calls).toEqual([
    [1, null, harness.model],
    [2, null, harness.model],
    [3, null, harness.model],
  ]);
  expect(harness.controls[0].controls.every((control) => control.state === 'disabled')).toBe(true);
  expect(harness.controller.getSnapshot().categories).toEqual({
    Doors: { active: false, matchCount: 0, status: 'pending' },
    Furniture: { active: false, matchCount: 0, status: 'pending' },
    Walls: { active: false, matchCount: 0, status: 'pending' },
  });
});

test('model replacement retains one toolbar but clears old ids before accepting the new model', () => {
  const harness = createHarness();
  mountAvailableToolbar(harness);
  harness.controller.setCategoryReady('Furniture', [1]);
  findButton(harness, 'Furniture').onClick();
  harness.viewer.setThemingColor.mockClear();
  const replacementModel = { id: 'replacement-model' };

  expect(typeof harness.controller.setModel).toBe('function');
  harness.controller.setModel(replacementModel);

  expect(harness.controls).toHaveLength(1);
  expect(harness.viewer.setThemingColor.mock.calls).toEqual([
    [1, null, harness.model],
  ]);
  expect(harness.controls[0].controls.every((control) => control.state === 'disabled')).toBe(true);

  harness.viewer.setThemingColor.mockClear();
  harness.controller.setCategoryReady('Furniture', [10]);
  findButton(harness, 'Furniture').onClick();
  expect(harness.viewer.setThemingColor.mock.calls).toEqual([
    [10, harness.colors.Furniture, replacementModel],
  ]);
});

test('model replacement disables stale controls and reports a safe error when color cleanup fails', () => {
  const harness = createHarness();
  mountAvailableToolbar(harness);
  harness.controller.setCategoryReady('Furniture', [1]);
  findButton(harness, 'Furniture').onClick();
  harness.viewer.setThemingColor.mockImplementation((_dbId, color) => {
    if (color === null) throw new Error('raw Viewer cleanup failure');
  });
  const replacementModel = { id: 'replacement-model' };

  expect(() => harness.controller.setModel(replacementModel)).not.toThrow();

  expect(harness.controls[0].controls.every((control) => control.state === 'disabled')).toBe(true);
  expect(harness.feedback.at(-1)).toEqual({
    category: 'controls',
    kind: 'error',
    message: 'Category colors could not be updated safely. Retry loading the model.',
  });
  expect(JSON.stringify(harness.feedback)).not.toContain('raw Viewer cleanup failure');

  harness.controller.setCategoryReady('Furniture', [10]);
  findButton(harness, 'Furniture').onClick();
  expect(harness.viewer.setThemingColor).toHaveBeenLastCalledWith(
    10,
    harness.colors.Furniture,
    replacementModel,
  );
});

test('dispose releases toolbar ownership even when active color cleanup fails', () => {
  const harness = createHarness();
  mountAvailableToolbar(harness);
  harness.controller.setCategoryReady('Doors', [9]);
  const staleDoor = findButton(harness, 'Doors');
  staleDoor.onClick();
  harness.viewer.setThemingColor.mockImplementation((_dbId, color) => {
    if (color === null) throw new Error('raw Viewer cleanup failure');
  });

  expect(() => harness.controller.dispose()).not.toThrow();
  staleDoor.onClick();

  expect(harness.toolbar.removeControl).toHaveBeenCalledWith('aps-category-controls');
  expect(harness.controls).toHaveLength(0);
  expect(harness.viewer.setThemingColor).toHaveBeenCalledTimes(2);
});

test('dispose is idempotent, removes native ownership/listeners, and makes stale controls inert', () => {
  const harness = createHarness({ toolbarInitiallyAvailable: false });
  harness.controller.mount();
  harness.setToolbarAvailable();
  expect(harness.controls).toHaveLength(1);
  harness.controller.setCategoryReady('Doors', [9]);
  const staleDoor = findButton(harness, 'Doors');
  staleDoor.onClick();
  harness.viewer.setThemingColor.mockClear();

  harness.controller.dispose();
  harness.controller.dispose();
  staleDoor.onClick();

  expect(harness.viewer.removeEventListener).toHaveBeenCalledTimes(1);
  expect(harness.toolbar.removeControl).toHaveBeenCalledTimes(1);
  expect(harness.viewer.setThemingColor.mock.calls).toEqual([
    [9, null, harness.model],
  ]);
});
