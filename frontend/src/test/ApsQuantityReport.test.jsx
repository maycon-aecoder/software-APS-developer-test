import React from 'react';
import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, expect, test } from 'vitest';

import ApsQuantityReport from '../features/aps/quantity/ApsQuantityReport';

afterEach(cleanup);

function renderReport(quantities = {}) {
  render(<ApsQuantityReport quantities={quantities} />);
  return screen.getByRole('region', { name: 'Door and Window quantities' });
}

function getCard(region, name) {
  return within(region).getByRole('article', { name });
}

test('labels both pending quantity cards without displaying a guessed zero', () => {
  const region = renderReport();

  expect(getCard(region, 'Doors').getAttribute('aria-live')).toBe('polite');
  expect(getCard(region, 'Doors').textContent).toContain('Waiting for model analysis');
  expect(getCard(region, 'Windows').textContent).toContain('Waiting for model analysis');
  expect(region.textContent).not.toContain('Count 0');
});

test('shows a safe count while Area analysis remains in progress', () => {
  const region = renderReport({
    Doors: {
      area: { status: 'loading', total: null, unit: null },
      category: 'Doors',
      count: 2,
      status: 'analyzing',
    },
  });
  const doors = getCard(region, 'Doors');

  expect(doors.textContent).toContain('Count 2');
  expect(doors.textContent).toContain('Calculating Area');
});

test('renders complete unit-bearing and unitless totals without inventing formatting', () => {
  const region = renderReport({
    Doors: {
      area: { status: 'complete', total: 3.5, unit: 'm²' },
      category: 'Doors',
      count: 2,
      status: 'ready',
    },
    Windows: {
      area: { status: 'complete', total: 4, unit: null },
      category: 'Windows',
      count: 1,
      status: 'ready',
    },
  });

  expect(getCard(region, 'Doors').textContent).toContain('Area 3.5 m²');
  expect(getCard(region, 'Windows').textContent).toContain('Area 4');
  expect(getCard(region, 'Windows').textContent).not.toContain('undefined');
});

test('explains a partial subtotal as expected model data, not an operational failure', () => {
  const region = renderReport({
    Doors: {
      area: { status: 'partial', total: 2, unit: 'm²' },
      category: 'Doors',
      count: 3,
      status: 'ready',
    },
  });
  const doors = getCard(region, 'Doors');

  expect(doors.textContent).toContain('Area subtotal 2 m²');
  expect(doors.textContent).toContain('Some Door elements do not provide one usable Area value.');
  expect(within(doors).queryByRole('alert')).toBeNull();
});

test('distinguishes zero matches from unavailable Area with matched elements', () => {
  const region = renderReport({
    Doors: {
      area: { status: 'unavailable', total: null, unit: null },
      category: 'Doors',
      count: 0,
      status: 'ready',
    },
    Windows: {
      area: { status: 'unavailable', total: null, unit: null },
      category: 'Windows',
      count: 2,
      status: 'ready',
    },
  });

  expect(getCard(region, 'Doors').textContent).toContain('Count 0');
  expect(getCard(region, 'Doors').textContent).toContain('No Door elements were found');
  expect(getCard(region, 'Windows').textContent).toContain('Count 2');
  expect(getCard(region, 'Windows').textContent).toContain(
    'A safe Window Area total is unavailable because the model values or units are incomplete or incompatible.',
  );
});

test('shows count failure as unavailable without fabricating Area', () => {
  const region = renderReport({
    Doors: { category: 'Doors', count: null, status: 'failed' },
  });
  const doors = getCard(region, 'Doors');

  expect(doors.textContent).toContain('Count Unavailable');
  expect(doors.textContent).not.toContain('Count 0');
  expect(doors.textContent).not.toContain('Area 0');
  expect(within(doors).getByRole('alert').textContent).toContain(
    'Door quantity could not be determined. Retry loading the model or verify its category structure.',
  );
  expect(doors.getAttribute('aria-live')).toBeNull();
  expect(doors.parentElement.getAttribute('aria-live')).toBeNull();
});

test('retains count and publishes no subtotal after operational Area failure', () => {
  const region = renderReport({
    Doors: {
      area: { status: 'failed', total: null, unit: null },
      category: 'Doors',
      count: 2,
      status: 'ready',
    },
  });
  const doors = getCard(region, 'Doors');

  expect(doors.textContent).toContain('Count 2');
  expect(doors.textContent).not.toContain('subtotal');
  expect(within(doors).getByRole('alert').textContent).toContain(
    'The Door count is available, but its Area could not be calculated. Retry loading the model.',
  );
});
