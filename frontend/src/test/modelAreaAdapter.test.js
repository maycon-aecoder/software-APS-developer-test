import { existsSync } from 'node:fs';
import path from 'node:path';
import { expect, test, vi } from 'vitest';

const subjectPath = path.resolve(
  process.cwd(),
  'src/features/aps/analysis/modelAreaAdapter.js',
);
const subject = existsSync(subjectPath)
  ? await import(/* @vite-ignore */ subjectPath)
  : { readModelAreaProperties: () => Promise.resolve(undefined) };
const { readModelAreaProperties } = subject;

function createModel({ fail = false, malformed = false, malformedProperties = false, throws = false } = {}) {
  return {
    getBulkProperties2: vi.fn((dbIds, options, onSuccess, onFailure) => {
      if (throws) throw new Error('raw thrown failure');
      if (fail) {
        onFailure('raw callback failure');
        return;
      }
      if (malformed) {
        onSuccess({ results: [] });
        return;
      }
      if (malformedProperties) {
        onSuccess([{ dbId: dbIds[0], properties: 'not-an-array' }]);
        return;
      }
      onSuccess(dbIds
        .filter((dbId) => dbId !== 2)
        .map((dbId) => ({
          dbId,
          name: ` Element ${dbId} `,
          secretExtra: 'must-not-cross',
          properties: [{
            attributeName: 'revit.area',
            displayCategory: 'Dimensions',
            displayName: 'Area',
            displayValue: String(dbId),
            hidden: false,
            precision: 2,
            secretExtra: 'must-not-cross',
            type: 3,
            units: 'm²',
          }],
        })));
      expect(options).toEqual({ ignoreHidden: true });
    }),
  };
}

test('reads visible Area properties in bounded batches and whitelists public fields', async () => {
  const model = createModel();

  await expect(readModelAreaProperties(model, [1, 2, 3], { batchSize: 2 })).resolves.toEqual([
    {
      dbId: 1,
      name: 'Element 1',
      properties: [{
        attributeName: 'revit.area',
        displayCategory: 'Dimensions',
        displayName: 'Area',
        displayValue: '1',
        hidden: false,
        precision: 2,
        type: 3,
        units: 'm²',
      }],
    },
    {
      dbId: 3,
      name: 'Element 3',
      properties: [{
        attributeName: 'revit.area',
        displayCategory: 'Dimensions',
        displayName: 'Area',
        displayValue: '3',
        hidden: false,
        precision: 2,
        type: 3,
        units: 'm²',
      }],
    },
  ]);
  expect(model.getBulkProperties2.mock.calls.map(([dbIds]) => dbIds)).toEqual([[1, 2], [3]]);
});

test.each([
  ['callback failure', { fail: true }],
  ['thrown operation', { throws: true }],
  ['malformed success', { malformed: true }],
  ['malformed property result', { malformedProperties: true }],
])('maps %s to a stable operational Area failure', async (_name, options) => {
  await expect(readModelAreaProperties(createModel(options), [1])).rejects.toMatchObject({
    code: 'APS_AREA_ANALYSIS_FAILED',
  });
});

test('rejects invalid instance input instead of guessing a partial request', async () => {
  await expect(readModelAreaProperties(createModel(), [1, '2'])).rejects.toMatchObject({
    code: 'APS_AREA_ANALYSIS_FAILED',
  });
});

test('skips the Viewer property operation when no instances matched', async () => {
  const model = createModel();

  await expect(readModelAreaProperties(model, [])).resolves.toEqual([]);
  expect(model.getBulkProperties2).not.toHaveBeenCalled();
});

test('aborts between bounded batches and does not schedule stale work', async () => {
  const controller = new AbortController();
  const pending = [];
  const model = {
    getBulkProperties2: vi.fn((dbIds, _options, onSuccess, onFailure) => {
      pending.push({ dbIds, onFailure, onSuccess });
    }),
  };
  const completion = readModelAreaProperties(model, [1, 2, 3], {
    batchSize: 2,
    signal: controller.signal,
  });
  controller.abort();
  pending[0]?.onSuccess([{
    dbId: 1,
    properties: [],
  }]);

  await expect(completion).rejects.toMatchObject({
    code: 'APS_AREA_ANALYSIS_CANCELLED',
  });
  expect(model.getBulkProperties2).toHaveBeenCalledTimes(1);
});
