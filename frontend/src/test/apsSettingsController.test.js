import { expect, test, vi } from 'vitest';

import { createApsSettingsController } from '../features/aps/settings/createApsSettingsController';
import { createDeferred } from './fixtures/viewerDoubles';

const contextA = Object.freeze({ userId: 'user-a', workspaceId: 'workspace-a' });
const contextB = Object.freeze({ userId: 'user-b', workspaceId: 'workspace-b' });
const savedConfiguration = Object.freeze({
  clientId: 'client-a',
  modelUrn: 'dGVzdC1tb2RlbA',
  hasClientSecret: true,
});
const initialGenerations = Object.freeze({
  configuration: 0,
  authentication: 0,
  runtime: 0,
  model: 0,
  analysis: 0,
});

function flushPromises() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

function createHarness(overrides = {}) {
  const api = {
    getConfiguration: vi.fn().mockResolvedValue({ configured: false, configuration: null }),
    saveConfiguration: vi.fn(),
    ...overrides,
  };
  const lifecycleCommands = [];
  const controller = createApsSettingsController({
    api,
    onLifecycleCommand: (command) => lifecycleCommands.push(command),
  });
  return { api, controller, lifecycleCommands };
}

async function loadConfigured(harness) {
  harness.api.getConfiguration.mockResolvedValueOnce({
    configured: true,
    configuration: savedConfiguration,
  });
  harness.controller.activateContext(contextA);
  await flushPromises();
}

test('publishes loading then explicit first-time state without starting lifecycle work', async () => {
  const deferred = createDeferred();
  const harness = createHarness({ getConfiguration: vi.fn().mockReturnValue(deferred.promise) });

  harness.controller.activateContext(contextA);
  expect(harness.controller.getState().phase).toBe('loading');

  deferred.resolve({ configured: false, configuration: null });
  await flushPromises();

  expect(harness.controller.getState()).toMatchObject({
    phase: 'empty',
    attempted: { clientId: '', clientSecret: '', modelUrn: '' },
    committed: null,
    generations: initialGenerations,
  });
  expect(harness.lifecycleCommands).toEqual([]);
});

test('commits a configured read and requests initial loading with a complete generation context', async () => {
  const harness = createHarness();
  await loadConfigured(harness);

  expect(harness.controller.getState()).toMatchObject({
    phase: 'ready',
    attempted: {
      clientId: 'client-a',
      clientSecret: '',
      modelUrn: 'dGVzdC1tb2RlbA',
    },
    committed: savedConfiguration,
    generations: {
      configuration: 1,
      authentication: 1,
      runtime: 1,
      model: 1,
      analysis: 1,
    },
  });
  expect(harness.lifecycleCommands).toEqual([
    expect.objectContaining({
      type: 'initialize',
      context: contextA,
      configuration: savedConfiguration,
      generations: {
        configuration: 1,
        authentication: 1,
        runtime: 1,
        model: 1,
        analysis: 1,
      },
    }),
  ]);
});

test('keeps a read failure distinct from first-time state and retries without lifecycle work', async () => {
  const api = {
    getConfiguration: vi
      .fn()
      .mockRejectedValueOnce({ response: { data: { message: 'Saved APS settings could not be loaded. Try again.' } } })
      .mockResolvedValueOnce({ configured: false, configuration: null }),
  };
  const harness = createHarness(api);

  harness.controller.activateContext(contextA);
  await flushPromises();

  expect(harness.controller.getState()).toMatchObject({
    phase: 'read-error',
    message: 'Saved APS settings could not be loaded. Try again.',
    committed: null,
  });
  expect(harness.lifecycleCommands).toEqual([]);

  harness.controller.retryRead();
  expect(harness.controller.getState().phase).toBe('loading');
  await flushPromises();
  expect(harness.controller.getState().phase).toBe('empty');
  expect(api.getConfiguration).toHaveBeenCalledTimes(2);
  expect(harness.lifecycleCommands).toEqual([]);
});

test('treats an unchanged-client blank-secret save as an authoritative same-runtime replacement', async () => {
  const harness = createHarness();
  await loadConfigured(harness);
  harness.lifecycleCommands.length = 0;
  harness.controller.updateField('modelUrn', 'bmV3LW1vZGVs');
  harness.api.saveConfiguration.mockResolvedValueOnce({
    configured: true,
    configuration: { ...savedConfiguration, modelUrn: 'bmV3LW1vZGVs' },
    changeType: 'urn-only',
  });

  await expect(harness.controller.save()).resolves.toBe(true);

  expect(harness.controller.getState()).toMatchObject({
    phase: 'ready',
    committed: { ...savedConfiguration, modelUrn: 'bmV3LW1vZGVs' },
    generations: {
      configuration: 2,
      authentication: 1,
      runtime: 1,
      model: 2,
      analysis: 2,
    },
  });
  expect(harness.api.saveConfiguration).toHaveBeenCalledWith({
    clientId: 'client-a',
    clientSecret: '',
    modelUrn: 'bmV3LW1vZGVs',
  });
  expect(harness.lifecycleCommands).toEqual([
    expect.objectContaining({ type: 'replace-model', changeType: 'urn-only' }),
  ]);
});

