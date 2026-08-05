const DECIMAL_VALUE = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/;

function invalidArea() {
  return { valid: false };
}

function normalizeZero(value) {
  return Object.is(value, -0) ? 0 : value;
}

function normalizeUnit(value) {
  if (value == null) return { valid: true, value: null };
  if (typeof value !== 'string') return { valid: false };
  const normalized = value.trim();
  return { valid: true, value: normalized || null };
}

function isExactArea(property) {
  return typeof property?.displayName === 'string'
    && property.displayName.trim().toLowerCase() === 'area';
}

function resolveContribution(properties) {
  if (!Array.isArray(properties)) throw new TypeError('Area properties must be an array.');
  const areaProperties = properties.filter(isExactArea);
  if (areaProperties.length === 0) return null;

  const records = areaProperties.map((property) => {
    const parsed = parseAreaValue(property.displayValue);
    const unit = normalizeUnit(property.units);
    if (!parsed.valid || !unit.valid) return null;
    return {
      attributeName: property.attributeName,
      hasType: Object.prototype.hasOwnProperty.call(property, 'type')
        && property.type != null,
      type: property.type,
      unit: unit.value,
      value: parsed.value,
    };
  });
  if (records.some((record) => record === null)) return null;
  if (records.length === 1) {
    return { unit: records[0].unit, value: records[0].value };
  }

  const [first] = records;
  if (typeof first.attributeName !== 'string' || first.attributeName.trim() === '' || !first.hasType) {
    return null;
  }
  const provenDuplicate = records.every((record) => (
    record.attributeName === first.attributeName
    && record.hasType
    && record.type === first.type
    && record.unit === first.unit
    && record.value === first.value
  ));
  return provenDuplicate ? { unit: first.unit, value: first.value } : null;
}

export function countUniqueInstances(dbIds) {
  if (!Array.isArray(dbIds) || dbIds.some((dbId) => !Number.isInteger(dbId))) {
    throw new TypeError('Proven leaf dbIds are required.');
  }
  return new Set(dbIds).size;
}

export function parseAreaValue(value) {
  let parsed;
  if (typeof value === 'number') {
    parsed = value;
  } else if (typeof value === 'string') {
    const normalized = value.trim();
    if (!DECIMAL_VALUE.test(normalized)) return invalidArea();
    parsed = Number(normalized);
  } else {
    return invalidArea();
  }

  if (!Number.isFinite(parsed) || parsed < 0) return invalidArea();
  return { valid: true, value: normalizeZero(parsed) };
}

export function createAreaReport(dbIds, results) {
  countUniqueInstances(dbIds);
  if (!Array.isArray(results)) throw new TypeError('Area results must be an array.');

  const uniqueIds = [...new Set(dbIds)];
  if (uniqueIds.length === 0) {
    return { status: 'unavailable', total: null, unit: null };
  }

  const resultsById = new Map();
  for (const result of results) {
    if (!Number.isInteger(result?.dbId) || !Array.isArray(result.properties)) {
      throw new TypeError('Valid Area result records are required.');
    }
    if (resultsById.has(result.dbId)) throw new TypeError('Duplicate Area results are ambiguous.');
    resultsById.set(result.dbId, result.properties);
  }

  const contributions = [];
  for (const dbId of uniqueIds) {
    const properties = resultsById.get(dbId);
    if (!properties) continue;
    const contribution = resolveContribution(properties);
    if (contribution) contributions.push(contribution);
  }
  if (contributions.length === 0) {
    return { status: 'unavailable', total: null, unit: null };
  }

  const unit = contributions[0].unit;
  if (contributions.some((contribution) => contribution.unit !== unit)) {
    return { status: 'unavailable', total: null, unit: null };
  }

  const total = normalizeZero(
    contributions.reduce((sum, contribution) => sum + contribution.value, 0),
  );
  if (!Number.isFinite(total)) {
    return { status: 'unavailable', total: null, unit: null };
  }
  return {
    status: contributions.length === uniqueIds.length ? 'complete' : 'partial',
    total,
    unit,
  };
}
