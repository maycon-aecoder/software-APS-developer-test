import { afterEach, describe, expect, test, vi } from 'vitest';

import { createViewerTokenProvider } from '../features/aps/viewer/createViewerTokenProvider';
import { createDeferred } from './fixtures/viewerDoubles';

const baseContext = Object.freeze({
  userId: 'user-a',
  workspaceId: 'workspace-a',
  authenticationGeneration: 1,
  runtimeGeneration: 1,
});

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
  sessionStorage.clear();
});

function flushPromises() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

test('delivers the current token and positive lifetime only through onTokenReady', async () => {
  const requestToken = vi.fn().mockResolvedValue({
    accessToken: 'synthetic-access-token',
    expiresIn: 3599,
  });
  const setItem = vi.spyOn(Storage.prototype, 'setItem');
  const provider = createViewerTokenProvider({ requestToken });
  const registration = provider.registerContext(baseContext);
  const onTokenReady = vi.fn();

  const returnValue = registration.getAccessToken(onTokenReady);
  await flushPromises();

  expect(returnValue).toBeUndefined();
  expect(requestToken).toHaveBeenCalledTimes(1);
  expect(requestToken).toHaveBeenCalledWith();
  expect(onTokenReady).toHaveBeenCalledWith('synthetic-access-token', 3599);
  expect(setItem).not.toHaveBeenCalled();
});

test('uses the same callback for ordinary Viewer-requested renewal without lifecycle work', async () => {
  const requestToken = vi
    .fn()
    .mockResolvedValueOnce({ accessToken: 'synthetic-token-1', expiresIn: 100 })
    .mockResolvedValueOnce({ accessToken: 'synthetic-token-2', expiresIn: 200 });
  const provider = createViewerTokenProvider({ requestToken });
  const registration = provider.registerContext(baseContext);
  const onTokenReady = vi.fn();

  registration.getAccessToken(onTokenReady);
  await flushPromises();
  registration.getAccessToken(onTokenReady);
  await flushPromises();

  expect(requestToken).toHaveBeenCalledTimes(2);
  expect(onTokenReady.mock.calls).toEqual([
    ['synthetic-token-1', 100],
    ['synthetic-token-2', 200],
  ]);
  expect(provider).not.toHaveProperty('shutdown');
  expect(provider).not.toHaveProperty('setToken');
});

describe.each([
  ['user', { userId: 'user-b' }],
  ['workspace', { workspaceId: 'workspace-b' }],
  ['authentication generation', { authenticationGeneration: 2 }],
  ['runtime generation', { runtimeGeneration: 2 }],
])('stale %s context', (_label, changedContext) => {
  test('discards an older successful token', async () => {
    const deferred = createDeferred();
    const requestToken = vi.fn().mockReturnValueOnce(deferred.promise);
    const provider = createViewerTokenProvider({ requestToken });
    const oldRegistration = provider.registerContext(baseContext);
    const oldOnTokenReady = vi.fn();

    oldRegistration.getAccessToken(oldOnTokenReady);
    await flushPromises();
    provider.registerContext({ ...baseContext, ...changedContext });
    deferred.resolve({ accessToken: 'stale-token', expiresIn: 3599 });
    await flushPromises();

    expect(oldOnTokenReady).not.toHaveBeenCalled();
  });
});

test('discards an obsolete failure and notifies only the current registered workspace', async () => {
  const staleDeferred = createDeferred();
  const currentDeferred = createDeferred();
  const requestToken = vi
    .fn()
    .mockReturnValueOnce(staleDeferred.promise)
    .mockReturnValueOnce(currentDeferred.promise);
  const staleNotify = vi.fn();
  const currentNotify = vi.fn();
  const replacementNotify = vi.fn();
  const provider = createViewerTokenProvider({ requestToken });
  const staleRegistration = provider.registerContext({
    ...baseContext,
    onError: staleNotify,
  });
  staleRegistration.getAccessToken(vi.fn());
  await flushPromises();

  const currentContext = {
    ...baseContext,
    workspaceId: 'workspace-b',
    onError: currentNotify,
  };
  const currentRegistration = provider.registerContext(currentContext);
  currentContext.onError = replacementNotify;
  currentRegistration.getAccessToken(vi.fn());
  await flushPromises();
  staleDeferred.reject(Object.assign(new Error('raw stale failure'), {
    code: 'APS_TOKEN_TEMPORARY_FAILURE',
  }));
  currentDeferred.reject({
    response: {
      data: {
        code: 'APS_CREDENTIALS_REJECTED',
        message: 'raw current failure must not be forwarded',
      },
    },
  });
  await flushPromises();

  expect(staleNotify).not.toHaveBeenCalled();
  expect(currentNotify).toHaveBeenCalledWith({ code: 'APS_CREDENTIALS_REJECTED' });
  expect(replacementNotify).not.toHaveBeenCalled();
});

test('stops safely without requesting or publishing when its context is released', async () => {
  const requestToken = vi.fn().mockResolvedValue({
    accessToken: 'synthetic-access-token',
    expiresIn: 3599,
  });
  const notify = vi.fn();
  const provider = createViewerTokenProvider({ requestToken });
  const registration = provider.registerContext({ ...baseContext, onError: notify });
  const onTokenReady = vi.fn();
  registration.release();

  registration.getAccessToken(onTokenReady);
  await flushPromises();

  expect(requestToken).not.toHaveBeenCalled();
  expect(onTokenReady).not.toHaveBeenCalled();
  expect(notify).not.toHaveBeenCalled();
});

test('logout-style clear discards an already pending token result', async () => {
  const deferred = createDeferred();
  const provider = createViewerTokenProvider({
    requestToken: vi.fn().mockReturnValue(deferred.promise),
  });
  const registration = provider.registerContext(baseContext);
  const onTokenReady = vi.fn();
  registration.getAccessToken(onTokenReady);
  await flushPromises();

  provider.clear();
  deferred.resolve({ accessToken: 'stale-token', expiresIn: 3599 });
  await flushPromises();

  expect(onTokenReady).not.toHaveBeenCalled();
});

test('clear before the request microtask prevents an obsolete backend token request', async () => {
  const requestToken = vi.fn().mockResolvedValue({
    accessToken: 'synthetic-access-token',
    expiresIn: 3599,
  });
  const provider = createViewerTokenProvider({ requestToken });
  const registration = provider.registerContext(baseContext);

  registration.getAccessToken(vi.fn());
  provider.clear();
  await flushPromises();

  expect(requestToken).not.toHaveBeenCalled();
});

const invalidTokenResults = [
  { accessToken: '', expiresIn: 3599 },
  { accessToken: 'synthetic-access-token', expiresIn: 0 },
  { accessToken: 'synthetic-access-token', expiresIn: '3599' },
];

test.each(invalidTokenResults)(
  'does not deliver an invalid backend token result %#',
  async (tokenResult) => {
    const notify = vi.fn();
    const provider = createViewerTokenProvider({
      requestToken: vi.fn().mockResolvedValue(tokenResult),
    });
    const registration = provider.registerContext({ ...baseContext, onError: notify });
    const onTokenReady = vi.fn();

    registration.getAccessToken(onTokenReady);
    await flushPromises();

    expect(onTokenReady).not.toHaveBeenCalled();
    expect(notify).toHaveBeenCalledWith({ code: 'APS_TOKEN_INVALID_RESPONSE' });
  },
);
