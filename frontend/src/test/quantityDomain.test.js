import { existsSync } from 'node:fs';
import path from 'node:path';
import { expect, test } from 'vitest';

const subjectPath = path.resolve(
  process.cwd(),
  'src/features/aps/analysis/quantityDomain.js',
);
const subject = existsSync(subjectPath)
  ? await import(/* @vite-ignore */ subjectPath)
  : {
      countUniqueInstances: () => undefined,
      createAreaElementRows: () => undefined,
      createAreaReport: () => undefined,
      parseAreaValue: () => undefined,
    };
const {
  countUniqueInstances,
  createAreaElementRows,
  createAreaReport,
  parseAreaValue,
} = subject;

function areaProperty(displayValue, overrides = {}) {
  return {
    displayName: 'Area',
    displayValue,
    units: 'm²',
    ...overrides,
  };
}

function result(dbId, properties) {
  return { dbId, properties };
}

test('creates ordered public element rows with exact individual Area values and accessible fallbacks', () => {
  const rows = createAreaElementRows('Doors', [3, 3, 7, 9], [
    { ...result(3, [areaProperty('1.25')]), name: ' Single Door ' },
    { ...result(7, []), name: '   ' },
    { ...result(9, [areaProperty(2, { units: 'ft\u00B2' })]), name: null },
  ]);

  expect(rows).toEqual([
    { area: { status: 'available', unit: 'm\u00B2', value: 1.25 }, name: 'Single Door' },
    { area: { status: 'unavailable' }, name: 'Door element 2' },
    { area: { status: 'available', unit: 'ft\u00B2', value: 2 }, name: 'Door element 3' },
  ]);
  expect(JSON.stringify(rows)).not.toMatch(/dbId|properties|secret/i);
});

test('keeps ambiguous individual Area unavailable instead of guessing a value', () => {
  const rows = createAreaElementRows('Windows', [4], [{
    ...result(4, [
      areaProperty(2, { attributeName: 'a', type: 3 }),
      areaProperty(3, { attributeName: 'a', type: 3 }),
    ]),
    name: 'Window A',
  }]);

  expect(rows).toEqual([{ area: { status: 'unavailable' }, name: 'Window A' }]);
});

test.each([
  ['autodesk.unit.unit:squareMeters-1.0.1', 'm\u00B2'],
  ['autodesk.unit.unit:squareFeet-1.0.1', 'ft\u00B2'],
  ['autodesk.unit.unit:squareInches-1.0.1', 'in\u00B2'],
  ['autodesk.unit.unit:squareMillimeters-1.0.1', 'mm\u00B2'],
])('maps the documented Autodesk Area unit %s to the public label %s', (unit, label) => {
  const report = createAreaReport([1], [result(1, [areaProperty(2, { units: unit })])]);
  const rows = createAreaElementRows('Doors', [1], [{
    ...result(1, [areaProperty(2, { units: unit })]),
    name: 'Door A',
  }]);

  expect(report).toEqual({ status: 'complete', total: 2, unit: label });
  expect(rows[0].area).toEqual({ status: 'available', unit: label, value: 2 });
});

test('does not expose an unmapped Autodesk unit identifier', () => {
  const report = createAreaReport([1], [result(1, [
    areaProperty(2, { units: 'autodesk.unit.unit:unknownArea-1.0.0' }),
  ])]);

  expect(report).toEqual({ status: 'unavailable', total: null, unit: null });
});

test.each([
  [
    [
      areaProperty(2, { attributeName: 'revit.area', type: 3 }),
      areaProperty(2, { attributeName: 'revit.area', type: 3 }),
    ],
    'complete',
    'available',
  ],
  [[], 'unavailable', 'unavailable'],
  [[areaProperty(2, { units: ' m\u00B2 ' })], 'complete', 'available'],
])(
  'keeps aggregate %s and individual %s contribution decisions consistent',
  (properties, aggregateStatus, elementStatus) => {
    const records = [{ ...result(1, properties), name: 'Element A' }];
    expect(createAreaReport([1], records).status).toBe(aggregateStatus);
    expect(createAreaElementRows('Doors', [1], records)[0].area.status).toBe(elementStatus);
  },
);

test.each([
  [[], 0],
  [[1, 1, 2], 2],
  [[7], 1],
])('counts only unique proven leaf dbIds from %j', (dbIds, expected) => {
  expect(countUniqueInstances(dbIds)).toBe(expected);
});

test.each([
  null,
  [1, '2'],
  [1, 2.5],
])('rejects unproven instance identity input %j', (dbIds) => {
  expect(() => countUniqueInstances(dbIds)).toThrow();
});

test.each([
  [0, 0],
  [3.5, 3.5],
  [' 0 ', 0],
  ['+12', 12],
  ['12.5', 12.5],
  ['.5', 0.5],
  ['5.', 5],
  ['+.5', 0.5],
])('parses the approved complete Area value %j', (value, expected) => {
  expect(parseAreaValue(value)).toEqual({ valid: true, value: expected });
});

test.each([
  -1,
  true,
  false,
  Number.NaN,
  Number.POSITIVE_INFINITY,
  Number.NEGATIVE_INFINITY,
  '-1',
  '',
  '.',
  '+.',
  '1e3',
  '1,000',
  '12 m²',
  '１２',
  '0x10',
  null,
])('rejects the unsupported or unsafe Area value %j', (value) => {
  expect(parseAreaValue(value)).toEqual({ valid: false });
});

