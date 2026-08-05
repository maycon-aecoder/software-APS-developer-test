import React, { useId, useMemo } from 'react';
import Topbar from '../components/Topbar';
import Sidebar from '../components/Sidebar';
import { useAuth } from '../context/AuthContext';
import { getApsConfiguration, saveApsConfiguration } from '../features/aps/api/configuration';
import { createModelCategoryExperience } from '../features/aps/analysis/createModelCategoryExperience';
import { createModelQuantityExperience } from '../features/aps/analysis/createModelQuantityExperience';
import ApsSettingsPanel from '../features/aps/settings/ApsSettingsPanel';
import { createApsSettingsController } from '../features/aps/settings/createApsSettingsController';
import ApsViewerHost from '../features/aps/viewer/ApsViewerHost';
import { createCategoryToolbarController } from '../features/aps/viewer/createCategoryToolbarController';
import { createViewerLifecycleCoordinator } from '../features/aps/viewer/createViewerLifecycleCoordinator';
import { createViewerTokenProvider } from '../features/aps/viewer/createViewerTokenProvider';
import { loadViewerAssets } from '../features/aps/viewer/loadViewerAssets';

function createCategoryColors() {
  const Vector4 = globalThis.THREE?.Vector4;
  if (typeof Vector4 !== 'function') throw new Error('APS_VIEWER_COLOR_UNAVAILABLE');
  return {
    Furniture: new Vector4(0.1, 0.55, 1, 1),
    Walls: new Vector4(1, 0.6, 0.1, 1),
    Doors: new Vector4(0.2, 0.8, 0.4, 1),
  };
}

const HomePage = () => {
  const { user } = useAuth();
  const workspaceId = useId();
  const viewerCoordinator = useMemo(
    () => createViewerLifecycleCoordinator({
      createModelAnalysis: createModelCategoryExperience,
      createQuantityAnalysis: createModelQuantityExperience,
      createToolbarController: (options) => createCategoryToolbarController({
        ...options,
        colors: createCategoryColors(),
        model: null,
      }),
      loadAssets: loadViewerAssets,
      tokenProvider: createViewerTokenProvider(),
    }),
    [],
  );
  const settingsController = useMemo(
    () => createApsSettingsController({
      api: {
        getConfiguration: getApsConfiguration,
        saveConfiguration: saveApsConfiguration,
      },
      onLifecycleCommand: viewerCoordinator.execute,
    }),
    [viewerCoordinator],
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <Topbar />
      <Sidebar />

      {/* Main content — offset for fixed topbar and sidebar */}
      <main className="ml-60 pt-16 p-8">
        <div className="mx-auto max-w-6xl">
          <h1 className="text-2xl font-bold text-gray-800 mb-2">
            Welcome, {user?.name ?? 'User'} 👋
          </h1>

          {user?.id ? (
            <div className="space-y-6">
              <ApsSettingsPanel
                controller={settingsController}
                context={{ userId: user.id, workspaceId }}
              />
              <ApsViewerHost coordinator={viewerCoordinator} />
            </div>
          ) : (
            <section className="rounded-2xl border border-red-200 bg-white p-6 shadow-sm">
              <p aria-live="assertive" className="text-sm text-red-700">
                Your account details could not be loaded. Sign out and sign in again before
                configuring APS.
              </p>
            </section>
          )}
        </div>
      </main>
    </div>
  );
};

export default HomePage;
