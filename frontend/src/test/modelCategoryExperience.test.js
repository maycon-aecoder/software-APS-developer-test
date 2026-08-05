import { expect, test, vi } from 'vitest';

import { createModelCategoryExperience } from '../features/aps/analysis/createModelCategoryExperience';
import { createDeferred } from './fixtures/viewerDoubles';

function createHarness({ onDiagnostic, readCandidates, resolveInstances } = {}) {
  const diagnostics = [];
  const results = [];
  const candidates = [{ dbId: 1 }];
  const categoryIds = {
    Doors: [30],
    Furniture: [10],
    Walls: [20],
    Windows: [40],
  };
  const experience = createModelCategoryExperience({
    model: { id: 'active-model' },
    onDiagnostic: onDiagnostic ?? ((diagnostic) => diagnostics.push(diagnostic)),
    onCategoryResult: (result) => results.push(result),
    readCandidates: readCandidates ?? vi.fn().mockResolvedValue(candidates),
    resolveInstances: resolveInstances ?? vi.fn((_values, category) => categoryIds[category]),
  });
  return { candidates, diagnostics, experience, results };
}

test('publishes each supported category independently', async () => {
  const harness = createHarness();

  await harness.experience.start();

  expect(harness.results).toEqual([
    { category: 'Furniture', dbIds: [10], status: 'ready' },
    { category: 'Walls', dbIds: [20], status: 'ready' },
    { category: 'Doors', dbIds: [30], status: 'ready' },
    { category: 'Windows', dbIds: [40], status: 'ready' },
  ]);
});

test('isolates one resolver failure while publishing other category results', async () => {
  const resolveInstances = vi.fn((_values, category) => {
    if (category === 'Doors') throw Object.assign(new Error('controlled'), {
      code: 'APS_CATEGORY_ANALYSIS_FAILED',
    });
    return [category.length];
  });
  const harness = createHarness({ resolveInstances });

  await harness.experience.start();

  expect(harness.results.find((result) => result.category === 'Doors')).toEqual({
    category: 'Doors',
    status: 'failed',
  });
  expect(harness.results.find((result) => result.category === 'Windows')).toEqual({
    category: 'Windows',
    dbIds: [7],
    status: 'ready',
  });
  expect(harness.diagnostics).toEqual([{
    category: 'Doors',
    code: 'APS_CATEGORY_ANALYSIS_FAILED',
    stage: 'resolve',
  }]);
});

test('marks all categories failed when the public model read fails', async () => {
  const harness = createHarness({
    readCandidates: vi.fn().mockRejectedValue(Object.assign(new Error('raw failure'), {
      code: 'APS_CATEGORY_ANALYSIS_FAILED',
    })),
  });

  await harness.experience.start();

  expect(harness.results).toEqual([
    { category: 'Furniture', status: 'failed' },
    { category: 'Walls', status: 'failed' },
    { category: 'Doors', status: 'failed' },
    { category: 'Windows', status: 'failed' },
  ]);
  expect(JSON.stringify(harness.results)).not.toContain('raw failure');
  expect(harness.diagnostics).toEqual([{
    code: 'APS_CATEGORY_ANALYSIS_FAILED',
    stage: 'read',
  }]);
  expect(JSON.stringify(harness.diagnostics)).not.toContain('raw failure');
});

test('suppresses every result after disposal and keeps start idempotent', async () => {
  const deferred = createDeferred();
  const readCandidates = vi.fn(() => deferred.promise);
  const harness = createHarness({ readCandidates });

  const first = harness.experience.start();
  const second = harness.experience.start();
  expect(first).toBe(second);
  harness.experience.dispose();
  harness.experience.dispose();
  deferred.resolve(harness.candidates);
  await first;

  expect(readCandidates).toHaveBeenCalledTimes(1);
  expect(harness.results).toEqual([]);
});
