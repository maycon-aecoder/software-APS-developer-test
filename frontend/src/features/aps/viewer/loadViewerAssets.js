export const VIEWER_ASSET_URLS = Object.freeze({
  script: 'https://developer.api.autodesk.com/modelderivative/v2/viewers/7.118.2/viewer3D.min.js',
  stylesheet: 'https://developer.api.autodesk.com/modelderivative/v2/viewers/7.118.2/style.min.css',
});

function createAssetError() {
  return Object.assign(new Error('APS Viewer assets could not be loaded.'), {
    code: 'APS_VIEWER_ASSET_LOAD_FAILED',
  });
}

export function createViewerAssetLoader({
  documentRef = document,
  getViewing = () => globalThis.Autodesk?.Viewing,
} = {}) {
  let assetPromise = null;

  return function loadViewerAssets() {
    const available = getViewing();
    if (available) return Promise.resolve(available);
    if (assetPromise) return assetPromise;

    let stylesheet = documentRef.querySelector(`link[href="${VIEWER_ASSET_URLS.stylesheet}"]`);
    const ownsStylesheet = !stylesheet;
    if (!stylesheet) {
      stylesheet = documentRef.createElement('link');
      stylesheet.rel = 'stylesheet';
      stylesheet.href = VIEWER_ASSET_URLS.stylesheet;
      stylesheet.dataset.apsViewerAsset = 'stylesheet';
    }

    let script = documentRef.querySelector(`script[src="${VIEWER_ASSET_URLS.script}"]`);
    const ownsScript = !script;
    if (!script) {
      script = documentRef.createElement('script');
      script.src = VIEWER_ASSET_URLS.script;
      script.async = true;
      script.dataset.apsViewerAsset = 'script';
    }

    assetPromise = new Promise((resolve, reject) => {
      let scriptReady = false;
      let stylesheetReady = !ownsStylesheet && Boolean(stylesheet.sheet);

      const cleanupListeners = () => {
        script.removeEventListener('load', handleScriptLoad);
        script.removeEventListener('error', handleError);
        stylesheet.removeEventListener('load', handleStylesheetLoad);
        stylesheet.removeEventListener('error', handleError);
      };
      const completeIfReady = () => {
        if (!scriptReady || !stylesheetReady) return;
        const viewing = getViewing();
        cleanupListeners();
        if (viewing) resolve(viewing);
        else reject(createAssetError());
      };
      const handleScriptLoad = () => {
        scriptReady = true;
        completeIfReady();
      };
      const handleStylesheetLoad = () => {
        stylesheetReady = true;
        completeIfReady();
      };
      const handleError = () => {
        cleanupListeners();
        reject(createAssetError());
      };

      script.addEventListener('load', handleScriptLoad);
      script.addEventListener('error', handleError);
      if (!stylesheetReady) {
        stylesheet.addEventListener('load', handleStylesheetLoad);
        stylesheet.addEventListener('error', handleError);
      }
      if (ownsStylesheet) documentRef.head.appendChild(stylesheet);
      if (ownsScript) documentRef.head.appendChild(script);
    }).catch((error) => {
      if (ownsScript) script.remove();
      if (ownsStylesheet) stylesheet.remove();
      assetPromise = null;
      throw error?.code === 'APS_VIEWER_ASSET_LOAD_FAILED' ? error : createAssetError();
    });

    return assetPromise;
  };
}

export const loadViewerAssets = createViewerAssetLoader();
