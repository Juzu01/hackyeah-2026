// Binary STL → triangle soup: a Float32Array with 9 floats (three corners) per triangle.
// The stored facet normals are ignored; normals are rebuilt from the welded mesh later.
export function parseStl(buf) {
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength)
  const count = view.getUint32(80, true)
  if (buf.byteLength < 84 + count * 50) throw new Error(`STL truncated: ${count} triangles, ${buf.byteLength} bytes`)
  const soup = new Float32Array(count * 9)
  for (let t = 0; t < count; t++) {
    const base = 84 + t * 50 + 12
    for (let k = 0; k < 9; k++) soup[t * 9 + k] = view.getFloat32(base + k * 4, true)
  }
  return soup
}
