import { expect, test, vi } from 'vitest';
import { resolveCategoryInstances } from '../features/aps/analysis/categoryResolver';
import { readModelCategoryCandidates } from '../features/aps/analysis/modelCategoryAdapter';

function createModel({
  children = new Map([
    [1, [2, 3]],
    [2, [4]],
    [3, []],
    [4, [5]],
    [5, []],
  ]),
  failTree = false,
  names = new Map([
    [1, 'Model'],
    [2, 'Doors (1)'],
    [3, 'Organization'],
    [4, 'Door type'],
    [5, 'Door leaf'],
  ]),
  stopOnTruthyChildCallback = false,
} = {}) {
  const enumeratedIds = [];
  const tree = {
    enumNodeChildren(dbId, callback, recursive) {
      enumeratedIds.push(dbId);
      const direct = children.get(dbId) ?? [];
      for (const child of direct) {
        const shouldStop = callback(child);
        if (stopOnTruthyChildCallback && shouldStop) break;
        if (recursive) this.enumNodeChildren(child, callback, true);
      }
    },
    getNodeName: (dbId) => names.get(dbId),
    getRootId: () => 1,
  };
  return {
    enumeratedIds,
    getBulkProperties2: vi.fn(() => {
      throw new Error('Category properties must not be read.');
    }),
    getObjectTree: vi.fn((onSuccess, onFailure) => {
      if (failTree) onFailure('raw-tree-error');
      else onSuccess(tree);
    }),
  };
}

test('collects leaf elements below an exact root category without property reads', async () => {
  const model = createModel();

  await expect(readModelCategoryCandidates(model)).resolves.toEqual([
    {
      dbId: 5,
      categoryValues: ['Doors'],
      childCount: 0,
      classification: 'instance',
      expectedCategory: 'Doors',
      parentId: 4,
    },
  ]);
  expect(model.getBulkProperties2).not.toHaveBeenCalled();
});

test('deduplicates repeated tree callback ids', async () => {
  const model = createModel({
    children: new Map([
      [1, [2, 2]],
      [2, [4, 4]],
      [4, []],
    ]),
    names: new Map([
      [1, 'Model'],
      [2, 'Doors'],
      [4, 'Door leaf'],
    ]),
  });

  const candidates = await readModelCategoryCandidates(model);

  expect(resolveCategoryInstances(candidates, 'Doors')).toEqual([4]);
});

test('enumerates every root sibling when the Viewer stops after a truthy callback result', async () => {
  const model = createModel({
    children: new Map([
      [1, [2, 6]],
      [2, []],
      [6, [4]],
      [4, []],
    ]),
    names: new Map([
      [1, 'Model'],
      [2, 'Floors'],
      [6, 'Doors (1)'],
      [4, 'Door leaf'],
    ]),
    stopOnTruthyChildCallback: true,
  });

  const candidates = await readModelCategoryCandidates(model);

  expect(resolveCategoryInstances(candidates, 'Doors')).toEqual([4]);
});

test('matches a trimmed case-insensitive Revit alias with a structural count suffix', async () => {
  const model = createModel({
    names: new Map([
      [1, 'Model'],
      [2, '  rEvIt DoOrS (1)  '],
      [3, 'Organization'],
      [4, 'Door type'],
      [5, 'Door leaf'],
    ]),
  });

  const candidates = await readModelCategoryCandidates(model);

  expect(resolveCategoryInstances(candidates, 'Doors')).toEqual([5]);
});

test('collects every recursive leaf and ignores similar unsupported root labels', async () => {
  const model = createModel({
    children: new Map([
      [1, [2, 9]],
      [2, [3]],
      [3, [4]],
      [4, [5, 6]],
      [5, [7, 8]],
      [6, []],
      [7, []],
      [8, []],
      [9, [10]],
      [10, []],
    ]),
    names: new Map([
      [1, 'Model'],
      [2, 'Walls (3)'],
      [3, 'Basic Wall'],
      [4, 'Wall type [100]'],
      [5, 'Basic Wall [101]'],
      [6, 'Basic Wall [102]'],
      [7, 'Nested wall layer'],
      [8, 'Nested wall profile'],
      [9, 'Wall Accessories'],
      [10, 'Wall accessory leaf'],
    ]),
  });

  const candidates = await readModelCategoryCandidates(model);

  expect(resolveCategoryInstances(candidates, 'Walls')).toEqual([7, 8, 6]);
  expect(model.getBulkProperties2).not.toHaveBeenCalled();
  expect(model.enumeratedIds).not.toContain(9);
  expect(model.enumeratedIds).not.toContain(10);
});

