import { resolveCategoryAlias } from './categoryResolver';

const DEFAULT_BATCH_SIZE = 200;
const STRUCTURAL_COUNT_SUFFIX = / \(\d+\)$/;

function resolveTreeCategoryAlias(value) {
  if (typeof value !== 'string') return null;
  return resolveCategoryAlias(value.replace(STRUCTURAL_COUNT_SUFFIX, ''));
}

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
    || typeof tree.getNodeName !== 'function'
  ) {
    throw createAnalysisFailure();
  }

  const orderedIds = [];
  const childCounts = new Map();
  const directFragmentCounts = new Map();
  const childIds = new Map();
  const nodeNames = new Map();
  const parentIds = new Map();
  const seen = new Set();

  function visit(dbId, parentId = null) {
    if (!Number.isInteger(dbId) || seen.has(dbId)) return;
    seen.add(dbId);
    orderedIds.push(dbId);
    parentIds.set(dbId, parentId);
    nodeNames.set(dbId, tree.getNodeName(dbId));

    const children = [];
    tree.enumNodeChildren(dbId, (childId) => children.push(childId), false);
    const uniqueChildren = [...new Set(children.filter(Number.isInteger))];
    childIds.set(dbId, uniqueChildren);
    childCounts.set(dbId, uniqueChildren.length);

    let fragmentCount = 0;
    tree.enumNodeFragments(dbId, () => {
      fragmentCount += 1;
    }, false);
    directFragmentCounts.set(dbId, fragmentCount);

    for (const childId of uniqueChildren) visit(childId, dbId);
  }

  try {
    const rootId = tree.getRootId();
    if (!Number.isInteger(rootId)) throw createAnalysisFailure();
    visit(rootId);
    return {
      childCounts,
      childIds,
      directFragmentCounts,
      nodeNames,
      orderedIds,
      parentIds,
      rootId,
    };
  } catch {
    throw createAnalysisFailure();
  }
}

function collectCategoryCandidateIds(evidence) {
  const candidates = [];
  const candidateById = new Map();

  function addCandidate(dbId, expectedCategory) {
    const existing = candidateById.get(dbId);
    if (existing) {
      if (existing.expectedCategory !== expectedCategory) existing.expectedCategory = null;
      return;
    }
    const candidate = { dbId, expectedCategory };
    candidateById.set(dbId, candidate);
    candidates.push(candidate);
  }

  function visitCategoryBranch(dbId, expectedCategory) {
    if (evidence.directFragmentCounts.get(dbId) > 0) {
      addCandidate(dbId, expectedCategory);
      return;
    }
    for (const childId of evidence.childIds.get(dbId) ?? []) {
      visitCategoryBranch(childId, expectedCategory);
    }
  }

  function visitOrganizationalBranch(dbId) {
    const category = resolveTreeCategoryAlias(evidence.nodeNames.get(dbId));
    if (category) {
      for (const childId of evidence.childIds.get(dbId) ?? []) {
        visitCategoryBranch(childId, category);
      }
      return;
    }
    if (evidence.directFragmentCounts.get(dbId) > 0) return;
    for (const childId of evidence.childIds.get(dbId) ?? []) {
      visitOrganizationalBranch(childId);
    }
  }

  visitOrganizationalBranch(evidence.rootId);
  return candidates;
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
  const categoryCandidates = collectCategoryCandidateIds(evidence);
  const resultById = new Map();

  for (let offset = 0; offset < categoryCandidates.length; offset += batchSize) {
    const batch = categoryCandidates.slice(offset, offset + batchSize).map(({ dbId }) => dbId);
    const results = await getBulkCategoryProperties(model, batch);
    if (!Array.isArray(results)) throw createAnalysisFailure();
    for (const result of results) {
      if (Number.isInteger(result?.dbId) && batch.includes(result.dbId)) {
        resultById.set(result.dbId, result);
      }
    }
  }

  return categoryCandidates.map(({ dbId, expectedCategory }) => {
    const categoryValues = (resultById.get(dbId)?.properties ?? [])
      .filter((property) => property?.displayName === 'Category')
      .map((property) => property.displayValue)
      .filter((value) => typeof value === 'string');
    const resolvedCategories = new Set(categoryValues.map(resolveCategoryAlias).filter(Boolean));
    const classification = (
      expectedCategory
      && resolvedCategories.size === 1
      && resolvedCategories.has(expectedCategory)
    ) ? 'instance' : 'unknown';

    return {
      dbId,
      categoryValues,
      childCount: evidence.childCounts.get(dbId) ?? 0,
      classification,
      expectedCategory,
      parentId: evidence.parentIds.get(dbId),
    };
  });
}
