import { readModelAreaProperties } from './modelAreaAdapter';
import { countUniqueInstances, createAreaReport } from './quantityDomain';

const QUANTITY_CATEGORIES = new Set(['Doors', 'Windows']);

function failedCount(category) {
  return { category, count: null, status: 'failed' };
}

function loadingArea() {
  return { status: 'loading', total: null, unit: null };
}

function unavailableArea() {
  return { status: 'unavailable', total: null, unit: null };
}

function failedArea() {
  return { status: 'failed', total: null, unit: null };
}

export function createModelQuantityExperience({
  createAreaReport: buildAreaReport = createAreaReport,
  model,
  onDiagnostic = () => {},
  onQuantityResult = () => {},
  readAreaProperties = readModelAreaProperties,
}) {
  const categoryWork = new Map();
  let disposed = false;

  function isCurrent(category, work) {
    return !disposed && categoryWork.get(category) === work && !work.controller?.signal.aborted;
  }

  function publish(result) {
    if (!disposed) onQuantityResult(result);
  }

  function publishCountFailure(category) {
    onDiagnostic({ category, code: 'APS_QUANTITY_COUNT_FAILED', stage: 'count' });
    publish(failedCount(category));
  }

  function acceptCategoryResult(result) {
    if (disposed || !QUANTITY_CATEGORIES.has(result?.category)) return Promise.resolve();
    const category = result.category;
    const existing = categoryWork.get(category);
    if (existing?.input === result) return existing.promise;
    existing?.controller?.abort();

    if (result.status === 'failed') {
      const work = { controller: null, input: result, promise: null };
      work.promise = Promise.resolve();
      categoryWork.set(category, work);
      publish(failedCount(category));
      return work.promise;
    }

    let count;
    let dbIds;
    try {
      if (result.status !== 'ready') throw new TypeError('A resolved category result is required.');
      count = countUniqueInstances(result.dbIds);
      dbIds = [...new Set(result.dbIds)];
    } catch {
      const work = { controller: null, input: result, promise: null };
      work.promise = Promise.resolve();
      categoryWork.set(category, work);
      publishCountFailure(category);
      return work.promise;
    }

    const controller = new AbortController();
    const work = { controller, input: result, promise: null };
    categoryWork.set(category, work);
    publish({
      area: loadingArea(),
      category,
      count,
      status: 'analyzing',
    });

    if (count === 0) {
      publish({ area: unavailableArea(), category, count, status: 'ready' });
      work.promise = Promise.resolve();
      return work.promise;
    }

    work.promise = (async () => {
      let properties;
      try {
        properties = await readAreaProperties(model, dbIds, { signal: controller.signal });
      } catch {
        if (!isCurrent(category, work)) return;
        onDiagnostic({ category, code: 'APS_AREA_ANALYSIS_FAILED', stage: 'read' });
        publish({ area: failedArea(), category, count, status: 'ready' });
        return;
      }
      if (!isCurrent(category, work)) return;

      let area;
      try {
        area = buildAreaReport(dbIds, properties);
      } catch {
        if (!isCurrent(category, work)) return;
        onDiagnostic({ category, code: 'APS_AREA_ANALYSIS_FAILED', stage: 'report' });
        publish({ area: failedArea(), category, count, status: 'ready' });
        return;
      }
      if (!isCurrent(category, work)) return;
      publish({ area, category, count, status: 'ready' });
    })();
    return work.promise;
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    for (const work of categoryWork.values()) work.controller?.abort();
    categoryWork.clear();
  }

  return Object.freeze({ acceptCategoryResult, dispose });
}
