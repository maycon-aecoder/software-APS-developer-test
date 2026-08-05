import { expect, test } from 'vitest';

import {
  apsSettingsReducer,
  createInitialApsSettingsState,
} from '../features/aps/settings/apsSettingsReducer';

test('a failed save preserves the exact committed configuration and generation context', () => {
  const committed = {
    clientId: 'client-a',
    modelUrn: 'dGVzdC1tb2RlbA',
    hasClientSecret: true,
  };
  const generations = {
    configuration: 4,
    authentication: 2,
    runtime: 2,
    model: 4,
    analysis: 4,
  };
  const before = {
    ...createInitialApsSettingsState(),
    phase: 'saving',
    attempted: {
      clientId: 'client-b',
      clientSecret: 'attempted-secret',
      modelUrn: 'bmV3LW1vZGVs',
    },
    committed,
    generations,
  };

  const after = apsSettingsReducer(before, {
    type: 'save-failed',
    message: 'APS settings were not saved. Try again.',
    fieldErrors: { clientSecret: 'Check the APS Client Secret.' },
  });

  expect(after).toMatchObject({
    phase: 'save-error',
    attempted: before.attempted,
    committed,
    generations,
  });
  expect(after.committed).toBe(committed);
  expect(after.generations).toBe(generations);
});

test('clearing an authenticated context removes attempted secrets while keeping counters monotonic', () => {
  const generations = {
    configuration: 3,
    authentication: 2,
    runtime: 2,
    model: 3,
    analysis: 3,
  };
  const before = {
    ...createInitialApsSettingsState(),
    phase: 'saving',
    context: { userId: 'user-a', workspaceId: 'workspace-a' },
    attempted: {
      clientId: 'client-a',
      clientSecret: 'attempted-secret',
      modelUrn: 'dGVzdC1tb2RlbA',
    },
    committed: {
      clientId: 'client-a',
      modelUrn: 'dGVzdC1tb2RlbA',
      hasClientSecret: true,
    },
    generations,
  };

  const after = apsSettingsReducer(before, { type: 'context-cleared' });

  expect(after).toMatchObject({
    phase: 'idle',
    context: null,
    attempted: { clientId: '', clientSecret: '', modelUrn: '' },
    committed: null,
    generations,
  });
  expect(after.generations).toBe(generations);
});
