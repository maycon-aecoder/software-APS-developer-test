import { expect, test } from 'vitest';
import {
  resolveCategoryAlias,
  resolveCategoryInstances,
} from '../features/aps/analysis/categoryResolver';

test.each([
  ['Furniture', 'Furniture'],
  ['  revit furniture  ', 'Furniture'],
  ['WALLS', 'Walls'],
  [' Revit Walls ', 'Walls'],
  ['doors', 'Doors'],
  ['REVIT DOORS', 'Doors'],
  ['Windows', 'Windows'],
  ['revit windows', 'Windows'],
])('resolves the approved exact alias %s to %s', (value, expected) => {
  expect(resolveCategoryAlias(value)).toBe(expected);
});

test.each([
  'Furniture Systems',
  'Door',
  'Revit Window',
  'Localized Furniture',
  'Wall-Exterior',
  '',
  null,
])('rejects unsupported, partial, translated, or non-text category value %s', (value) => {
  expect(resolveCategoryAlias(value)).toBeNull();
});

test('retains unique proven instances without assuming that an instance is a leaf', () => {
  const candidates = [
    { dbId: 11, categoryValues: [' Revit Doors '], classification: 'instance', childCount: 2 },
    { dbId: 11, categoryValues: ['Doors'], classification: 'instance', childCount: 2 },
    { dbId: 12, categoryValues: ['DOORS'], classification: 'instance', childCount: 0 },
    { dbId: 13, categoryValues: ['Doors'], classification: 'excluded', kind: 'type' },
    { dbId: 14, categoryValues: ['Doors'], classification: 'excluded', kind: 'category' },
    { dbId: 15, categoryValues: ['Doors'], classification: 'excluded', kind: 'container' },
    { dbId: 16, categoryValues: [], classification: 'instance', kind: 'nested-part' },
  ];

  expect(resolveCategoryInstances(candidates, 'Doors')).toEqual([11, 12]);
});

test('does not accept a terminal record merely because it is a leaf', () => {
  const candidates = [
    { dbId: 21, categoryValues: ['Walls'], classification: 'excluded', childCount: 0 },
  ];

  expect(resolveCategoryInstances(candidates, 'Walls')).toEqual([]);
});

test('fails only the affected category when matching identity evidence is insufficient', () => {
  const candidates = [
    { dbId: 31, categoryValues: ['Doors'], classification: 'unknown' },
    { dbId: 32, categoryValues: ['Furniture'], classification: 'instance' },
  ];

  expect(() => resolveCategoryInstances(candidates, 'Doors')).toThrow(
    expect.objectContaining({ code: 'APS_CATEGORY_ANALYSIS_FAILED' }),
  );
  expect(resolveCategoryInstances(candidates, 'Furniture')).toEqual([32]);
});

test('fails conservatively when one record claims more than one supported category', () => {
  const candidates = [
    {
      dbId: 41,
      categoryValues: ['Doors', 'Revit Windows'],
      classification: 'instance',
    },
  ];

  expect(() => resolveCategoryInstances(candidates, 'Doors')).toThrow(
    expect.objectContaining({ code: 'APS_CATEGORY_ANALYSIS_FAILED' }),
  );
});
