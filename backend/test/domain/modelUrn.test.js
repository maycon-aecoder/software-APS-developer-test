const assert = require('node:assert/strict');
const test = require('node:test');

const { canonicalizeModelUrn } = require('../../src/domain/modelUrn');

const canonicalPayload = 'dGVzdC1tb2RlbA';

const acceptedCases = [
  ['canonical payload', canonicalPayload, canonicalPayload],
  ['surrounding spaces', `  ${canonicalPayload}  `, canonicalPayload],
  ['one lowercase prefix', `urn:${canonicalPayload}`, canonicalPayload],
  ['whitespace around one lowercase prefix', `  urn:${canonicalPayload}\n`, canonicalPayload],
  ['one-byte final quantum', 'YQ', 'YQ'],
  ['two-byte final quantum', 'YWI', 'YWI'],
  ['complete final quantum', 'YWJj', 'YWJj'],
  ['URL-safe alphabet', '--__', '--__'],
];

for (const [label, input, expected] of acceptedCases) {
  test(`canonicalizes ${label} without re-encoding`, () => {
    assert.equal(
      canonicalizeModelUrn(input),
      expected,
      `Expected ${label} to produce the exact prefix-free canonical payload`,
    );
  });
}

const rejectedCases = [
  ['empty input', ''],
  ['whitespace-only input', ' \t\n '],
  ['prefix without a payload', 'urn:'],
  ['mixed-case prefix', `Urn:${canonicalPayload}`],
  ['repeated prefix', `urn:urn:${canonicalPayload}`],
  ['plus from the standard Base64 alphabet', 'YWJj+Q'],
  ['slash from the standard Base64 alphabet', 'YWJj/Q'],
  ['padding', 'YQ=='],
  ['embedded whitespace', 'YW Jj'],
  ['non-Base64URL punctuation', 'YWJj.Q'],
  ['modulo-four-one length', 'abcde'],
  ['nonzero unused bits in a two-character final quantum', 'YR'],
  ['nonzero unused bits in a three-character final quantum', 'YWJ'],
];

for (const [label, input] of rejectedCases) {
  test(`rejects ${label}`, () => {
    assert.throws(
      () => canonicalizeModelUrn(input),
      `Expected ${label} to be rejected as a noncanonical Model URN`,
    );
  });
}