test('treats the first durable save as credential initialization and clears its submitted secret', async () => {
  const harness = createHarness();
  harness.controller.activateContext(contextA);
  await flushPromises();
  harness.controller.updateField('clientId', 'client-a');
  harness.controller.updateField('clientSecret', 'first-secret');
  harness.controller.updateField('modelUrn', 'dGVzdC1tb2RlbA');
  harness.api.saveConfiguration.mockResolvedValueOnce({
    configured: true,
    configuration: savedConfiguration,
    changeType: 'credential-replacement',
  });

  await expect(harness.controller.save()).resolves.toBe(true);

  expect(harness.controller.getState()).toMatchObject({
    phase: 'ready',
    attempted: { clientSecret: '' },
    committed: savedConfiguration,
    generations: {
      configuration: 1,
      authentication: 1,
      runtime: 1,
      model: 1,
      analysis: 1,
    },
  });
  expect(harness.lifecycleCommands).toEqual([
    expect.objectContaining({ type: 'reset-runtime', changeType: 'credential-replacement' }),
  ]);
});

test.each([
  ['a non-empty secret with unchanged visible values', { clientSecret: 'replacement-secret' }],
  [
    'a changed Client ID with its required secret',
    { clientId: 'client-b', clientSecret: 'replacement-secret' },
  ],
])('requests controlled credential reset after durable save for %s', async (_label, edits) => {
  const harness = createHarness();
  await loadConfigured(harness);
  harness.lifecycleCommands.length = 0;
  for (const [field, value] of Object.entries(edits)) harness.controller.updateField(field, value);
  harness.api.saveConfiguration.mockResolvedValueOnce({
    configured: true,
    configuration: {
      clientId: edits.clientId ?? savedConfiguration.clientId,
      modelUrn: savedConfiguration.modelUrn,
      hasClientSecret: true,
    },
    changeType: 'credential-replacement',
  });

  await expect(harness.controller.save()).resolves.toBe(true);

  expect(harness.controller.getState()).toMatchObject({
    phase: 'ready',
    attempted: { clientSecret: '' },
    generations: {
      configuration: 2,
      authentication: 2,
      runtime: 2,
      model: 2,
      analysis: 2,
    },
  });
  expect(harness.lifecycleCommands).toEqual([
    expect.objectContaining({ type: 'reset-runtime', changeType: 'credential-replacement' }),
  ]);
});

test('preserves committed state, generations, and the attempted secret when save fails', async () => {
  const harness = createHarness();
  await loadConfigured(harness);
  harness.lifecycleCommands.length = 0;
  harness.controller.updateField('clientId', 'client-b');
  harness.controller.updateField('clientSecret', 'attempted-secret');
  harness.controller.updateField('modelUrn', 'bmV3LW1vZGVs');
  const before = harness.controller.getState();
  harness.api.saveConfiguration.mockRejectedValueOnce({
    response: {
      data: {
        message: 'APS settings were not saved. Try again.',
        fieldErrors: { clientSecret: 'Check the APS Client Secret.' },
      },
    },
  });

  await expect(harness.controller.save()).resolves.toBe(false);

  expect(harness.controller.getState()).toMatchObject({
    phase: 'save-error',
    attempted: before.attempted,
    committed: before.committed,
    generations: before.generations,
    message: 'APS settings were not saved. Try again.',
    fieldErrors: { clientSecret: 'Check the APS Client Secret.' },
  });
  expect(harness.lifecycleCommands).toEqual([]);
});

test('prevents concurrent saves and preserves newer form edits after the active save succeeds', async () => {
  const deferred = createDeferred();
  const harness = createHarness();
  await loadConfigured(harness);
  harness.lifecycleCommands.length = 0;
  harness.controller.updateField('clientSecret', 'submitted-secret');
  harness.api.saveConfiguration.mockReturnValueOnce(deferred.promise);

  const activeSave = harness.controller.save();
  expect(harness.controller.getState().phase).toBe('saving');
  await expect(harness.controller.save()).resolves.toBe(false);
  harness.controller.updateField('modelUrn', 'bmV3ZXItZWRpdA');
  harness.controller.updateField('clientSecret', 'newer-secret');
  deferred.resolve({
    configured: true,
    configuration: savedConfiguration,
    changeType: 'credential-replacement',
  });
  await activeSave;

  expect(harness.api.saveConfiguration).toHaveBeenCalledTimes(1);
  expect(harness.controller.getState().attempted).toMatchObject({
    clientSecret: 'newer-secret',
    modelUrn: 'bmV3ZXItZWRpdA',
  });
});