test('resolves supported root categories independently', async () => {
  const model = createModel({
    children: new Map([
      [1, [2, 3, 4, 5]],
      [2, [20]],
      [3, [30]],
      [4, [40]],
      [5, [50]],
      [20, []],
      [30, []],
      [40, []],
      [50, []],
    ]),
    names: new Map([
      [1, 'Model'],
      [2, 'Furniture'],
      [3, 'Walls'],
      [4, 'Doors'],
      [5, 'Windows'],
      [20, 'Furniture leaf'],
      [30, 'Wall leaf'],
      [40, 'Door leaf'],
      [50, 'Window leaf'],
    ]),
  });

  const candidates = await readModelCategoryCandidates(model);

  expect(resolveCategoryInstances(candidates, 'Furniture')).toEqual([20]);
  expect(resolveCategoryInstances(candidates, 'Walls')).toEqual([30]);
  expect(resolveCategoryInstances(candidates, 'Doors')).toEqual([40]);
  expect(resolveCategoryInstances(candidates, 'Windows')).toEqual([50]);
});

test('maps a public object-tree failure to a stable category-analysis failure', async () => {
  const model = createModel({ failTree: true });

  await expect(readModelCategoryCandidates(model)).rejects.toMatchObject({
    code: 'APS_CATEGORY_ANALYSIS_FAILED',
  });
});

test('fails when required public tree APIs are unavailable', async () => {
  const model = createModel();
  model.getObjectTree = vi.fn((onSuccess) => onSuccess({
    getNodeName: () => 'Doors',
    getRootId: () => 1,
  }));

  await expect(readModelCategoryCandidates(model)).rejects.toMatchObject({
    code: 'APS_CATEGORY_ANALYSIS_FAILED',
  });
});

test('ignores matching category names below the root category level', async () => {
  const model = createModel({
    children: new Map([
      [1, [2]],
      [2, [3]],
      [3, [4]],
      [4, []],
    ]),
    names: new Map([
      [1, 'Model'],
      [2, 'Organization'],
      [3, 'Doors'],
      [4, 'Door leaf'],
    ]),
  });

  await expect(readModelCategoryCandidates(model)).resolves.toEqual([]);
});

test('does not treat descriptive labels with counts as root categories', async () => {
  const model = createModel({
    names: new Map([
      [1, 'Model'],
      [2, 'Door elements (1)'],
      [3, 'Organization'],
      [4, 'Door type'],
      [5, 'Door leaf'],
    ]),
  });

  await expect(readModelCategoryCandidates(model)).resolves.toEqual([]);
});

test('fails instead of treating an invalid public tree root as an empty model', async () => {
  const model = createModel();
  model.getObjectTree = vi.fn((onSuccess) => onSuccess({
    enumNodeChildren: vi.fn(),
    getNodeName: vi.fn(),
    getRootId: () => undefined,
  }));

  await expect(readModelCategoryCandidates(model)).rejects.toMatchObject({
    code: 'APS_CATEGORY_ANALYSIS_FAILED',
  });
});

test('fails safely for a self-referential tree branch', async () => {
  const model = createModel({
    children: new Map([
      [1, [2]],
      [2, [2]],
    ]),
    names: new Map([
      [1, 'Model'],
      [2, 'Doors'],
    ]),
  });

  await expect(readModelCategoryCandidates(model)).rejects.toMatchObject({
    code: 'APS_CATEGORY_ANALYSIS_FAILED',
  });
});

test('fails safely when the public tree returns a malformed child id', async () => {
  const model = createModel({
    children: new Map([
      [1, [2]],
      [2, ['invalid-db-id']],
    ]),
    names: new Map([
      [1, 'Model'],
      [2, 'Doors'],
    ]),
  });

  await expect(readModelCategoryCandidates(model)).rejects.toMatchObject({
    code: 'APS_CATEGORY_ANALYSIS_FAILED',
  });
});
