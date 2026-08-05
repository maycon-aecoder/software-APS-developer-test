import { expect, test, vi } from 'vitest';
import { readModelCategoryCandidates } from '../features/aps/analysis/modelCategoryAdapter';

function createModel({ batchSizeEvidence = [], failProperties = false } = {}) {
  const children = new Map([
    [1, [2, 3, 2]],
    [2, [4]],
    [3, []],
    [4, []],
  ]);
  const fragments = new Map([
    [2, [20]],
    [3, []],
    [4, [40]],
  ]);
  const properties = new Map([
    [1, []],
    [2, [{ displayName: 'Category', displayValue: 'Revit Doors' }]],
    [3, [{ displayName: 'Category', displayValue: 'Doors' }]],
    [4, [{ displayName: 'Category', displayValue: 'Furniture' }]],
  ]);
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
      onSuccess(dbIds.map((dbId) => ({
        dbId,
        properties: properties.get(dbId) ?? [],
      })));
    }),
    getObjectTree: vi.fn((onSuccess) => onSuccess(tree)),
  };
}

test('adapts public tree, direct-fragment, and Category property evidence without a leaf assumption', async () => {
  const model = createModel();

  await expect(readModelCategoryCandidates(model, { batchSize: 2 })).resolves.toEqual([
    { dbId: 1, categoryValues: [], childCount: 2, classification: 'excluded' },
    { dbId: 2, categoryValues: ['Revit Doors'], childCount: 1, classification: 'instance' },
    { dbId: 4, categoryValues: ['Furniture'], childCount: 0, classification: 'instance' },
    { dbId: 3, categoryValues: ['Doors'], childCount: 0, classification: 'unknown' },
  ]);
});

test('uses bounded property batches and deduplicates tree callback ids', async () => {
  const batches = [];
  const model = createModel({ batchSizeEvidence: batches });

  await readModelCategoryCandidates(model, { batchSize: 2 });

  expect(batches).toEqual([[1, 2], [4, 3]]);
  expect(batches.every((batch) => batch.length <= 2)).toBe(true);
});

test('maps a public property read failure to a stable category-analysis failure', async () => {
  const model = createModel({ failProperties: true });

  await expect(readModelCategoryCandidates(model, { batchSize: 2 })).rejects.toMatchObject({
    code: 'APS_CATEGORY_ANALYSIS_FAILED',
  });
});

test('fails conservatively when direct instance classification APIs are unavailable', async () => {
  const model = createModel();
  model.getObjectTree = vi.fn((onSuccess) => onSuccess({
    enumNodeChildren: (_dbId, callback) => callback(2),
    getRootId: () => 1,
  }));

  await expect(readModelCategoryCandidates(model)).rejects.toMatchObject({
    code: 'APS_CATEGORY_ANALYSIS_FAILED',
  });
});

test('fails instead of treating an invalid public tree root as an empty model', async () => {
  const model = createModel();
  model.getObjectTree = vi.fn((onSuccess) => onSuccess({
    enumNodeChildren: vi.fn(),
    enumNodeFragments: vi.fn(),
    getRootId: () => undefined,
  }));

  await expect(readModelCategoryCandidates(model)).rejects.toMatchObject({
    code: 'APS_CATEGORY_ANALYSIS_FAILED',
  });
});
