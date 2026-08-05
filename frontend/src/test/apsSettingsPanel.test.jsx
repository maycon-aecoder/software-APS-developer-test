import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, test, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';

import axiosInstance from '../api/axiosInstance';
import { AuthProvider } from '../context/AuthContext';
import ApsSettingsPanel from '../features/aps/settings/ApsSettingsPanel';
import { createApsSettingsController } from '../features/aps/settings/createApsSettingsController';
import HomePage from '../pages/HomePage';
import { createDeferred } from './fixtures/viewerDoubles';
const context = Object.freeze({ userId: 'user-a', workspaceId: 'workspace-a' });

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  localStorage.clear();
});

function renderPanel(api) {
  const lifecycleCommands = [];
  const controller = createApsSettingsController?.({
    api,
    onLifecycleCommand: (command) => lifecycleCommands.push(command),
  });
  render(<ApsSettingsPanel controller={controller} context={context} />);
  return { controller, lifecycleCommands };
}

test('shows accessible loading then first-time settings without requesting Viewer lifecycle work', async () => {
  const deferred = createDeferred();
  const api = {
    getConfiguration: vi.fn().mockReturnValue(deferred.promise),
    saveConfiguration: vi.fn(),
  };
  const { lifecycleCommands } = renderPanel(api);

  expect(screen.getByRole('status').textContent).toContain('Loading saved APS settings');
  deferred.resolve({ configured: false, configuration: null });

  expect(await screen.findByRole('heading', { name: 'APS model settings' })).toBeTruthy();
  expect(screen.getByLabelText('APS Client ID').required).toBe(true);
  expect(screen.getByLabelText('APS Client Secret').getAttribute('type')).toBe('password');
  expect(screen.getByLabelText('APS Client Secret').getAttribute('autocomplete')).toBe('new-password');
  expect(screen.getByLabelText('Model URN').required).toBe(true);
  expect(screen.getByRole('button', { name: 'Save APS settings' }).disabled).toBe(false);
  expect(lifecycleCommands).toEqual([]);
});

test('shows saved non-secret values and configured-secret guidance without secret readback', async () => {
  const api = {
    getConfiguration: vi.fn().mockResolvedValue({
      configured: true,
      configuration: {
        clientId: 'client-a',
        modelUrn: 'dGVzdC1tb2RlbA',
        hasClientSecret: true,
      },
    }),
    saveConfiguration: vi.fn(),
  };
  renderPanel(api);

  expect(await screen.findByDisplayValue('client-a')).toBeTruthy();
  expect(screen.getByDisplayValue('dGVzdC1tb2RlbA')).toBeTruthy();
  expect(screen.getByLabelText('APS Client Secret').value).toBe('');
  expect(screen.getByText('A Client Secret is saved. Leave this field blank to keep it.')).toBeTruthy();
});

test('keeps the shell-safe read error distinct and retries from an accessible action', async () => {
  const api = {
    getConfiguration: vi
      .fn()
      .mockRejectedValueOnce({
        response: { data: { message: 'Saved APS settings could not be loaded. Try again.' } },
      })
      .mockResolvedValueOnce({ configured: false, configuration: null }),
    saveConfiguration: vi.fn(),
  };
  renderPanel(api);

  expect(await screen.findByText('Saved APS settings could not be loaded. Try again.')).toBeTruthy();
  expect(screen.queryByLabelText('APS Client ID')).toBeNull();
  await userEvent.setup().click(screen.getByRole('button', { name: 'Retry loading settings' }));
  expect(await screen.findByLabelText('APS Client ID')).toBeTruthy();
  expect(api.getConfiguration).toHaveBeenCalledTimes(2);
});

