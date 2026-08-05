import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, test, vi } from 'vitest';
import ApsViewerHost from '../features/aps/viewer/ApsViewerHost';

afterEach(cleanup);

function createCoordinator(snapshot) {
  return {
    attachHost: vi.fn(),
    dispose: vi.fn().mockResolvedValue(undefined),
    getSnapshot: vi.fn(() => snapshot),
    retry: vi.fn().mockResolvedValue(undefined),
    subscribe: vi.fn(() => () => {}),
  };
}

test('owns one Viewer host element and releases lifecycle ownership on unmount', () => {
  const coordinator = createCoordinator({
    phase: 'idle',
    message: 'Save APS settings to load a 3D model.',
  });

  const view = render(<ApsViewerHost coordinator={coordinator} />);

  const region = screen.getByRole('region', { name: '3D model viewer' });
  const host = region.querySelector('[data-aps-viewer-host]');
  expect(host).toBeInstanceOf(HTMLDivElement);
  expect(coordinator.attachHost).toHaveBeenCalledWith(host);
  expect(screen.getByRole('status').textContent).toContain(
    'Save APS settings to load a 3D model.',
  );

  view.unmount();
  expect(coordinator.dispose).toHaveBeenCalledTimes(1);
});

test('shows actionable load failure feedback and exposes a keyboard retry action', async () => {
  const coordinator = createCoordinator({
    phase: 'load-failed',
    message: 'The configured model could not be opened. Verify its URN and retry.',
  });
  render(<ApsViewerHost coordinator={coordinator} />);

  expect(screen.getByRole('alert').textContent).toContain(
    'The configured model could not be opened. Verify its URN and retry.',
  );
  await userEvent.setup().click(screen.getByRole('button', { name: 'Retry loading model' }));
  expect(coordinator.retry).toHaveBeenCalledTimes(1);
});

test('announces a category-analysis failure and offers a keyboard-operable retry without hiding readiness', async () => {
  const coordinator = createCoordinator({
    phase: 'ready',
    tone: 'error',
    message: 'Doors could not be analyzed. Retry loading the model or verify its structure.',
  });
  render(<ApsViewerHost coordinator={coordinator} />);

  expect(screen.getByRole('alert').textContent).toContain('Doors could not be analyzed.');
  await userEvent.setup().click(screen.getByRole('button', { name: 'Retry loading model' }));
  expect(coordinator.retry).toHaveBeenCalledTimes(1);
});
