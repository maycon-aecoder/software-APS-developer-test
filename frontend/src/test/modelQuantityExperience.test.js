import { existsSync } from 'node:fs';
import path from 'node:path';
import { expect, test, vi } from 'vitest';

import { createDeferred } from './fixtures/viewerDoubles';

const subjectPath = path.resolve(
  process.cwd(),
  'src/features/aps/analysis/createModelQuantityExperience.js',
);
const subject = existsSync(subjectPath)
  ? await import(/* @vite-ignore */ subjectPath)
  : {
      createModelQuantityExperience: () => ({
        acceptCategoryResult: () => Promise.resolve(),
        dispose: () => {},
      }),
    };
const { createModelQuantityExperience } = subject;

function areaResult(dbId, value = dbId) {
  return {
    dbId,
    properties: [{ displayName: 'Area', displayValue: value, units: 'm²' }],
  };
}

function createHarness({ createAreaDetails, createAreaReport, readAreaProperties } = {}) {
  const diagnostics = [];
  const results = [];
  const model = { id: 'active-model' };
  const experience = createModelQuantityExperience({
    ...(createAreaDetails ? { createAreaDetails } : {}),
    createAreaReport: createAreaReport ?? vi.fn(() => ({
      status: 'complete',
      total: 3,
      unit: 'm²',
    })),
    model,
    onDiagnostic: (diagnostic) => diagnostics.push(diagnostic),
    onQuantityResult: (result) => results.push(result),
    readAreaProperties: readAreaProperties ?? vi.fn((_model, dbIds) => (
      Promise.resolve(dbIds.map((dbId) => areaResult(dbId)))
    )),
  });
  return { diagnostics, experience, model, results };
}

test('publishes safe ordered element details with the completed category analysis', async () => {
  const createAreaDetails = vi.fn(() => ([
    { area: { status: 'available', unit: 'm2', value: 1 }, name: 'Single Door' },
    { area: { status: 'unavailable' }, name: 'Door element 2' },
  ]));
  const harness = createHarness({ createAreaDetails });

  await harness.experience.acceptCategoryResult({
    category: 'Doors',
    dbIds: [1, 2],
    status: 'ready',
  });

  expect(createAreaDetails).toHaveBeenCalledWith(
    'Doors',
    [1, 2],
    expect.arrayContaining([expect.objectContaining({ dbId: 1 }), expect.objectContaining({ dbId: 2 })]),
  );
  expect(harness.results.at(-1)).toMatchObject({
    category: 'Doors',
    count: 2,
    elements: [
      { area: { status: 'available', unit: 'm2', value: 1 }, name: 'Single Door' },
      { area: { status: 'unavailable' }, name: 'Door element 2' },
    ],
    status: 'ready',
  });
});

test('publishes a deduplicated safe count before deferred Area completion', async () => {
  const deferred = createDeferred();
  const readAreaProperties = vi.fn(() => deferred.promise);
  const harness = createHarness({ readAreaProperties });

  const completion = harness.experience.acceptCategoryResult({
    category: 'Doors',
    dbIds: [1, 1, 2],
    status: 'ready',
  });

  expect(harness.results).toEqual([{
    area: { status: 'loading', total: null, unit: null },
    category: 'Doors',
    count: 2,
    status: 'analyzing',
  }]);
  deferred.resolve([areaResult(1, 1), areaResult(2, 2)]);
  await completion;

  expect(harness.results.at(-1)).toMatchObject({
    area: { status: 'complete', total: 3, unit: 'm²' },
    category: 'Doors',
    count: 2,
    status: 'ready',
  });
});

test('publishes zero with unavailable Area without reading Viewer properties', async () => {
  const readAreaProperties = vi.fn();
  const harness = createHarness({ readAreaProperties });

  await harness.experience.acceptCategoryResult({
    category: 'Windows',
    dbIds: [],
    status: 'ready',
  });

  expect(harness.results.at(-1)).toEqual({
    area: { status: 'unavailable', total: null, unit: null },
    category: 'Windows',
    count: 0,
    elements: [],
    status: 'ready',
  });
  expect(readAreaProperties).not.toHaveBeenCalled();
});

test('publishes failed count without an Area state or property request', async () => {
  const readAreaProperties = vi.fn();
  const harness = createHarness({ readAreaProperties });

  await harness.experience.acceptCategoryResult({ category: 'Doors', status: 'failed' });

  expect(harness.results).toEqual([{ category: 'Doors', count: null, status: 'failed' }]);
  expect(harness.results[0]).not.toHaveProperty('area');
  expect(readAreaProperties).not.toHaveBeenCalled();
});

test('maps unsafe leaf identity to failed count and skips Area', async () => {
  const readAreaProperties = vi.fn();
  const harness = createHarness({ readAreaProperties });

  await harness.experience.acceptCategoryResult({
    category: 'Doors',
    dbIds: [1, 'invalid-db-id'],
    status: 'ready',
  });

  expect(harness.results).toEqual([{ category: 'Doors', count: null, status: 'failed' }]);
  expect(readAreaProperties).not.toHaveBeenCalled();
  expect(harness.diagnostics).toEqual([{
    category: 'Doors',
    code: 'APS_QUANTITY_COUNT_FAILED',
    stage: 'count',
  }]);
});

