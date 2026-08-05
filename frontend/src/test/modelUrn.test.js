import { expect, test } from 'vitest';

import { toViewerDocumentId } from '../features/aps/domain/modelUrn';

test.each([
  ['dGVzdC1tb2RlbA'],
  ['YWJjZA-_'],
])('constructs exactly one Viewer prefix and preserves canonical payload %s', (canonicalPayload) => {
  const documentId = toViewerDocumentId(canonicalPayload);

  expect(
    documentId,
    'Expected the exact Viewer document identifier without re-encoding or double-prefixing',
  ).toBe(`urn:${canonicalPayload}`);
});