test('creates a complete compatible report from exact Area properties', () => {
  const report = createAreaReport([1, 2, 2], [
    result(1, [areaProperty('1.25', { displayName: ' area ', units: ' m² ' })]),
    result(2, [areaProperty(2.25)]),
  ]);

  expect(report).toEqual({ status: 'complete', total: 3.5, unit: 'm²' });
});

test('ignores inferred and non-exact Area names', () => {
  const report = createAreaReport([1], [
    result(1, [
      areaProperty(5, { displayName: 'Net Area' }),
      areaProperty(3, { attributeName: 'Area', displayName: 'Width' }),
    ]),
  ]);

  expect(report).toEqual({ status: 'unavailable', total: null, unit: null });
});

test('returns a safe partial subtotal when compatible valid and missing or invalid data coexist', () => {
  const report = createAreaReport([1, 2, 3], [
    result(1, [areaProperty(2)]),
    result(2, []),
    result(3, [areaProperty(-1)]),
  ]);

  expect(report).toEqual({ status: 'partial', total: 2, unit: 'm²' });
});

test('returns a safe partial subtotal when valid and ambiguous leaf data coexist', () => {
  const report = createAreaReport([1, 2], [
    result(1, [areaProperty(2)]),
    result(2, [
      areaProperty(3, { attributeName: 'a', type: 3 }),
      areaProperty(4, { attributeName: 'a', type: 3 }),
    ]),
  ]);

  expect(report).toEqual({ status: 'partial', total: 2, unit: 'm²' });
});

test.each([
  [[], [], { status: 'unavailable', total: null, unit: null }],
  [[1], [result(1, [])], { status: 'unavailable', total: null, unit: null }],
  [
    [1, 2],
    [result(1, [areaProperty(1, { units: 'm²' })]), result(2, [areaProperty(2, { units: 'm^2' })])],
    { status: 'unavailable', total: null, unit: null },
  ],
  [
    [1, 2],
    [result(1, [areaProperty(1, { units: '' })]), result(2, [areaProperty(2, { units: 'm²' })])],
    { status: 'unavailable', total: null, unit: null },
  ],
  [
    [1, 2],
    [result(1, [areaProperty(1, { units: 'm²' })]), result(2, [areaProperty(2, { units: 'M²' })])],
    { status: 'unavailable', total: null, unit: null },
  ],
])('returns unavailable when no compatible safe total exists', (dbIds, results, expected) => {
  expect(createAreaReport(dbIds, results)).toEqual(expected);
});

test('creates a complete unitless report when every contribution is unitless', () => {
  const report = createAreaReport([1, 2], [
    result(1, [areaProperty(1, { units: undefined })]),
    result(2, [areaProperty(2, { units: '  ' })]),
  ]);

  expect(report).toEqual({ status: 'complete', total: 3, unit: null });
});

test('accepts proven duplicate Area records once even across display categories', () => {
  const report = createAreaReport([1], [result(1, [
    areaProperty('2.5', {
      attributeName: 'revit.area',
      displayCategory: 'Dimensions',
      precision: 2,
      type: 3,
    }),
    areaProperty(2.5, {
      attributeName: 'revit.area',
      displayCategory: 'Other',
      precision: 4,
      type: 3,
    }),
  ])]);

  expect(report).toEqual({ status: 'complete', total: 2.5, unit: 'm²' });
});

test.each([
  [
    areaProperty(2, { displayCategory: 'Dimensions' }),
    areaProperty(2, { displayCategory: 'Dimensions' }),
  ],
  [
    areaProperty(2, { attributeName: 'a', type: 3 }),
    areaProperty(3, { attributeName: 'a', type: 3 }),
  ],
  [
    areaProperty(2, { attributeName: 'a', type: 3, units: 'm²' }),
    areaProperty(2, { attributeName: 'a', type: 3, units: 'ft²' }),
  ],
  [
    areaProperty(2, { attributeName: 'a', type: 3, units: '' }),
    areaProperty(2, { attributeName: 'a', type: 3, units: 'm²' }),
  ],
  [
    areaProperty(2, { attributeName: 'a', type: 3 }),
    areaProperty(2, { attributeName: 'b', type: 3 }),
  ],
  [
    areaProperty(2, { attributeName: 'a', type: 3 }),
    areaProperty(2, { attributeName: 'a', type: 4 }),
  ],
  [
    areaProperty(2, { attributeName: 'a', type: 3 }),
    areaProperty('invalid', { attributeName: 'a', type: 3 }),
  ],
])('treats unproven or contradictory duplicate records as ambiguous', (...properties) => {
  const report = createAreaReport([1], [result(1, properties)]);
  expect(report).toEqual({ status: 'unavailable', total: null, unit: null });
});

test('keeps zero as a valid complete Area total and does not invent a unit', () => {
  const report = createAreaReport([1], [result(1, [areaProperty('-0', { units: undefined })])]);
  expect(report).toEqual({ status: 'complete', total: 0, unit: null });
});

test('does not publish a non-finite total when finite contributions overflow', () => {
  const report = createAreaReport([1, 2], [
    result(1, [areaProperty(Number.MAX_VALUE)]),
    result(2, [areaProperty(Number.MAX_VALUE)]),
  ]);

  expect(report).toEqual({ status: 'unavailable', total: null, unit: null });
});
