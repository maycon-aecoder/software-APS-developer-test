import { resolveCategoryAlias } from './categoryResolver';

const STRUCTURAL_COUNT_SUFFIX = / \(\d+\)$/;

function resolveRootCategory(value) {
  if (typeof value !== 'string') return null;
  return resolveCategoryAlias(value.trim().replace(STRUCTURAL_COUNT_SUFFIX, ''));
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

function enumerateChildren(tree, dbId) {
  const children = [];
  let invalidChild = false;
  tree.enumNodeChildren(dbId, (childId) => {
    if (!Number.isInteger(childId)) {
      invalidChild = true;
      return;
    }
    children.push(childId);
  }, false);
  if (invalidChild) throw createAnalysisFailure();
  return [...new Set(children)];
}

function collectCategoryLeaves(tree) {
  if (
    !tree
    || typeof tree.getRootId !== 'function'
    || typeof tree.enumNodeChildren !== 'function'
    || typeof tree.getNodeName !== 'function'
  ) {
    throw createAnalysisFailure();
  }

  try {
    const rootId = tree.getRootId();
    if (!Number.isInteger(rootId)) throw createAnalysisFailure();

    const candidates = [];
    const candidateById = new Map();

    function addCandidate(dbId, parentId, category) {
      const existing = candidateById.get(dbId);
      if (existing) {
        existing.categories.add(category);
        return;
      }
      const candidate = {
        dbId,
        categories: new Set([category]),
        parentId,
      };
      candidateById.set(dbId, candidate);
      candidates.push(candidate);
    }

    function visitDescendant(dbId, parentId, category, activePath, visited) {
      if (activePath.has(dbId)) throw createAnalysisFailure();
      if (visited.has(dbId)) return;
      visited.add(dbId);

      const children = enumerateChildren(tree, dbId);
      if (children.length === 0) {
        addCandidate(dbId, parentId, category);
        return;
      }

      activePath.add(dbId);
      for (const childId of children) {
        visitDescendant(childId, dbId, category, activePath, visited);
      }
      activePath.delete(dbId);
    }

    for (const categoryNodeId of enumerateChildren(tree, rootId)) {
      const category = resolveRootCategory(tree.getNodeName(categoryNodeId));
      if (!category) continue;

      const activePath = new Set([categoryNodeId]);
      const visited = new Set();
      for (const childId of enumerateChildren(tree, categoryNodeId)) {
        visitDescendant(childId, categoryNodeId, category, activePath, visited);
      }
    }

    return candidates.map(({ dbId, categories, parentId }) => {
      const categoryValues = [...categories];
      const expectedCategory = categoryValues.length === 1 ? categoryValues[0] : null;
      return {
        dbId,
        categoryValues,
        childCount: 0,
        classification: expectedCategory ? 'instance' : 'unknown',
        expectedCategory,
        parentId,
      };
    });
  } catch {
    throw createAnalysisFailure();
  }
}

export async function readModelCategoryCandidates(model) {
  if (!model || typeof model.getObjectTree !== 'function') {
    throw createAnalysisFailure();
  }

  const tree = await getObjectTree(model);
  return collectCategoryLeaves(tree);
}
