import { existsSync } from 'node:fs';
import path from 'node:path';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, test, vi } from 'vitest';

const subjectPath = path.resolve(process.cwd(), 'src/features/aps/viewer/ApsViewerHost.jsx');
const subject = existsSync(subjectPath)
  ? await import(/* @vite-ignore */ subjectPath)
  : { default: () => null };
const { default: ApsViewerHost } = subject;

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

  expect(screen.getByText(
    'The configured model could not be opened. Verify its URN and retry.',
  )).toBeTruthy();
  await userEvent.setup().click(screen.getByRole('button', { name: 'Retry loading model' }));
  expect(coordinator.retry).toHaveBeenCalledTimes(1);
});
