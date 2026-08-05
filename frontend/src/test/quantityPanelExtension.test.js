import { existsSync } from 'node:fs';
import path from 'node:path';
import { expect, test, vi } from 'vitest';

const subjectPath = path.resolve(
  process.cwd(),
  'src/features/aps/quantity/registerQuantityPanelExtension.js',
);
const subject = existsSync(subjectPath)
  ? await import(/* @vite-ignore */ subjectPath)
  : {
      QUANTITY_PANEL_EXTENSION_ID: 'missing',
      loadQuantityPanelExtension: async () => undefined,
    };
const { QUANTITY_PANEL_EXTENSION_ID, loadQuantityPanelExtension } = subject;

function createHarness() {
  const registered = new Map();
  const toolbarControls = [];
  const trees = [];

  class Extension {
    constructor(viewer, options) {
      this.viewer = viewer;
      this.options = options;
    }
  }

  class DockingPanel {
    constructor(parent, id, title) {
      this.container = document.createElement('section');
      this.container.id = id;
      this.titleLabel = title;
      this.visibilityListeners = [];
      this.visible = false;
      parent.append(this.container);
    }

    addVisibilityListener(listener) {
      this.visibilityListeners.push(listener);
    }

    createScrollContainer() {
      this.scrollContainer = document.createElement('div');
      this.container.append(this.scrollContainer);
      return this.scrollContainer;
    }

    isVisible() {
      return this.visible;
    }

    setVisible(visible) {
      this.visible = visible;
      this.container.hidden = !visible;
      for (const listener of this.visibilityListeners) listener(visible);
    }

    uninitialize() {
      this.container.remove();
    }
  }

  class TreeDelegate {
    createTreeNode(node, parent) {
      const icon = document.createElement('icon');
      const label = document.createElement('label');
      label.textContent = this.getTreeNodeLabel(node);
      parent.append(icon, label);
      return label;
    }
  }

  class Tree {
    constructor(delegate, root, container, options = {}) {
      this.delegate = delegate;
      this.root = root;
      this.collapsed = new Map();
      this.childrenContainers = new Map();
      this.rows = new Map();
      this.labels = [];
      const render = (node, parent, depth = 0) => {
        const row = document.createElement('div');
        parent.append(row);
        this.rows.set(node, row);
        const type = delegate.isTreeNodeGroup(node) ? 'group' : 'leaf';
        const label = delegate.createTreeNode(node, row, {}, type, depth);
        label.addEventListener('click', (event) => delegate.onTreeNodeClick?.(this, node, event));
        this.labels.push(label);
        const children = document.createElement('div');
        parent.append(children);
        this.childrenContainers.set(node, children);
        delegate.forEachChild?.(node, (child) => render(child, children, depth + 1));
      };
      render(root, container);
      if (options.excludeRoot) this.rows.get(root)?.classList.add('exclude');
      trees.push(this);
    }

    isCollapsed(node) {
      return this.collapsed.get(node) ?? false;
    }

    setCollapsed(node, collapsed) {
      this.collapsed.set(node, collapsed);
      const children = this.childrenContainers.get(node);
      if (children) children.hidden = collapsed;
    }
  }

  function Button(id) {
    this.id = id;
    this.container = document.createElement('div');
    this.icon = document.createElement('span');
    this.container.append(this.icon);
    this.setState = vi.fn((state) => { this.state = state; });
    this.setToolTip = vi.fn((tooltip) => { this.tooltip = tooltip; });
    this.container.addEventListener('click', (event) => this.onClick?.(event));
  }
  Button.State = { ACTIVE: 'active', INACTIVE: 'inactive' };

  function ControlGroup(id) {
    this.id = id;
    this.controls = [];
    this.addControl = vi.fn((control) => this.controls.push(control));
  }

  const toolbar = {
    addControl: vi.fn((control) => toolbarControls.push(control)),
    removeControl: vi.fn((id) => {
      const index = toolbarControls.findIndex((control) => control.id === id);
      if (index >= 0) toolbarControls.splice(index, 1);
    }),
  };
  const viewer = {
    addEventListener: vi.fn(),
    container: document.createElement('div'),
    getToolbar: vi.fn(() => toolbar),
    fitToView: vi.fn(),
    isolate: vi.fn(),
    clearThemingColors: vi.fn(),
    loadExtension: vi.fn(async (id, options) => {
      const Constructor = registered.get(id);
      const extension = new Constructor(viewer, options);
      if (!extension.load()) throw new Error('extension load failed');
      return extension;
    }),
    removeEventListener: vi.fn(),
  };
  document.body.append(viewer.container);
  const viewing = {
    Extension,
    TOOLBAR_CREATED_EVENT: 'toolbar-created',
    UI: { Button, ControlGroup, DockingPanel, Tree, TreeDelegate },
    theExtensionManager: {
      registerExtension: vi.fn((id, Constructor) => {
        registered.set(id, Constructor);
        return true;
      }),
    },
  };
  return { registered, toolbar, toolbarControls, trees, viewer, viewing };
}

