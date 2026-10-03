// three ships this mesher without type declarations.
declare module 'three/examples/jsm/libs/surfaceNet.js' {
  export function surfaceNet(
    dims: number[],
    potential: (x: number, y: number, z: number) => number,
    bounds?: number[][],
  ): { positions: number[][]; cells: number[][] }
}
