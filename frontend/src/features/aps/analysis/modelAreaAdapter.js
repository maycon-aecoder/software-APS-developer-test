const DEFAULT_BATCH_SIZE = 200;
const PUBLIC_PROPERTY_FIELDS = Object.freeze([
  'attributeName',
  'displayCategory',
  'displayName',
  'displayValue',
  'hidden',
  'precision',
  'type',
  'units',
]);

function createFailure() {
  return Object.assign(new Error('Model Area properties could not be read safely.'), {
    code: 'APS_AREA_ANALYSIS_FAILED',
  });
}

function createCancellation() {
  return Object.assign(new Error('Model Area analysis was cancelled.'), {
    code: 'APS_AREA_ANALYSIS_CANCELLED',
  });
}

function assertCurrent(signal) {
  if (signal?.aborted) throw createCancellation();
}

function readBatch(model, dbIds) {
  return new Promise((resolve, reject) => {
    try {
      model.getBulkProperties2(
        dbIds,
        { ignoreHidden: true },
        resolve,
        () => reject(createFailure()),
      );
    } catch {
      reject(createFailure());
    }
  });
}

function copyPublicProperty(property) {
  if (!property || typeof property !== 'object' || Array.isArray(property)) {
    throw createFailure();
  }
  const safe = {};
  for (const field of PUBLIC_PROPERTY_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(property, field)) safe[field] = property[field];
  }
  return safe;
}

function copyPublicName(name) {
  if (typeof name !== 'string') return null;
  const normalized = name.trim();
  return normalized || null;
}

function adaptBatch(results, requestedIds) {
  if (!Array.isArray(results)) throw createFailure();
  const requested = new Set(requestedIds);
  const seen = new Set();
  return results.map((result) => {
    if (
      !Number.isInteger(result?.dbId)
      || !requested.has(result.dbId)
      || seen.has(result.dbId)
      || !Array.isArray(result.properties)
    ) throw createFailure();
    seen.add(result.dbId);
    return {
      dbId: result.dbId,
      name: copyPublicName(result.name),
      properties: result.properties.map(copyPublicProperty),
    };
  });
}

export async function readModelAreaProperties(
  model,
  dbIds,
  { batchSize = DEFAULT_BATCH_SIZE, signal } = {},
) {
  if (
    !model
    || typeof model.getBulkProperties2 !== 'function'
    || !Array.isArray(dbIds)
    || dbIds.some((dbId) => !Number.isInteger(dbId))
    || !Number.isInteger(batchSize)
    || batchSize <= 0
  ) throw createFailure();

  const uniqueIds = [...new Set(dbIds)];
  const safeResults = [];
  for (let offset = 0; offset < uniqueIds.length; offset += batchSize) {
    assertCurrent(signal);
    const batch = uniqueIds.slice(offset, offset + batchSize);
    const results = await readBatch(model, batch);
    assertCurrent(signal);
    safeResults.push(...adaptBatch(results, batch));
  }
  return safeResults;
}
