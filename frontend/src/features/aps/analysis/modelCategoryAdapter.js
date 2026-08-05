const DEFAULT_BATCH_SIZE = 200;

function createAnalysisFailure() {
  return Object.assign(new Error('The model categories could not be analyzed safely.'), {
    code: 'APS_CATEGORY_ANALYSIS_FAILED',
  });
}

function getObjectTree(model) {
  return new Promise((resolve, reject) => {
    try {
      model.getObjectTree(resolve, () => reject(createAnalysisFailure()));
    } catch {
      reject(createAnalysisFailure());
    }
  });
}

function getBulkCategoryProperties(model, dbIds) {
  return new Promise((resolve, reject) => {
    try {
      model.getBulkProperties2(
        dbIds,
        { ignoreHidden: true, propFilter: ['Category'] },
        resolve,
        () => reject(createAnalysisFailure()),
      );
    } catch {
      reject(createAnalysisFailure());
    }
  });
}

function collectTreeEvidence(tree) {
  if (
    !tree
    || typeof tree.getRootId !== 'function'
    || typeof tree.enumNodeChildren !== 'function'
    || typeof tree.enumNodeFragments !== 'function'
  ) {
    throw createAnalysisFailure();
  }

  const orderedIds = [];
  const childCounts = new Map();
  const directFragmentCounts = new Map();
  const seen = new Set();

  function visit(dbId) {
    if (!Number.isInteger(dbId) || seen.has(dbId)) return;
    seen.add(dbId);
    orderedIds.push(dbId);

    const children = [];
    tree.enumNodeChildren(dbId, (childId) => children.push(childId), false);
    const uniqueChildren = [...new Set(children.filter(Number.isInteger))];
    childCounts.set(dbId, uniqueChildren.length);

    let fragmentCount = 0;
    tree.enumNodeFragments(dbId, () => {
      fragmentCount += 1;
    }, false);
    directFragmentCounts.set(dbId, fragmentCount);

    for (const childId of uniqueChildren) visit(childId);
  }

  try {
    const rootId = tree.getRootId();
    if (!Number.isInteger(rootId)) throw createAnalysisFailure();
    visit(rootId);
  } catch {
    throw createAnalysisFailure();
  }
  return { childCounts, directFragmentCounts, orderedIds };
}

export async function readModelCategoryCandidates(
  model,
  { batchSize = DEFAULT_BATCH_SIZE } = {},
) {
  if (
    !model
    || typeof model.getObjectTree !== 'function'
    || typeof model.getBulkProperties2 !== 'function'
    || !Number.isInteger(batchSize)
    || batchSize <= 0
  ) {
    throw createAnalysisFailure();
  }

  const tree = await getObjectTree(model);
  const evidence = collectTreeEvidence(tree);
  const resultById = new Map();

  for (let offset = 0; offset < evidence.orderedIds.length; offset += batchSize) {
    const batch = evidence.orderedIds.slice(offset, offset + batchSize);
    const results = await getBulkCategoryProperties(model, batch);
    for (const result of Array.isArray(results) ? results : []) {
      if (Number.isInteger(result?.dbId) && batch.includes(result.dbId)) {
        resultById.set(result.dbId, result);
      }
    }
  }

  return evidence.orderedIds.map((dbId) => {
    const categoryValues = (resultById.get(dbId)?.properties ?? [])
      .filter((property) => property?.displayName === 'Category')
      .map((property) => property.displayValue)
      .filter((value) => typeof value === 'string');
    const hasDirectFragments = evidence.directFragmentCounts.get(dbId) > 0;
    const classification = hasDirectFragments
      ? 'instance'
      : categoryValues.length > 0
        ? 'unknown'
        : 'excluded';

    return {
      dbId,
      categoryValues,
      childCount: evidence.childCounts.get(dbId) ?? 0,
      classification,
    };
  });
}
