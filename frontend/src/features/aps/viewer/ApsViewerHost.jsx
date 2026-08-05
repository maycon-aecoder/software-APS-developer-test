import React, { useLayoutEffect, useRef, useSyncExternalStore } from 'react';

export default function ApsViewerHost({ coordinator }) {
  const hostRef = useRef(null);
  const state = useSyncExternalStore(
    coordinator.subscribe,
    coordinator.getSnapshot,
    coordinator.getSnapshot,
  );

  useLayoutEffect(() => {
    coordinator.attachHost(hostRef.current);
    return () => {
      void coordinator.dispose();
    };
  }, [coordinator]);

  return (
    <section
      aria-label="3D model viewer"
      className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm"
    >
      <div
        ref={hostRef}
        data-aps-viewer-host
        className="relative min-h-[34rem] w-full bg-gray-100"
      />
      <div className="flex min-h-14 items-center justify-between gap-4 border-t border-gray-200 px-4 py-3">
        <p
          role={state.phase === 'load-failed' ? 'alert' : 'status'}
          aria-live={state.phase === 'load-failed' ? 'assertive' : 'polite'}
          className={`text-sm ${state.phase === 'load-failed' ? 'text-red-700' : 'text-gray-600'}`}
        >
          {state.message}
        </p>
        {state.phase === 'load-failed' && (
          <button
            type="button"
            onClick={() => void coordinator.retry()}
            className="shrink-0 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            Retry loading model
          </button>
        )}
      </div>
    </section>
  );
}