test('ignores older read and save completions after a user/workspace context change', async () => {
  const oldRead = createDeferred();
  const newRead = createDeferred();
  const latestRead = createDeferred();
  const harness = createHarness({
    getConfiguration: vi
      .fn()
      .mockReturnValueOnce(oldRead.promise)
      .mockReturnValueOnce(newRead.promise)
      .mockReturnValueOnce(latestRead.promise),
  });

  harness.controller.activateContext(contextA);
  harness.controller.activateContext(contextB);
  oldRead.resolve({ configured: true, configuration: savedConfiguration });
  await flushPromises();
  expect(harness.controller.getState()).toMatchObject({ phase: 'loading', context: contextB });
  expect(harness.lifecycleCommands).toEqual([]);

  newRead.resolve({ configured: false, configuration: null });
  await flushPromises();
  expect(harness.controller.getState()).toMatchObject({ phase: 'empty', context: contextB });

  harness.controller.updateField('clientId', 'client-b');
  harness.controller.updateField('clientSecret', 'attempted-secret');
  harness.controller.updateField('modelUrn', 'dGVzdC1tb2RlbA');
  const oldSave = createDeferred();
  harness.api.saveConfiguration.mockReturnValueOnce(oldSave.promise);
  const pending = harness.controller.save();
  harness.controller.activateContext(contextA);
  oldSave.resolve({
    configured: true,
    configuration: savedConfiguration,
    changeType: 'credential-replacement',
  });
  await pending;

  expect(harness.controller.getState()).toMatchObject({ phase: 'loading', context: contextA });
  expect(harness.lifecycleCommands).toEqual([]);
});

test('publishes nothing after logout clears a pending read or save context', async () => {
  const read = createDeferred();
  const harness = createHarness({ getConfiguration: vi.fn().mockReturnValue(read.promise) });
  harness.controller.activateContext(contextA);
  harness.controller.clearContext();
  read.resolve({ configured: true, configuration: savedConfiguration });
  await flushPromises();

  expect(harness.controller.getState()).toMatchObject({ phase: 'idle', context: null });
  expect(harness.lifecycleCommands).toEqual([]);
});

test('fails closed when a save response has an unrecognized lifecycle classification', async () => {
  const harness = createHarness();
  await loadConfigured(harness);
  harness.lifecycleCommands.length = 0;
  const before = harness.controller.getState();
  harness.api.saveConfiguration.mockResolvedValueOnce({
    configured: true,
    configuration: { ...savedConfiguration, modelUrn: 'bmV3LW1vZGVs' },
    changeType: 'unexpected-change',
  });

  await expect(harness.controller.save()).resolves.toBe(false);

  expect(harness.controller.getState()).toMatchObject({
    phase: 'save-error',
    committed: before.committed,
    generations: before.generations,
    message: 'The saved APS settings response could not be verified. Reload the page and try again.',
  });
  expect(harness.lifecycleCommands).toEqual([]);
});

test('retains and emits only whitelisted non-secret configuration fields', async () => {
  const harness = createHarness({
    getConfiguration: vi.fn().mockResolvedValue({
      configured: true,
      configuration: {
        ...savedConfiguration,
        clientSecret: 'must-not-enter-browser-state',
        accessToken: 'must-not-enter-browser-state',
        secretEnvelope: { ciphertext: 'must-not-enter-browser-state' },
      },
    }),
  });

  harness.controller.activateContext(contextA);
  await flushPromises();

  expect(harness.controller.getState().committed).toEqual(savedConfiguration);
  expect(harness.lifecycleCommands[0].configuration).toEqual(savedConfiguration);

  harness.api.saveConfiguration.mockResolvedValueOnce({
    configured: true,
    configuration: {
      ...savedConfiguration,
      clientSecret: 'must-not-enter-browser-state',
      accessToken: 'must-not-enter-browser-state',
    },
    changeType: 'urn-only',
  });
  await harness.controller.save();

  expect(harness.controller.getState().committed).toEqual(savedConfiguration);
  expect(harness.lifecycleCommands[1].configuration).toEqual(savedConfiguration);
  expect(JSON.stringify(harness.controller.getState())).not.toContain('must-not-enter-browser-state');
  expect(JSON.stringify(harness.lifecycleCommands)).not.toContain('must-not-enter-browser-state');
});
