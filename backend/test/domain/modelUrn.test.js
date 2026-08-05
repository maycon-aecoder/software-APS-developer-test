const assert = require('node:assert/strict');
const { existsSync } = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const subjectPath = path.resolve(__dirname, '../../src/domain/modelUrn.js');
const subject = existsSync(subjectPath) ? require(subjectPath) : {};
const canonicalizeModelUrn = subject.canonicalizeModelUrn ?? (() => undefined);

const canonicalPayload = 'dGVzdC1tb2RlbA';

const acceptedCases = [
  ['canonical payload', canonicalPayload, canonicalPayload],
  ['surrounding spaces', `  ${canonicalPayload}  `, canonicalPayload],
  ['surrounding line whitespace', `\n${canonicalPayload}\t`, canonicalPayload],
  ['one lowercase prefix', `urn:${canonicalPayload}`, canonicalPayload],
  ['whitespace around one lowercase prefix', `  urn:${canonicalPayload}\n`, canonicalPayload],
  ['one-byte final quantum', 'YQ', 'YQ'],
  ['two-byte final quantum', 'YWI', 'YWI'],
  ['complete final quantum', 'YWJj', 'YWJj'],
  ['URL-safe alphabet', '--__', '--__'],
];

for (const [label, input, expected] of acceptedCases) {
  test(`canonicalizes ${label} without re-encoding`, () => {
    assert.equal(canonicalizeModelUrn(input), expected);
  });
}

const rejectedCases = [
  ['empty input', ''],
  ['whitespace-only input', ' \t\n '],
  ['prefix without a payload', 'urn:'],
  ['uppercase prefix', `URN:${canonicalPayload}`],
  ['mixed-case prefix', `Urn:${canonicalPayload}`],
  ['repeated prefix', `urn:urn:${canonicalPayload}`],
  ['plus from the standard Base64 alphabet', 'YWJj+Q'],
  ['slash from the standard Base64 alphabet', 'YWJj/Q'],
  ['padding', 'YQ=='],
  ['embedded space', 'YW Jj'],
  ['embedded line break', 'YW\nJj'],
  ['embedded tab', 'YW\tJj'],
  ['non-Base64URL punctuation', 'YWJj.Q'],
  ['modulo-four-one length', 'abcde'],
  ['incomplete decodable quantum', 'A'],
  ['noncanonical decode/re-encode result', 'YR'],
  ['nonzero unused trailing bits', 'YWJ'],
];

for (const [label, input] of rejectedCases) {
  test(`rejects ${label}`, () => {
    assert.throws(() => canonicalizeModelUrn(input));
  });
}
