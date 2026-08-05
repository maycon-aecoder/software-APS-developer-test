import { existsSync } from 'node:fs';
import { expect, test } from 'vitest';

const subjectUrl = new URL('../features/aps/domain/modelUrn.js', import.meta.url);
const subject = existsSync(subjectUrl)
  ? await import(/* @vite-ignore */ subjectUrl.href)
  : {};
const toViewerDocumentId = subject.toViewerDocumentId ?? (() => undefined);

test.each([
  ['dGVzdC1tb2RlbA'],
  ['YWJjZA-_'],
])('constructs exactly one Viewer prefix and preserves canonical payload %s', (canonicalPayload) => {
  const documentId = toViewerDocumentId(canonicalPayload);

  expect(documentId).toBe(`urn:${canonicalPayload}`);
  expect(documentId.match(/urn:/g)).toHaveLength(1);
});