test('disables duplicate submission, renders field guidance, and preserves attempted secret on failure', async () => {
  const save = createDeferred();
  const api = {
    getConfiguration: vi.fn().mockResolvedValue({ configured: false, configuration: null }),
    saveConfiguration: vi.fn().mockReturnValue(save.promise),
  };
  renderPanel(api);
  const user = userEvent.setup();

  await user.type(await screen.findByLabelText('APS Client ID'), 'client-a');
  await user.type(screen.getByLabelText('APS Client Secret'), 'attempted-secret');
  await user.type(screen.getByLabelText('Model URN'), 'invalid urn');
  await user.click(screen.getByRole('button', { name: 'Save APS settings' }));

  expect(screen.getByRole('button', { name: 'Saving APS settings' }).disabled).toBe(true);
  expect(api.saveConfiguration).toHaveBeenCalledTimes(1);
  save.reject({
    response: {
      data: {
        message: 'Check the Model URN and try again.',
        fieldErrors: { modelUrn: 'Enter an unpadded Base64URL source-design URN.' },
      },
    },
  });

  expect(await screen.findByText('Check the Model URN and try again.')).toBeTruthy();
  expect(screen.getByText('Enter an unpadded Base64URL source-design URN.')).toBeTruthy();
  expect(screen.getByLabelText('APS Client Secret').value).toBe('attempted-secret');
  expect(screen.getByLabelText('Model URN').getAttribute('aria-invalid')).toBe('true');
});

test('clears the submitted secret only after successful durable save and announces success', async () => {
  const api = {
    getConfiguration: vi.fn().mockResolvedValue({ configured: false, configuration: null }),
    saveConfiguration: vi.fn().mockResolvedValue({
      configured: true,
      configuration: {
        clientId: 'client-a',
        modelUrn: 'dGVzdC1tb2RlbA',
        hasClientSecret: true,
      },
      changeType: 'credential-replacement',
    }),
  };
  renderPanel(api);
  const user = userEvent.setup();

  await user.type(await screen.findByLabelText('APS Client ID'), 'client-a');
  await user.type(screen.getByLabelText('APS Client Secret'), 'attempted-secret');
  await user.type(screen.getByLabelText('Model URN'), 'dGVzdC1tb2RlbA');
  await user.click(screen.getByRole('button', { name: 'Save APS settings' }));

  await waitFor(() => expect(screen.getByLabelText('APS Client Secret').value).toBe(''));
  expect(screen.getByRole('status').textContent).toContain(
    'APS settings saved. Preparing the configured model with the updated credentials.',
  );
});

test('integrates settings into the authenticated home while preserving the existing shell', async () => {
  localStorage.setItem('token', 'synthetic-application-token');
  localStorage.setItem('user', JSON.stringify({
    id: 'user-a',
    name: 'Jane Doe',
    email: 'jane@example.com',
  }));
  vi.spyOn(axiosInstance, 'get').mockResolvedValue({
    data: { configured: false, configuration: null },
  });

  render(
    <MemoryRouter
      initialEntries={['/home']}
      future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
    >
      <AuthProvider>
        <HomePage />
      </AuthProvider>
    </MemoryRouter>,
  );

  expect(screen.getByRole('banner')).toBeTruthy();
  expect(screen.getByRole('link', { name: 'Dashboard' })).toBeTruthy();
  expect(screen.getByRole('button', { name: 'User menu' })).toBeTruthy();
  expect(screen.getByRole('heading', { name: /Welcome, Jane Doe/ })).toBeTruthy();
  expect(await screen.findByRole('heading', { name: 'APS model settings' })).toBeTruthy();
  expect(screen.getByRole('region', { name: '3D model viewer' })).toBeTruthy();
  expect(screen.getByRole('region', { name: 'Door and Window quantities' })).toBeTruthy();
});

test('keeps the authenticated shell usable when account context is unavailable', () => {
  localStorage.setItem('token', 'synthetic-application-token');
  const get = vi.spyOn(axiosInstance, 'get');

  render(
    <MemoryRouter
      initialEntries={['/home']}
      future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
    >
      <AuthProvider>
        <HomePage />
      </AuthProvider>
    </MemoryRouter>,
  );

  expect(screen.getByRole('banner')).toBeTruthy();
  expect(screen.getByRole('link', { name: 'Dashboard' })).toBeTruthy();
  expect(screen.getByText(
    'Your account details could not be loaded. Sign out and sign in again before configuring APS.',
  )).toBeTruthy();
  expect(get).not.toHaveBeenCalled();
});
