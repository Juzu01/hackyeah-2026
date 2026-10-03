// Renderer, camera, lights, environment and the contact shadow. The canvas is
// transparent: the CSS radial background shows through.

import {
  ACESFilmicToneMapping,
  CanvasTexture,
  DirectionalLight,
  HemisphereLight,
  Mesh,
  MeshBasicMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  PMREMGenerator,
  Scene,
  SRGBColorSpace,
  WebGLRenderer,
} from 'three'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import { ORDER } from './materials.ts'

export const FOV = 30

/** Null when the browser can't give us WebGL 2. */
export function createRenderer(canvas: HTMLCanvasElement): WebGLRenderer | null {
  try {
    const renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' })
    renderer.outputColorSpace = SRGBColorSpace
    renderer.toneMapping = ACESFilmicToneMapping
    renderer.toneMappingExposure = 0.95
    renderer.setClearColor(0x000000, 0)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
    return renderer
  } catch {
    return null
  }
}

/** Soft elliptical shadow texture: a radial falloff baked into a small canvas. */
function shadowTexture(): CanvasTexture {
  const size = 128
  const c = document.createElement('canvas')
  c.width = c.height = size
  const g = c.getContext('2d')!
  const grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
  grad.addColorStop(0, 'rgba(0,0,0,1)')
  grad.addColorStop(0.35, 'rgba(0,0,0,0.75)')
  grad.addColorStop(0.7, 'rgba(0,0,0,0.25)')
  grad.addColorStop(1, 'rgba(0,0,0,0)')
  g.fillStyle = grad
  g.fillRect(0, 0, size, size)
  const tex = new CanvasTexture(c)
  tex.colorSpace = SRGBColorSpace
  return tex
}

export interface Stage {
  scene: Scene
  camera: PerspectiveCamera
  shadow: Mesh
  dispose(): void
}

export function createStage(renderer: WebGLRenderer): Stage {
  const scene = new Scene()
  const camera = new PerspectiveCamera(FOV, 1, 0.05, 50)
  scene.add(camera)

  // Low-intensity studio reflections, for soft speculars on wet tissue.
  const pmrem = new PMREMGenerator(renderer)
  const room = new RoomEnvironment()
  const env = pmrem.fromScene(room, 0.04).texture
  room.dispose()
  pmrem.dispose()
  scene.environment = env
  scene.environmentIntensity = 0.12

  scene.add(new HemisphereLight('#dfe9f3', '#141a21', 0.35))

  // Key and rim ride with the camera, so every view is lit the same way:
  // key from the viewer's front-top-left, a cool rim from behind the body.
  const key = new DirectionalLight('#ffffff', 2.2)
  key.position.set(-2.2, 2.6, 2)
  key.target.position.set(0, 0, -4)
  const rim = new DirectionalLight('#9cc8ff', 2.6)
  rim.position.set(1.6, 1.8, -9)
  rim.target.position.set(0, 0, -3)
  camera.add(key, key.target, rim, rim.target)

  const shadowMaterial = new MeshBasicMaterial({
    map: shadowTexture(),
    color: 0x000000,
    transparent: true,
    opacity: 0.35,
    depthWrite: false,
    toneMapped: false,
  })
  const shadow = new Mesh(new PlaneGeometry(1, 1), shadowMaterial)
  shadow.rotation.x = -Math.PI / 2
  shadow.position.y = 0.001
  shadow.scale.set(0.8, 0.42, 1)
  shadow.renderOrder = ORDER.shadow
  scene.add(shadow)

  return {
    scene,
    camera,
    shadow,
    dispose() {
      env.dispose()
      shadowMaterial.map?.dispose()
      shadowMaterial.dispose()
      shadow.geometry.dispose()
    },
  }
}
