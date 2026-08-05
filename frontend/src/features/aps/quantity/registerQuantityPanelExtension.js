export const QUANTITY_PANEL_EXTENSION_ID = 'Aps.ModelQuantities';

const CATEGORY_ORDER = Object.freeze(['Doors', 'Windows']);
const GROUP_ID = 'aps-quantity-panel-controls';
const BUTTON_ID = 'aps-quantity-panel-toggle';
const PANEL_ID = 'aps-model-quantities-panel';
const registeredManagers = new WeakSet();

function formatValue(value) {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 6 }).format(value);
}

function formatTotalValue(value) {
  return new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  }).format(value);
}

function formatArea(area) {
  if (area?.status !== 'available') return 'Unavailable';
  const unit = area.unit ? ` ${area.unit}` : '';
  return `${formatValue(area.value)}${unit}`;
}

function formatSummary(category, result) {
  if (!result) return `${category} \u2014 Waiting for analysis`;
  if (result.status === 'failed') return `${category} \u2014 Count unavailable`;
  if (result.status === 'analyzing') {
    return `${category} \u2014 Count ${result.count} \u2014 Calculating total Area\u2026`;
  }

  const area = result.area;
  if (area?.status === 'complete' || area?.status === 'partial') {
    const unit = area.unit ? ` ${area.unit}` : '';
    const suffix = area.status === 'partial' ? ' (partial)' : '';
    return `${category} \u2014 Count ${result.count} \u2014 Total Area ${formatTotalValue(area.total)}${unit}${suffix}`;
  }
  if (area?.status === 'failed') {
    return `${category} \u2014 Count ${result.count} \u2014 Total Area unavailable; retry the model`;
  }
  return `${category} \u2014 Count ${result.count} \u2014 Total Area Unavailable`;
}

function formatSummaryDetails(result) {
  if (!result) return 'Waiting for analysis';
  if (result.status === 'failed') return 'Count unavailable';
  if (result.status === 'analyzing') return `${result.count} elements \u2022 Calculating total area\u2026`;

  const area = result.area;
  if (area?.status === 'complete' || area?.status === 'partial') {
    const unit = area.unit ? ` ${area.unit}` : '';
    const label = area.status === 'partial' ? 'Known area' : 'Total area';
    const suffix = area.status === 'partial' ? ' (partial)' : '';
    return `${result.count} elements \u2022 ${label}: ${formatTotalValue(area.total)}${unit}${suffix}`;
  }
  if (area?.status === 'failed') return `${result.count} elements \u2022 Area unavailable \u2014 reload the model`;
  return `${result.count} elements \u2022 Total area unavailable`;
}

function createTreeRoot(category, result, categoryDbIds = []) {
  return {
    children: result?.status === 'ready'
      ? (result.elements ?? []).map((element, index) => ({
        dbIds: Number.isInteger(categoryDbIds[index]) ? [categoryDbIds[index]] : [],
        id: `${category}-element-${index}`,
        kind: 'element',
        label: `${element.name} \u2014 ${formatArea(element.area)}`,
        primaryLabel: element.name,
        secondaryLabel: `Area: ${formatArea(element.area)}`,
      }))
      : [],
    dbIds: categoryDbIds,
    id: `${category}-root`,
    kind: 'category',
    label: formatSummary(category, result),
    primaryLabel: category,
    secondaryLabel: formatSummaryDetails(result),
  };
}

function createReportRoot(results, categoryDbIds) {
  return {
    children: CATEGORY_ORDER.map((category) => (
      createTreeRoot(category, results[category], categoryDbIds[category])
    )),
    id: 'model-quantities-root',
    kind: 'root',
    label: 'Model quantities',
  };
}

