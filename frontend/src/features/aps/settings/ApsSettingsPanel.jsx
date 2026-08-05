import React, { useEffect, useSyncExternalStore } from 'react';

const inputClassName =
  'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100';

function FieldError({ id, message }) {
  if (!message) return null;
  return (
    <p id={id} className="mt-1 text-sm text-red-700">
      {message}
    </p>
  );
}

export default function ApsSettingsPanel({ controller, context }) {
  const state = useSyncExternalStore(
    controller.subscribe,
    controller.getState,
    controller.getState,
  );

  useEffect(() => {
    controller.activateContext(context);
    return () => controller.clearContext();
  }, [context.userId, context.workspaceId, controller]);

  if (state.phase === 'idle' || state.phase === 'loading') {
    return (
      <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <div role="status" aria-live="polite" className="text-sm text-gray-600">
          Loading saved APS settings…
        </div>
      </section>
    );
  }

  if (state.phase === 'read-error') {
    return (
      <section className="rounded-2xl border border-red-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-800">APS model settings</h2>
        <p aria-live="assertive" className="mt-3 text-sm text-red-700">
          {state.message}
        </p>
        <button
          type="button"
          onClick={controller.retryRead}
          className="mt-4 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        >
          Retry loading settings
        </button>
      </section>
    );
  }

  const saving = state.phase === 'saving';
  const hasSavedSecret = state.committed?.hasClientSecret === true;
  const secretDescriptionId = state.fieldErrors.clientSecret
    ? 'aps-client-secret-error'
    : 'aps-client-secret-help';

  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
      <div className="mb-5">
        <h2 className="text-lg font-semibold text-gray-800">APS model settings</h2>
        <p className="mt-1 text-sm text-gray-500">
          Configure the APS application and translated source-design model used in this workspace.
        </p>
      </div>

      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          void controller.save();
        }}
      >
        <div>
          <label htmlFor="aps-client-id" className="mb-1 block text-sm font-medium text-gray-700">
            APS Client ID
          </label>
          <input
            id="aps-client-id"
            name="clientId"
            type="text"
            autoComplete="off"
            required
            value={state.attempted.clientId}
            onChange={(event) => controller.updateField('clientId', event.target.value)}
            aria-invalid={state.fieldErrors.clientId ? true : undefined}
            aria-describedby={state.fieldErrors.clientId ? 'aps-client-id-error' : undefined}
            className={inputClassName}
          />
          <FieldError id="aps-client-id-error" message={state.fieldErrors.clientId} />
        </div>

        <div>
          <label htmlFor="aps-client-secret" className="mb-1 block text-sm font-medium text-gray-700">
            APS Client Secret
          </label>
          <input
            id="aps-client-secret"
            name="clientSecret"
            type="password"
            autoComplete="new-password"
            required={!hasSavedSecret}
            value={state.attempted.clientSecret}
            onChange={(event) => controller.updateField('clientSecret', event.target.value)}
            aria-invalid={state.fieldErrors.clientSecret ? true : undefined}
            aria-describedby={secretDescriptionId}
            className={inputClassName}
          />
          <FieldError id="aps-client-secret-error" message={state.fieldErrors.clientSecret} />
          {!state.fieldErrors.clientSecret && (
            <p id="aps-client-secret-help" className="mt-1 text-sm text-gray-500">
              {hasSavedSecret
                ? 'A Client Secret is saved. Leave this field blank to keep it.'
                : 'The Client Secret is required for the first save and is never shown again.'}
            </p>
          )}
        </div>

        <div>
          <label htmlFor="aps-model-urn" className="mb-1 block text-sm font-medium text-gray-700">
            Model URN
          </label>
          <input
            id="aps-model-urn"
            name="modelUrn"
            type="text"
            autoComplete="off"
            required
            value={state.attempted.modelUrn}
            onChange={(event) => controller.updateField('modelUrn', event.target.value)}
            aria-invalid={state.fieldErrors.modelUrn ? true : undefined}
            aria-describedby={state.fieldErrors.modelUrn
              ? 'aps-model-urn-help aps-model-urn-error'
              : 'aps-model-urn-help'}
            className={inputClassName}
          />
          <p id="aps-model-urn-help" className="mt-1 text-sm text-gray-500">
            Use the unpadded Base64URL source-design URN, with no prefix or one lowercase urn: prefix.
          </p>
          <FieldError id="aps-model-urn-error" message={state.fieldErrors.modelUrn} />
        </div>

        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {saving ? 'Saving APS settings' : 'Save APS settings'}
        </button>
      </form>

      <div
        role={state.phase === 'save-error' ? undefined : 'status'}
        aria-live={state.phase === 'save-error' ? 'assertive' : 'polite'}
        className={`mt-4 text-sm ${state.phase === 'save-error' ? 'text-red-700' : 'text-gray-600'}`}
      >
        {state.message}
      </div>
    </section>
  );
}
