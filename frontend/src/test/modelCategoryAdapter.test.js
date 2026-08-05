import { expect, test, vi } from 'vitest';
import { resolveCategoryInstances } from '../features/aps/analysis/categoryResolver';
import { readModelCategoryCandidates } from '../features/aps/analysis/modelCategoryAdapter';

function createModel({
  batchSizeEvidence = [],
  failProperties = false,
  children = new Map([
    [1, [2, 3, 2]],
    [2, [4]],
    [3, []],
    [4, [5]],
    [5, []],
  ]),
  fragments = new Map([
    [2, [200]],
    [4, [40]],
    [5, [50]],
  ]),
  properties = new Map([
    [4, [{ displayName: 'Category', displayValue: 'Revit Doors' }]],
    [5, [{ displayName: 'Category', displayValue: 'Doors' }]],
  ]),
  names = new Map([
    [1, 'Model'],
    [2, 'Doors (2)'],
    [3, 'Organization'],
    [4, 'Door instance'],
    [5, 'Nested door geometry'],
  ]),
  propertyResult,
} = {}) {
  const tree = {
    enumNodeChildren(dbId, callback, recursive) {
      const direct = children.get(dbId) ?? [];
      for (const child of direct) {
        callback(child);
        if (recursive) this.enumNodeChildren(child, callback, true);
      }
    },
    enumNodeFragments(dbId, callback, recursive) {
      expect(recursive).toBe(false);
      for (const fragmentId of fragments.get(dbId) ?? []) callback(fragmentId);
    },
    getNodeName: (dbId) => names.get(dbId),
    getRootId: () => 1,
  };
  return {
    getBulkProperties2: vi.fn((dbIds, options, onSuccess, onFailure) => {
      batchSizeEvidence.push(dbIds);
      expect(options).toEqual({ ignoreHidden: true, propFilter: ['Category'] });
      if (failProperties) {
        onFailure('raw-property-error');
        return;
      }
      onSuccess(propertyResult ?? dbIds.map((dbId) => ({
        dbId,
        properties: properties.get(dbId) ?? [],
      })));
    }),
    getObjectTree: vi.fn((onSuccess) => onSuccess(tree)),
  };
}

test('selects the first renderable descendant below a shallow Revit category without a leaf assumption', async () => {
  const model = createModel();

  await expect(readModelCategoryCandidates(model, { batchSize: 2 })).resolves.toEqual([
    {
      dbId: 4,
      categoryValues: ['Revit Doors'],
      childCount: 1,
      classification: 'instance',
      expectedCategory: 'Doors',
      parentId: 2,
    },
  ]);
});

test('uses bounded property batches and deduplicates tree callback ids', async () => {
  const batches = [];
  const model = createModel({ batchSizeEvidence: batches });

  await readModelCategoryCandidates(model, { batchSize: 2 });

  expect(batches).toEqual([[4]]);
  expect(batches.every((batch) => batch.length <= 2)).toBe(true);
});

test('maps a public property read failure to a stable category-analysis failure', async () => {
  const model = createModel({ failProperties: true });

  await expect(readModelCategoryCandidates(model, { batchSize: 2 })).rejects.toMatchObject({
    code: 'APS_CATEGORY_ANALYSIS_FAILED',
  });
});

test('rejects a malformed successful property payload instead of reporting zero matches', async () => {
  const model = createModel({ propertyResult: { results: [] } });

  await expect(readModelCategoryCandidates(model)).rejects.toMatchObject({
    code: 'APS_CATEGORY_ANALYSIS_FAILED',
  });
});

test('fails conservatively when direct instance classification APIs are unavailable', async () => {
  const model = createModel();
  model.getObjectTree = vi.fn((onSuccess) => onSuccess({
    enumNodeChildren: (_dbId, callback) => callback(2),
    getNodeName: () => 'Doors',
    getRootId: () => 1,
  }));

  await expect(readModelCategoryCandidates(model)).rejects.toMatchObject({
    code: 'APS_CATEGORY_ANALYSIS_FAILED',
  });
});

test('uses category containers across early organizational levels and stops before nested geometry parts', async () => {
  const model = createModel({
    children: new Map([
      [1, [7]],
      [7, [6]],
      [6, [2, 5]],
      [2, [3, 4]],
      [3, []],
      [4, []],
      [5, []],
    ]),
    fragments: new Map([
      [2, [20]],
      [3, [30]],
      [5, [50]],
    ]),
    properties: new Map([
      [1, []],
      [6, [{ displayName: 'Category', displayValue: 'Doors' }]],
      [2, [{ displayName: 'Category', displayValue: 'Doors' }]],
      [3, [{ displayName: 'Category', displayValue: 'Revit Doors' }]],
      [4, [{ displayName: 'Category', displayValue: 'Doors' }]],
      [5, [{ displayName: 'Category', displayValue: 'Revit Doors' }]],
    ]),
    names: new Map([
      [1, 'Model'],
      [7, 'Discipline organization'],
      [6, 'Doors (2)'],
      [2, 'Door instance A'],
      [3, 'Nested door geometry'],
      [4, 'Door organization'],
      [5, 'Door instance B'],
    ]),
  });

  const candidates = await readModelCategoryCandidates(model);

  expect(resolveCategoryInstances(candidates, 'Doors')).toEqual([2, 5]);
});

test('fails conservatively when a category subtree and element Category property disagree', async () => {
  const model = createModel({
    properties: new Map([
      [4, [{ displayName: 'Category', displayValue: 'Walls' }]],
    ]),
  });

  const candidates = await readModelCategoryCandidates(model);

  expect(() => resolveCategoryInstances(candidates, 'Doors')).toThrow(
    expect.objectContaining({ code: 'APS_CATEGORY_ANALYSIS_FAILED' }),
  );
});

test('does not treat descriptive labels with counts as category containers', async () => {
  const model = createModel({
    names: new Map([
      [1, 'Model'],
      [2, 'Door elements (2)'],
      [3, 'Organization'],
      [4, 'Door instance'],
      [5, 'Nested door geometry'],
    ]),
  });

  await expect(readModelCategoryCandidates(model)).resolves.toEqual([]);
});

test('fails instead of treating an invalid public tree root as an empty model', async () => {
  const model = createModel();
  model.getObjectTree = vi.fn((onSuccess) => onSuccess({
    enumNodeChildren: vi.fn(),
    enumNodeFragments: vi.fn(),
    getNodeName: vi.fn(),
    getRootId: () => undefined,
  }));

  await expect(readModelCategoryCandidates(model)).rejects.toMatchObject({
    code: 'APS_CATEGORY_ANALYSIS_FAILED',
  });
});
