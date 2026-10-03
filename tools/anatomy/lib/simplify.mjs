// Error-bounded simplification with meshoptimizer, working in millimetres.
import { MeshoptSimplifier } from 'meshoptimizer'
import { compact } from './mesh.mjs'

await MeshoptSimplifier.ready

/**
 * Reduces `mesh` to at most `budget` triangles. Collapses that cost less than `freeError` mm are
 * always taken (they are invisible), so detailed-but-flat meshes end up well under budget; past
 * that, the budget decides and the returned error (mm) says what it cost.
 */
export function simplifyToBudget(mesh, budget, { freeError = 0.15, flags = [] } = {}) {
  const run = (targetTriangles, maxError, extra = []) =>
    MeshoptSimplifier.simplify(mesh.indices, mesh.positions, 3, targetTriangles * 3, maxError, ['ErrorAbsolute', ...flags, ...extra])
  let [indices, error] = run(0, freeError)
  if (indices.length / 3 > budget) [indices, error] = run(budget, 1e9)
  // Topology can stop the simplifier early (many tiny closed pieces); dropping the smallest pieces
  // is the least visible way to get under budget.
  if (indices.length / 3 > budget) [indices, error] = run(budget, 1e9, ['Prune'])
  return { mesh: compact({ positions: mesh.positions, indices }), errorMm: error }
}
