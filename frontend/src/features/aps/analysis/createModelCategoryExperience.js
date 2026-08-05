import {
  resolveCategoryInstances,
  SUPPORTED_CATEGORIES,
} from './categoryResolver';
import { readModelCategoryCandidates } from './modelCategoryAdapter';

export function createModelCategoryExperience({
  model,
  onCategoryResult = () => {},
  onDiagnostic = () => {},
  readCandidates = readModelCategoryCandidates,
  resolveInstances = resolveCategoryInstances,
}) {
  let disposed = false;
  let startPromise = null;

  function publishReady(category, dbIds) {
    if (disposed) return;
    onCategoryResult({ category, dbIds: [...dbIds], status: 'ready' });
  }

  function publishFailed(category) {
    if (disposed) return;
    onCategoryResult({ category, status: 'failed' });
  }

  async function run() {
    let candidates;
    try {
      candidates = await readCandidates(model);
    } catch {
      onDiagnostic({ code: 'APS_CATEGORY_ANALYSIS_FAILED', stage: 'read' });
      for (const category of SUPPORTED_CATEGORIES) publishFailed(category);
      return;
    }
    if (disposed) return;

    for (const category of SUPPORTED_CATEGORIES) {
      if (disposed) return;
      let dbIds;
      try {
        dbIds = resolveInstances(candidates, category);
      } catch {
        onDiagnostic({ category, code: 'APS_CATEGORY_ANALYSIS_FAILED', stage: 'resolve' });
        publishFailed(category);
        continue;
      }
      publishReady(category, dbIds);
    }
  }

  function start() {
    if (!startPromise) startPromise = run();
    return startPromise;
  }

  return Object.freeze({
    dispose() {
      disposed = true;
    },
    start,
  });
}
