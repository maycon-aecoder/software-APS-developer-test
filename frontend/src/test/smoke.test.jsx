import { useState } from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, test } from 'vitest';

import {
  createBubbleNode,
  createDeferred,
  createPropertyFixture,
  createToolbarDouble,
  createViewerDouble,
} from './fixtures/viewerDoubles';

afterEach(cleanup);

function SmokeControl() {
  const [active, setActive] = useState(false);

  return (
    <button type="button" onClick={() => setActive(true)}>
      {active ? 'Viewer tooling ready' : 'Prepare Viewer tooling'}
    </button>
  );
}

test('frontend test tooling imports Viewer doubles and supports user interaction', async () => {
  const user = userEvent.setup();
  const viewer = createViewerDouble();
  const toolbar = createToolbarDouble();
  const deferred = createDeferred();

  render(<SmokeControl />);
  await user.click(screen.getByRole('button', { name: 'Prepare Viewer tooling' }));

  viewer.clearThemingColors();
  toolbar.addControl({ id: 'test-control' });
  deferred.resolve('current generation');

  expect(screen.getByRole('button', { name: 'Viewer tooling ready' })).toBeTruthy();
  expect(createBubbleNode({ is3D: true }).is3D()).toBe(true);
  expect(createPropertyFixture().dbId).toBe(1);
  expect(viewer.calls).toEqual([['clearThemingColors']]);
  expect(toolbar.controls.has('test-control')).toBe(true);
  await expect(deferred.promise).resolves.toBe('current generation');
});