test('loads one separately owned native quantity command and keeps panel visibility state synchronized', async () => {
  const harness = createHarness();
  const extension = await loadQuantityPanelExtension({
    viewer: harness.viewer,
    viewing: harness.viewing,
  });

  expect(QUANTITY_PANEL_EXTENSION_ID).toBe('Aps.ModelQuantities');
  expect(harness.viewer.loadExtension).toHaveBeenCalledWith(
    'Aps.ModelQuantities',
    expect.any(Object),
  );
  expect(harness.toolbarControls).toHaveLength(1);
  expect(harness.toolbarControls[0].id).not.toBe('aps-category-controls');
  const button = harness.toolbarControls[0].controls[0];
  expect(button.container.getAttribute('aria-label')).toBe('Show model quantities');
  expect(button.container.tabIndex).toBe(0);
  expect(button.state).toBe('inactive');

  button.container.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Enter' }));
  expect(button.state).toBe('active');
  button.container.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: ' ' }));
  expect(button.state).toBe('inactive');
  button.onClick();
  extension.panel.setVisible(false);
  expect(button.state).toBe('inactive');
});

test('renders initially collapsed Door and Window summaries with safe ordered element rows', async () => {
  const harness = createHarness();
  const extension = await loadQuantityPanelExtension({
    viewer: harness.viewer,
    viewing: harness.viewing,
  });

  extension.setQuantityResult({
    area: { status: 'complete', total: 1.5, unit: 'm²' },
    category: 'Doors',
    count: 2,
    elements: [
      { area: { status: 'available', unit: 'm²', value: 1.5 }, name: 'Single Door' },
      { area: { status: 'unavailable' }, name: 'Double Door' },
    ],
    status: 'ready',
  });

  const currentTree = extension.panel.tree;
  expect(currentTree).toBe(harness.trees.at(-1));
  expect(currentTree.root.children.map((root) => currentTree.isCollapsed(root)))
    .toEqual([true, true]);
  const technicalRootLabel = currentTree.labels.find((label) => label.textContent === 'Model quantities');
  expect(technicalRootLabel?.hidden).toBe(true);
  expect(Number.parseInt(extension.panel.container.style.width, 10)).toBeGreaterThanOrEqual(400);
  expect(currentTree.root.children.map((root) => (
    currentTree.childrenContainers.get(root).hidden
  ))).toEqual([true, true]);
  currentTree.delegate.onTreeNodeClick(currentTree, currentTree.root.children[0]);
  expect(currentTree.isCollapsed(currentTree.root.children[0])).toBe(false);
  const doorCategoryLabel = currentTree.labels.find((label) => label.getAttribute('aria-label')?.startsWith('Doors'));
  expect(doorCategoryLabel?.getAttribute('aria-expanded')).toBe('true');
  expect(currentTree.rows.get(currentTree.root.children[0]).querySelector('icon').style.transform)
    .toBe('rotate(90deg)');
  expect(currentTree.childrenContainers.get(currentTree.root.children[0]).textContent)
    .toContain('Single Door');
  const firstElement = currentTree.root.children[0].children[0];
  expect(currentTree.rows.get(firstElement).querySelector('[role="button"]')).toBeTruthy();
  const categoryPadding = Number.parseInt(currentTree.rows.get(currentTree.root.children[0]).style.paddingLeft, 10);
  const elementPadding = Number.parseInt(currentTree.rows.get(firstElement).style.paddingLeft, 10);
  expect(elementPadding).toBeGreaterThan(categoryPadding);
  expect(currentTree.childrenContainers.get(currentTree.root.children[1]).hidden).toBe(true);
  const panelText = extension.panel.container.textContent;
  expect(panelText).toContain('Doors');
  expect(panelText).toContain('2 elements • Total area: 1.50 m²');
  expect(panelText).toContain('Single DoorArea: 1.5 m²');
  expect(panelText).toContain('Double DoorArea: Unavailable');
  expect(panelText).toContain('Windows');
  expect(panelText).not.toMatch(/dbId|secret|raw/i);
});