test('retains a safe Door count after Area failure without blocking Windows', async () => {
  const readAreaProperties = vi.fn((_model, dbIds) => {
    if (dbIds.includes(1)) return Promise.reject(new Error('raw upstream failure'));
    return Promise.resolve([areaResult(2, 4)]);
  });
  const createAreaReport = vi.fn((dbIds) => ({
    status: 'complete',
    total: dbIds[0] * 2,
    unit: 'm²',
  }));
  const harness = createHarness({ createAreaReport, readAreaProperties });

  await Promise.all([
    harness.experience.acceptCategoryResult({ category: 'Doors', dbIds: [1], status: 'ready' }),
    harness.experience.acceptCategoryResult({ category: 'Windows', dbIds: [2], status: 'ready' }),
  ]);

  expect(harness.results.filter(({ category }) => category === 'Doors')).toEqual([
    {
      area: { status: 'loading', total: null, unit: null },
      category: 'Doors',
      count: 1,
      status: 'analyzing',
    },
    {
      area: { status: 'failed', total: null, unit: null },
      category: 'Doors',
      count: 1,
      elements: [],
      status: 'ready',
    },
  ]);
  expect(harness.results
    .filter(({ category }) => category === 'Doors')
    .every(({ area }) => area?.total === null)).toBe(true);
  expect(harness.results).toContainEqual({
    area: { status: 'complete', total: 4, unit: 'm²' },
    category: 'Windows',
    count: 1,
    elements: [expect.objectContaining({ name: 'Window element 1' })],
    status: 'ready',
  });
  expect(harness.diagnostics).toEqual([{
    category: 'Doors',
    code: 'APS_AREA_ANALYSIS_FAILED',
    stage: 'read',
  }]);
  expect(JSON.stringify(harness.diagnostics)).not.toContain('raw upstream failure');
});

test.each(['resolve', 'reject'])('disposal suppresses a deferred Area %s and aborts its work', async (outcome) => {
  const deferred = createDeferred();
  void deferred.promise.catch(() => {});
  let signal;
  const readAreaProperties = vi.fn((_model, _dbIds, options) => {
    signal = options.signal;
    return deferred.promise;
  });
  const harness = createHarness({ readAreaProperties });
  const completion = harness.experience.acceptCategoryResult({
    category: 'Doors',
    dbIds: [1],
    status: 'ready',
  });
  const resultCountAtDisposal = harness.results.length;

  harness.experience.dispose();
  harness.experience.dispose();
  if (outcome === 'resolve') deferred.resolve([areaResult(1)]);
  else deferred.reject(new Error('obsolete raw failure'));
  await completion;

  expect(signal?.aborted).toBe(true);
  expect(harness.results).toHaveLength(resultCountAtDisposal);
  expect(harness.diagnostics).toEqual([]);
});

test.each(['resolve', 'reject'])(
  'a newer result suppresses its older same-category deferred %s',
  async (outcome) => {
    const first = createDeferred();
    void first.promise.catch(() => {});
    const signals = [];
    const readAreaProperties = vi.fn((_model, dbIds, options) => {
      signals.push(options.signal);
      if (dbIds.includes(1)) return first.promise;
      return Promise.resolve([areaResult(2, 2)]);
    });
    const harness = createHarness({
      createAreaReport: vi.fn((_dbIds, results) => ({
        status: 'complete',
        total: Number(results[0].properties[0].displayValue),
        unit: 'm²',
      })),
      readAreaProperties,
    });

    const obsolete = harness.experience.acceptCategoryResult({
      category: 'Doors',
      dbIds: [1],
      status: 'ready',
    });
    const current = harness.experience.acceptCategoryResult({
      category: 'Doors',
      dbIds: [2],
      status: 'ready',
    });
    if (outcome === 'resolve') first.resolve([areaResult(1, 100)]);
    else first.reject(new Error('obsolete raw failure'));
    await Promise.all([obsolete, current]);

    expect(signals[0]?.aborted).toBe(true);
    expect(harness.results.at(-1)).toMatchObject({
      area: { status: 'complete', total: 2, unit: 'm²' },
      category: 'Doors',
      count: 1,
      status: 'ready',
    });
    expect(harness.results).not.toContainEqual(expect.objectContaining({
      area: expect.objectContaining({ total: 100 }),
    }));
    expect(harness.diagnostics).toEqual([]);
  },
);

test('repeated delivery of the same category result is idempotent', async () => {
  const deferred = createDeferred();
  const readAreaProperties = vi.fn(() => deferred.promise);
  const harness = createHarness({ readAreaProperties });
  const categoryResult = { category: 'Doors', dbIds: [1], status: 'ready' };

  const first = harness.experience.acceptCategoryResult(categoryResult);
  const second = harness.experience.acceptCategoryResult(categoryResult);
  deferred.resolve([areaResult(1)]);
  await Promise.all([first, second]);

  expect(readAreaProperties).toHaveBeenCalledTimes(1);
  expect(harness.results).toHaveLength(2);
});