function createExtensionClass(viewing) {
  class QuantityTreeDelegate extends viewing.UI.TreeDelegate {
    constructor(onActivate) {
      super();
      this.icons = new Map();
      this.interactives = new Map();
      this.onActivate = onActivate;
    }

    getTreeNodeId(node) {
      return node.id;
    }

    getTreeNodeLabel(node) {
      return node.label;
    }

    getTreeNodeClass(node) {
      return node.children ? 'aps-quantity-category' : 'aps-quantity-element';
    }

    isTreeNodeGroup(node) {
      return Array.isArray(node.children);
    }

    shouldCreateTreeNode() {
      return true;
    }

    forEachChild(node, callback) {
      for (const child of node.children ?? []) callback(child);
    }

    createTreeNode(node, parent, options, type, depth) {
      const created = super.createTreeNode(node, parent, options, type, depth);
      const interactive = created ?? parent.lastElementChild ?? parent;
      parent.style.boxSizing = 'border-box';
      parent.style.height = 'auto';
      parent.style.minHeight = node.kind === 'element' ? '42px' : '48px';
      parent.style.padding = node.kind === 'element' ? '7px 12px 7px 42px' : '8px 12px 8px 18px';
      interactive.style.boxSizing = 'border-box';
      interactive.style.display = 'block';
      interactive.style.lineHeight = '1.35';
      interactive.style.overflow = 'visible';
      interactive.style.textOverflow = 'clip';
      interactive.style.whiteSpace = 'normal';
      interactive.style.width = '100%';

      if (node.kind === 'root') {
        interactive.hidden = true;
        interactive.style.display = 'none';
        parent.style.display = 'none';
        parent.style.height = '0';
        parent.style.minHeight = '0';
        parent.style.padding = '0';
        return created;
      }

      const icon = parent.querySelector?.('icon');
      if (icon) {
        if (node.kind === 'category') {
          Object.assign(icon.style, {
            display: 'inline-block',
            borderBottom: '4px solid transparent',
            borderLeft: '6px solid #f5f5f5',
            borderRight: '0',
            borderTop: '4px solid transparent',
            height: '0',
            marginRight: '10px',
            padding: '0',
            top: '6px',
            transform: 'rotate(0deg)',
            transformOrigin: '3px 4px',
            transition: 'transform 120ms ease-out',
            verticalAlign: 'top',
            width: '0',
          });
          this.icons.set(node.id, icon);
          interactive.style.display = 'inline-block';
          interactive.style.verticalAlign = 'top';
          interactive.style.width = 'calc(100% - 20px)';
        } else {
          icon.style.display = 'none';
        }
      }

      interactive.replaceChildren();
      const primary = document.createElement('span');
      primary.textContent = node.primaryLabel;
      Object.assign(primary.style, {
        color: '#f5f5f5',
        display: 'block',
        fontSize: node.kind === 'category' ? '14px' : '13px',
        fontWeight: node.kind === 'category' ? '600' : '500',
      });
      const secondary = document.createElement('span');
      secondary.textContent = node.secondaryLabel;
      Object.assign(secondary.style, {
        color: '#c7c7c7',
        display: 'block',
        fontSize: '11px',
        marginTop: '3px',
      });
      interactive.append(primary, secondary);

      interactive.setAttribute('role', 'button');
      interactive.tabIndex = 0;
      interactive.setAttribute('aria-label', node.label);
      if (node.kind === 'category') interactive.setAttribute('aria-expanded', 'false');
      this.interactives.set(node.id, interactive);
      interactive.addEventListener('keydown', (event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        interactive.click();
      });
      return created;
    }

    onTreeNodeClick(tree, node) {
      if (node.kind === 'category') {
        const collapsed = !tree.isCollapsed(node);
        tree.setCollapsed(node, collapsed);
        const icon = this.icons.get(node.id);
        if (icon) icon.style.transform = collapsed ? 'rotate(0deg)' : 'rotate(90deg)';
        this.interactives.get(node.id)?.setAttribute('aria-expanded', String(!collapsed));
      }
      if (node.kind === 'category' || node.kind === 'element') this.onActivate(node);
    }
  }

  class QuantityPanel extends viewing.UI.DockingPanel {
    constructor(viewer, onActivate) {
      super(viewer.container, PANEL_ID, 'Model quantities', {
        addFooter: false,
        dockRight: true,
      });
      this.container.classList.add('property-panel');
      this.container.setAttribute('aria-label', 'Model quantities');
      this.container.dockRight = true;
      Object.assign(this.container.style, {
        height: '420px',
        left: '16px',
        maxHeight: 'calc(100% - 24px)',
        maxWidth: 'calc(100% - 24px)',
        minHeight: '260px',
        minWidth: '340px',
        overflow: 'hidden',
        resize: 'both',
        top: '16px',
        width: '440px',
      });
      this.createScrollContainer({
        heightAdjustment: 70,
        left: false,
        marginTop: 0,
      });
      this.scrollContainer.style.overflow = 'auto';
      this.categoryDbIds = {};
      this.onActivate = onActivate;
      this.results = {};
      this.rebuild();
    }

    rebuild() {
      this.scrollContainer.replaceChildren();
      const root = createReportRoot(this.results, this.categoryDbIds);
      const container = document.createElement('div');
      container.className = 'aps-quantity-tree';
      this.scrollContainer.append(container);
      this.tree = new viewing.UI.Tree(new QuantityTreeDelegate(this.onActivate), root, container, {
        excludeRoot: true,
      });
      for (const categoryRoot of root.children) this.tree.setCollapsed(categoryRoot, true);
    }

    reset() {
      this.categoryDbIds = {};
      this.results = {};
      this.rebuild();
    }

    setCategoryDbIds(category, dbIds) {
      this.categoryDbIds = { ...this.categoryDbIds, [category]: [...dbIds] };
      this.rebuild();
    }

    setQuantityResult(result) {
      this.results = { ...this.results, [result.category]: result };
      this.rebuild();
    }
  }

  return class ModelQuantitiesExtension extends viewing.Extension {
    load() {
      this.disposed = false;
      this.hasActiveIsolation = false;
      this.panel = new QuantityPanel(this.viewer, (node) => this.activateNode(node));
      this.panel.addVisibilityListener((visible) => {
        this.syncButton(visible);
        if (!visible) this.clearPanelIsolation();
      });
      this.installControls = this.installControls.bind(this);
      this.installControls();
      if (!this.group) {
        this.viewer.addEventListener(viewing.TOOLBAR_CREATED_EVENT, this.installControls);
        this.listenerAttached = true;
      }
      return true;
    }

    activateNode(node) {
      if (this.disposed || !Array.isArray(node.dbIds) || node.dbIds.length === 0) return;
      try {
        this.viewer.isolate(node.dbIds);
        this.viewer.fitToView(node.dbIds);
        this.hasActiveIsolation = true;
      } catch {
        this.options.onFeedback?.({
          kind: 'error',
          message: 'The selected model items could not be shown. Reload the model and try again.',
        });
      }
    }

    clearPanelIsolation() {
      if (!this.hasActiveIsolation) return;
      this.hasActiveIsolation = false;
      try {
        this.viewer.isolate([]);
      } catch {
        this.options.onFeedback?.({
          kind: 'error',
          message: 'Model visibility could not be restored. Reload the model and try again.',
        });
      }
    }

    installControls() {
      if (this.disposed || this.group) return;
      const toolbar = this.viewer.getToolbar();
      if (!toolbar) return;
      if (this.listenerAttached) {
        this.viewer.removeEventListener(viewing.TOOLBAR_CREATED_EVENT, this.installControls);
        this.listenerAttached = false;
      }

      this.toolbar = toolbar;
      this.group = new viewing.UI.ControlGroup(GROUP_ID);
      this.button = new viewing.UI.Button(BUTTON_ID);
      const label = 'Show model quantities';
      this.button.setToolTip(label);
      this.button.container.setAttribute('role', 'button');
      this.button.container.setAttribute('aria-label', label);
      this.button.container.setAttribute('aria-pressed', 'false');
      this.button.container.tabIndex = 0;
      if (this.button.icon) {
        this.button.icon.classList.add('adsk-icon-properties');
        this.button.icon.setAttribute('aria-hidden', 'true');
      }
      this.button.onClick = () => this.panel.setVisible(!this.panel.isVisible());
      this.handleKeyDown = (event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        this.button.onClick();
      };
      this.handlePointerClick = (event) => {
        if (event.detail > 0) this.button.container.blur();
      };
      this.button.container.addEventListener('keydown', this.handleKeyDown);
      this.button.container.addEventListener('click', this.handlePointerClick);
      this.group.addControl(this.button);
      this.toolbar.addControl(this.group);
      this.syncButton(false);
    }

    syncButton(visible) {
      if (!this.button) return;
      this.button.setState(visible
        ? viewing.UI.Button.State.ACTIVE
        : viewing.UI.Button.State.INACTIVE);
      this.button.container.setAttribute('aria-pressed', String(visible));
    }

    setQuantityResult(result) {
      if (!this.disposed) this.panel.setQuantityResult(result);
    }

    setCategoryDbIds(category, dbIds) {
      if (!this.disposed) this.panel.setCategoryDbIds(category, dbIds);
    }

    reset() {
      if (!this.disposed) {
        this.clearPanelIsolation();
        this.panel.reset();
      }
    }

    unload() {
      if (this.disposed) return true;
      this.disposed = true;
      if (this.listenerAttached) {
        this.viewer.removeEventListener(viewing.TOOLBAR_CREATED_EVENT, this.installControls);
        this.listenerAttached = false;
      }
      if (this.button) {
        this.button.container.removeEventListener('keydown', this.handleKeyDown);
        this.button.container.removeEventListener('click', this.handlePointerClick);
        this.button.onClick = () => {};
      }
      if (this.toolbar && this.group) this.toolbar.removeControl(this.group.id);
      this.panel.setVisible(false);
      this.panel.uninitialize();
      this.button = null;
      this.group = null;
      this.toolbar = null;
      return true;
    }
  };
}

export async function loadQuantityPanelExtension({ viewer, viewing, onFeedback = () => {} }) {
  const manager = viewing?.theExtensionManager;
  if (!viewer || typeof viewer.loadExtension !== 'function' || !manager) {
    throw Object.assign(new Error('APS quantity panel could not be prepared.'), {
      code: 'APS_QUANTITY_PANEL_SETUP_FAILED',
    });
  }

  try {
    if (!registeredManagers.has(manager)) {
      manager.registerExtension(QUANTITY_PANEL_EXTENSION_ID, createExtensionClass(viewing));
      registeredManagers.add(manager);
    }
    return await viewer.loadExtension(QUANTITY_PANEL_EXTENSION_ID, { onFeedback });
  } catch {
    throw Object.assign(new Error('APS quantity panel could not be prepared.'), {
      code: 'APS_QUANTITY_PANEL_SETUP_FAILED',
    });
  }
}