test('isolates and fits a clicked category or individual element without displaying Viewer ids', async () => {
  const harness = createHarness();
  const onFeedback = vi.fn();
  const extension = await loadQuantityPanelExtension({
    onFeedback,
    viewer: harness.viewer,
    viewing: harness.viewing,
  });
  extension.setCategoryDbIds('Doors', [101, 102]);
  extension.setQuantityResult({
    area: { status: 'unavailable', total: null, unit: null },
    category: 'Doors',
    count: 2,
    elements: [
      { area: { status: 'unavailable' }, name: 'Door A' },
      { area: { status: 'unavailable' }, name: 'Door B' },
    ],
    status: 'ready',
  });
  const tree = extension.panel.tree;
  const doorRoot = tree.root.children[0];

  tree.delegate.onTreeNodeClick(tree, doorRoot);
  tree.delegate.onTreeNodeClick(tree, doorRoot.children[1]);
  extension.panel.setVisible(true);
  extension.panel.setVisible(false);

  expect(harness.viewer.isolate.mock.calls).toEqual([[[101, 102]], [[102]], [[]]]);
  expect(harness.viewer.fitToView.mock.calls).toEqual([[[101, 102]], [[102]]]);
  expect(harness.viewer.clearThemingColors).not.toHaveBeenCalled();
  expect(extension.panel.container.textContent).not.toMatch(/101|102|dbId/i);
  expect(onFeedback).not.toHaveBeenCalled();
});

test('keeps the panel resizable within the Viewer instead of locking its dimensions', async () => {
  const harness = createHarness();
  const extension = await loadQuantityPanelExtension({
    viewer: harness.viewer,
    viewing: harness.viewing,
  });

  expect(extension.panel.container.style.resize).toBe('both');
  expect(extension.panel.container.style.minWidth).toBeTruthy();
  expect(extension.panel.container.style.minHeight).toBeTruthy();
  expect(extension.panel.container.style.maxWidth).toContain('100%');
  expect(extension.panel.container.style.maxHeight).toContain('100%');
});

test.each([
  [
    { area: { status: 'partial', total: 2, unit: 'm\u00B2' }, category: 'Doors', count: 3, elements: [], status: 'ready' },
    'Doors3 elements \u2022 Known area: 2.00 m\u00B2 (partial)',
  ],
  [
    { area: { status: 'unavailable', total: null, unit: null }, category: 'Doors', count: 0, elements: [], status: 'ready' },
    'Doors0 elements \u2022 Total area unavailable',
  ],
  [
    { area: { status: 'failed', total: null, unit: null }, category: 'Windows', count: 2, elements: [], status: 'ready' },
    'Windows2 elements \u2022 Area unavailable \u2014 reload the model',
  ],
  [
    { category: 'Windows', count: null, status: 'failed' },
    'WindowsCount unavailable',
  ],
])('communicates the approved native summary state without internal error codes', async (result, expected) => {
  const harness = createHarness();
  const extension = await loadQuantityPanelExtension({
    viewer: harness.viewer,
    viewing: harness.viewing,
  });

  extension.setQuantityResult(result);

  expect(extension.panel.container.textContent).toContain(expected);
  expect(extension.panel.container.textContent).not.toMatch(/APS_|dbId/i);
});

test('reset and unload remove model data and every feature-owned UI resource idempotently', async () => {
  const harness = createHarness();
  const extension = await loadQuantityPanelExtension({
    viewer: harness.viewer,
    viewing: harness.viewing,
  });
  extension.setQuantityResult({
    area: { status: 'unavailable', total: null, unit: null },
    category: 'Windows',
    count: 1,
    elements: [{ area: { status: 'unavailable' }, name: 'Window A' }],
    status: 'ready',
  });

  extension.reset();
  expect(extension.panel.container.textContent).not.toContain('Window A');
  expect(extension.panel.container.textContent).toContain('Waiting for analysis');
  const panelContainer = extension.panel.container;
  expect(extension.unload()).toBe(true);
  expect(extension.unload()).toBe(true);
  expect(harness.toolbarControls).toEqual([]);
  expect(panelContainer.isConnected).toBe(false);
});
