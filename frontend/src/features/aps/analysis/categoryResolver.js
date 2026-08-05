const CATEGORY_ALIASES = Object.freeze({
  Furniture: Object.freeze(['furniture', 'revit furniture']),
  Walls: Object.freeze(['walls', 'revit walls']),
  Doors: Object.freeze(['doors', 'revit doors']),
  Windows: Object.freeze(['windows', 'revit windows']),
});

const ALIAS_TO_CATEGORY = new Map(
  Object.entries(CATEGORY_ALIASES).flatMap(([category, aliases]) => (
    aliases.map((alias) => [alias, category])
  )),
);

function createAnalysisFailure() {
  return Object.assign(new Error('Category instance identity could not be determined safely.'), {
    code: 'APS_CATEGORY_ANALYSIS_FAILED',
  });
}

export function resolveCategoryAlias(value) {
  if (typeof value !== 'string') return null;
  return ALIAS_TO_CATEGORY.get(value.trim().toLowerCase()) ?? null;
}

export function resolveCategoryInstances(candidates, category) {
  if (!Object.prototype.hasOwnProperty.call(CATEGORY_ALIASES, category)) {
    throw new TypeError('A supported category is required.');
  }

  const resolved = [];
  const seen = new Set();
  for (const candidate of Array.isArray(candidates) ? candidates : []) {
    const categories = new Set(
      (Array.isArray(candidate?.categoryValues) ? candidate.categoryValues : [])
        .map(resolveCategoryAlias)
        .filter(Boolean),
    );
    if (!categories.has(category)) continue;
    if (categories.size !== 1) throw createAnalysisFailure();
    if (candidate.classification === 'excluded') continue;
    if (
      candidate.classification !== 'instance'
      || !Number.isInteger(candidate.dbId)
    ) {
      throw createAnalysisFailure();
    }
    if (!seen.has(candidate.dbId)) {
      seen.add(candidate.dbId);
      resolved.push(candidate.dbId);
    }
  }
  return resolved;
}

export const SUPPORTED_CATEGORIES = Object.freeze(Object.keys(CATEGORY_ALIASES));

