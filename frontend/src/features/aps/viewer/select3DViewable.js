function isSupported3DGeometry(node) {
  return Boolean(
    node
      && typeof node.is3D === 'function'
      && node.is3D()
      && typeof node.isGeometry === 'function'
      && node.isGeometry(),
  );
}

function findDepthFirst(node) {
  if (isSupported3DGeometry(node)) return node;
  const children = typeof node?.getChildren === 'function' ? node.getChildren() : [];
  for (const child of Array.isArray(children) ? children : []) {
    const match = findDepthFirst(child);
    if (match) return match;
  }
  return null;
}

export function selectSupported3DViewable(root) {
  const defaultGeometry = typeof root?.getDefaultGeometry === 'function'
    ? root.getDefaultGeometry()
    : null;
  if (isSupported3DGeometry(defaultGeometry)) return defaultGeometry;

  const children = typeof root?.getChildren === 'function' ? root.getChildren() : [];
  for (const child of Array.isArray(children) ? children : []) {
    const match = findDepthFirst(child);
    if (match) return match;
  }

  throw Object.assign(new Error('No supported 3D geometry viewable was found.'), {
    code: 'APS_VIEWABLE_3D_NOT_FOUND',
  });
}
