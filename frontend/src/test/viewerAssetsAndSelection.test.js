import { existsSync } from 'node:fs';
import path from 'node:path';
import { afterEach, expect, test, vi } from 'vitest';

import { createBubbleNode } from './fixtures/viewerDoubles';

const assetsPath = path.resolve(process.cwd(), 'src/features/aps/viewer/loadViewerAssets.js');
const selectionPath = path.resolve(process.cwd(), 'src/features/aps/viewer/select3DViewable.js');
const assetsSubject = existsSync(assetsPath)
  ? await import(/* @vite-ignore */ assetsPath)
  : {
      VIEWER_ASSET_URLS: {},
      createViewerAssetLoader: () => () => Promise.resolve(),
    };
const selectionSubject = existsSync(selectionPath)
  ? await import(/* @vite-ignore */ selectionPath)
  : { selectSupported3DViewable: () => undefined };

const { VIEWER_ASSET_URLS, createViewerAssetLoader } = assetsSubject;
const { selectSupported3DViewable } = selectionSubject;

afterEach(() => {
  document.head.replaceChildren();
  vi.restoreAllMocks();
});

test('defines matching exact APS Viewer 7.118.2 distribution assets', () => {
  expect(VIEWER_ASSET_URLS).toEqual({
    script: 'https://developer.api.autodesk.com/modelderivative/v2/viewers/7.118.2/viewer3D.min.js',
    stylesheet: 'https://developer.api.autodesk.com/modelderivative/v2/viewers/7.118.2/style.min.css',
  });
});

test('shares one in-flight asset promise and inserts each matching asset once', async () => {
  let viewing;
  const loadAssets = createViewerAssetLoader({
    documentRef: document,
    getViewing: () => viewing,
  });

  const first = loadAssets();
  const second = loadAssets();

  expect(first).toBe(second);
  expect(document.head.querySelectorAll('link[rel="stylesheet"]')).toHaveLength(1);
  expect(document.head.querySelector('link')?.href).toBe(VIEWER_ASSET_URLS.stylesheet);
  expect(document.head.querySelectorAll('script')).toHaveLength(1);
  expect(document.head.querySelector('script')?.src).toBe(VIEWER_ASSET_URLS.script);

  viewing = { Initializer() {} };
  document.head.querySelector('script')?.dispatchEvent(new Event('load'));
  await expect(first).resolves.toBe(viewing);
  await expect(loadAssets()).resolves.toBe(viewing);
  expect(document.head.querySelectorAll('script')).toHaveLength(1);
});

test('reuses an already available Viewer runtime without injecting assets', async () => {
  const viewing = { Initializer() {} };
  const loadAssets = createViewerAssetLoader({
    documentRef: document,
    getViewing: () => viewing,
  });

  await expect(loadAssets()).resolves.toBe(viewing);
  expect(document.head.children).toHaveLength(0);
});

test('reports an actionable asset failure and permits a clean retry', async () => {
  let viewing;
  const loadAssets = createViewerAssetLoader({
    documentRef: document,
    getViewing: () => viewing,
  });
  const first = loadAssets();
  const firstScript = document.head.querySelector('script');
  expect(firstScript).not.toBeNull();
  firstScript?.dispatchEvent(new Event('error'));

  await expect(first).rejects.toMatchObject({ code: 'APS_VIEWER_ASSET_LOAD_FAILED' });
  expect(document.head.querySelectorAll('script')).toHaveLength(0);

  const retry = loadAssets();
  viewing = { Initializer() {} };
  document.head.querySelector('script')?.dispatchEvent(new Event('load'));
  await expect(retry).resolves.toBe(viewing);
});

test('selects a supported default 3D geometry before traversal', () => {
  const fallback = createBubbleNode({ is3D: true, isGeometry: true });
  const preferred = createBubbleNode({ is3D: true, isGeometry: true });
  const root = {
    getChildren: () => [fallback],
    getDefaultGeometry: () => preferred,
  };

  expect(selectSupported3DViewable(root)).toBe(preferred);
});

test('falls back through public children in depth-first pre-order', () => {
  const nestedFirst = createBubbleNode({ is3D: true, isGeometry: true });
  const later = createBubbleNode({ is3D: true, isGeometry: true });
  const twoDimensionalParent = createBubbleNode({
    children: [nestedFirst],
    is3D: false,
    isGeometry: true,
  });
  const root = {
    getChildren: () => [twoDimensionalParent, later],
    getDefaultGeometry: () => createBubbleNode({ is3D: false, isGeometry: true }),
  };

  expect(selectSupported3DViewable(root)).toBe(nestedFirst);
});

test.each([
  ['a 3D non-geometry default', createBubbleNode({ is3D: true, isGeometry: false })],
  ['a 2D geometry default', createBubbleNode({ is3D: false, isGeometry: true })],
  ['no default', null],
])('never accepts %s and never falls back to a 2D sheet', (_label, defaultGeometry) => {
  const only2D = createBubbleNode({ is3D: false, isGeometry: true });
  const root = {
    getChildren: () => [only2D],
    getDefaultGeometry: () => defaultGeometry,
  };

  expect(() => selectSupported3DViewable(root)).toThrow(
    expect.objectContaining({ code: 'APS_VIEWABLE_3D_NOT_FOUND' }),
  );
});
