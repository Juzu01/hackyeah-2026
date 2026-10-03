// One GLB with one mesh node per part, quantized (KHR_mesh_quantization) and meshopt-compressed
// (EXT_meshopt_compression), loadable by three's GLTFLoader with MeshoptDecoder.
//
// Quantization stores each mesh in a normalized integer box and puts the box on the node as a
// translation plus uniform scale, so node transforms are not identity: use world matrices
// (Box3.setFromObject, matrixWorld) rather than raw geometry positions.
import { Document, NodeIO } from '@gltf-transform/core'
import { EXTMeshoptCompression, KHRMeshQuantization } from '@gltf-transform/extensions'
import { meshopt } from '@gltf-transform/functions'
import { MeshoptEncoder } from 'meshoptimizer'

/** parts: [{ id, positions (m), normals, indices, extras }] in output order. */
export async function encodeGlb(parts, { copyright }) {
  await MeshoptEncoder.ready
  const doc = new Document()
  doc.getRoot().getAsset().generator = 'hackyeah-2026 tools/anatomy/build.mjs'
  doc.getRoot().getAsset().copyright = copyright
  const buffer = doc.createBuffer()
  const material = doc.createMaterial('tissue').setBaseColorFactor([0.8, 0.8, 0.8, 1]).setRoughnessFactor(0.6).setMetallicFactor(0)
  const scene = doc.createScene('body')

  for (const part of parts) {
    const vertexCount = part.positions.length / 3
    const indexArray = vertexCount <= 65535 ? Uint16Array.from(part.indices) : part.indices
    const primitive = doc
      .createPrimitive()
      .setAttribute('POSITION', doc.createAccessor().setType('VEC3').setArray(part.positions).setBuffer(buffer))
      .setAttribute('NORMAL', doc.createAccessor().setType('VEC3').setArray(part.normals).setBuffer(buffer))
      .setIndices(doc.createAccessor().setType('SCALAR').setArray(indexArray).setBuffer(buffer))
      .setMaterial(material)
    const mesh = doc.createMesh(part.id).addPrimitive(primitive)
    scene.addChild(doc.createNode(part.id).setMesh(mesh).setExtras(part.extras))
  }
  doc.getRoot().setDefaultScene(scene)

  await doc.transform(meshopt({ encoder: MeshoptEncoder, level: 'high' }))
  const io = new NodeIO()
    .registerExtensions([EXTMeshoptCompression, KHRMeshQuantization])
    .registerDependencies({ 'meshopt.encoder': MeshoptEncoder })
  return io.writeBinary(doc)
}
