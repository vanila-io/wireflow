# React Three Fiber API Reference

Complete API reference for React Three Fiber core and essential Drei helpers.

---

## Table of Contents

1. [Canvas Component](#canvas-component)
2. [Hooks](#hooks)
3. [Events](#events)
4. [Three.js Object Props](#threejs-object-props)
5. [Drei Helpers](#drei-helpers)

---

## Canvas Component

The `<Canvas>` component is the root of every R3F scene. It sets up the renderer, scene, and camera.

### Props

```typescript
interface CanvasProps {
  children: React.ReactNode

  // Rendering
  gl?: Partial<WebGLRendererParameters> | ((canvas: HTMLCanvasElement) => WebGLRenderer)
  dpr?: number | [min: number, max: number]
  frameloop?: 'always' | 'demand' | 'never'
  flat?: boolean
  linear?: boolean
  legacy?: boolean

  // Camera
  camera?: Partial<PerspectiveCamera> | Partial<OrthographicCamera>
  orthographic?: boolean

  // Scene
  shadows?: boolean | Partial<WebGLShadowMap>
  raycaster?: Partial<Raycaster>

  // Events
  events?: EventManager
  eventSource?: HTMLElement | React.RefObject<HTMLElement>
  eventPrefix?: 'offset' | 'client' | 'page' | 'layer' | 'screen'

  // Size
  resize?: { scroll?: boolean; debounce?: number | { scroll: number; resize: number } }

  // Performance
  performance?: {
    current?: number
    min?: number
    max?: number
    debounce?: number
  }

  // Callbacks
  onCreated?: (state: RootState) => void
  onPointerMissed?: (event: MouseEvent) => void
}
```

### Examples

```jsx
// Basic setup
<Canvas>
  <Scene />
</Canvas>

// Custom camera
<Canvas camera={{ position: [0, 0, 5], fov: 75, near: 0.1, far: 1000 }}>
  <Scene />
</Canvas>

// Orthographic camera
<Canvas orthographic camera={{ zoom: 50, position: [0, 0, 5] }}>
  <Scene />
</Canvas>

// Enable shadows
<Canvas shadows>
  <Scene />
</Canvas>

// Custom renderer settings
<Canvas
  gl={{
    antialias: true,
    alpha: true,
    powerPreference: 'high-performance'
  }}
  dpr={[1, 2]}
>
  <Scene />
</Canvas>

// On-demand rendering
<Canvas frameloop="demand">
  <Scene />
</Canvas>

// Performance monitoring
<Canvas
  performance={{ min: 0.5, max: 1, debounce: 200 }}
  onCreated={(state) => console.log('Canvas created:', state)}
>
  <Scene />
</Canvas>
```

---

## Hooks

### useFrame

Execute code on every rendered frame.

```typescript
useFrame(
  callback: (state: RootState, delta: number, xrFrame?: XRFrame) => void,
  renderPriority?: number
): void
```

**Parameters**:
- `callback` - Function called every frame
- `renderPriority` - Execution order (default: 0, higher = later)

**State Object**:
```typescript
interface RootState {
  gl: WebGLRenderer
  scene: Scene
  camera: Camera
  raycaster: Raycaster
  pointer: Vector2
  mouse: Vector2 // Deprecated, use pointer
  clock: Clock
  size: { width: number; height: number; top: number; left: number }
  viewport: {
    width: number
    height: number
    initialDpr: number
    dpr: number
    factor: number
    distance: number
    aspect: number
  }
  performance: { current: number; min: number; max: number; debounce: number }
  frameloop: 'always' | 'demand' | 'never'
  controls: any
  invalidate: (frames?: number) => void
  advance: (timestamp: number, runGlobalEffects?: boolean) => void
  setSize: (width: number, height: number) => void
  setDpr: (dpr: number) => void
  setFrameloop: (frameloop: 'always' | 'demand' | 'never') => void
  get: () => RootState
  set: (partial: Partial<RootState>) => void
}
```

**Examples**:

```jsx
// Basic animation
function RotatingBox() {
  const meshRef = useRef()

  useFrame((state, delta) => {
    meshRef.current.rotation.x += delta
    meshRef.current.rotation.y += delta * 0.5
  })

  return <mesh ref={meshRef}>...</mesh>
}

// Access clock for time-based animations
function FloatingBox() {
  const meshRef = useRef()

  useFrame((state) => {
    const time = state.clock.elapsedTime
    meshRef.current.position.y = Math.sin(time) * 2
  })

  return <mesh ref={meshRef}>...</mesh>
}

// Control render loop
function CustomRender() {
  useFrame(({ gl, scene, camera }) => {
    gl.render(scene, camera)
  }, 1) // renderPriority = 1 (takes over rendering)
}

// Ordered execution
function First() {
  useFrame(() => console.log('First'), -1)
}

function Second() {
  useFrame(() => console.log('Second'), 0)
}

function Third() {
  useFrame(() => console.log('Third'), 1)
}
```

---

### useThree

Access R3F state and scene objects.

```typescript
useThree<T = RootState>(
  selector?: (state: RootState) => T,
  equalityFn?: (a: T, b: T) => boolean
): T
```

**Parameters**:
- `selector` - Function to select specific state (optional)
- `equalityFn` - Custom equality function for optimization

**Examples**:

```jsx
// Get all state (re-renders on any change)
function Component() {
  const state = useThree()
  const { gl, scene, camera, size } = state
  return null
}

// Selective subscription (only re-renders when size changes)
function Component() {
  const size = useThree((state) => state.size)
  console.log(size.width, size.height)
  return null
}

// Multiple selections
function Component() {
  const camera = useThree((state) => state.camera)
  const viewport = useThree((state) => state.viewport)
  const gl = useThree((state) => state.gl)
  return null
}

// Get state non-reactively
function Component() {
  const get = useThree((state) => state.get)

  function handleClick() {
    const freshState = get()
    console.log(freshState.camera.position)
  }

  return <mesh onClick={handleClick}>...</mesh>
}

// Manual invalidation (trigger render)
function Component() {
  const invalidate = useThree((state) => state.invalidate)

  return (
    <mesh onClick={() => invalidate()}>
      <boxGeometry />
      <meshStandardMaterial />
    </mesh>
  )
}

// Set frame loop
function Component() {
  const setFrameloop = useThree((state) => state.setFrameloop)

  useEffect(() => {
    setFrameloop('demand') // Switch to on-demand rendering
  }, [])

  return null
}
```

---

### useLoader

Load assets with automatic caching and Suspense integration.

```typescript
useLoader<T>(
  loader: LoaderConstructor<T>,
  url: string | string[],
  extensions?: (loader: LoaderProto<T>) => void,
  onProgress?: (event: ProgressEvent) => void
): T | T[]

// Static methods
useLoader.preload<T>(
  loader: LoaderConstructor<T>,
  url: string | string[],
  extensions?: (loader: LoaderProto<T>) => void
): void

useLoader.clear<T>(
  loader: LoaderConstructor<T>,
  url: string | string[]
): void
```

**Examples**:

```jsx
import { useLoader } from '@react-three/fiber'
import { TextureLoader, GLTFLoader } from 'three'

// Load texture
function TexturedBox() {
  const texture = useLoader(TextureLoader, '/texture.jpg')

  return (
    <mesh>
      <boxGeometry />
      <meshStandardMaterial map={texture} />
    </mesh>
  )
}

// Load GLTF model
function Model() {
  const gltf = useLoader(GLTFLoader, '/model.glb')
  return <primitive object={gltf.scene} />
}

// Load multiple assets
function Scene() {
  const [texture1, texture2, texture3] = useLoader(TextureLoader, [
    '/tex1.jpg',
    '/tex2.jpg',
    '/tex3.jpg'
  ])

  return (
    <>
      <mesh><meshStandardMaterial map={texture1} /></mesh>
      <mesh><meshStandardMaterial map={texture2} /></mesh>
      <mesh><meshStandardMaterial map={texture3} /></mesh>
    </>
  )
}

// Loader extensions (e.g., DRACO compression)
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader'

function CompressedModel() {
  const gltf = useLoader(
    GLTFLoader,
    '/compressed.glb',
    (loader) => {
      const dracoLoader = new DRACOLoader()
      dracoLoader.setDecoderPath('/draco/')
      loader.setDRACOLoader(dracoLoader)
    }
  )

  return <primitive object={gltf.scene} />
}

// Progress tracking
function ModelWithProgress() {
  const [progress, setProgress] = useState(0)

  const gltf = useLoader(
    GLTFLoader,
    '/large-model.glb',
    undefined,
    (event) => {
      setProgress((event.loaded / event.total) * 100)
    }
  )

  return <primitive object={gltf.scene} />
}

// Pre-loading
function Preloader() {
  useEffect(() => {
    useLoader.preload(GLTFLoader, '/model.glb')
    useLoader.preload(TextureLoader, '/texture.jpg')
  }, [])

  return null
}

// Clear cache
function Component() {
  useEffect(() => {
    return () => {
      useLoader.clear(GLTFLoader, '/model.glb')
    }
  }, [])
}
```

---

### useGraph

Access GLTF scene graph with typed nodes and materials.

```typescript
useGraph(object: Object3D): {
  nodes: { [name: string]: Object3D }
  materials: { [name: string]: Material }
}
```

**Example**:

```jsx
import { useLoader } from '@react-three/fiber'
import { useGraph } from '@react-three/fiber'
import { GLTFLoader } from 'three'

function Model() {
  const gltf = useLoader(GLTFLoader, '/model.glb')
  const { nodes, materials } = useGraph(gltf.scene)

  return (
    <group>
      <mesh geometry={nodes.Mesh.geometry} material={materials.Material} />
      <mesh geometry={nodes.OtherMesh.geometry}>
        <meshStandardMaterial color="red" />
      </mesh>
    </group>
  )
}
```

---

## Events

R3F supports pointer events on any Object3D.

### Supported Events

```typescript
// Pointer events
onPointerOver?: (event: ThreeEvent<PointerEvent>) => void
onPointerOut?: (event: ThreeEvent<PointerEvent>) => void
onPointerEnter?: (event: ThreeEvent<PointerEvent>) => void
onPointerLeave?: (event: ThreeEvent<PointerEvent>) => void
onPointerMove?: (event: ThreeEvent<PointerEvent>) => void
onPointerDown?: (event: ThreeEvent<PointerEvent>) => void
onPointerUp?: (event: ThreeEvent<PointerEvent>) => void
onPointerCancel?: (event: ThreeEvent<PointerEvent>) => void
onPointerMissed?: (event: MouseEvent) => void

// Click events
onClick?: (event: ThreeEvent<MouseEvent>) => void
onContextMenu?: (event: ThreeEvent<MouseEvent>) => void
onDoubleClick?: (event: ThreeEvent<MouseEvent>) => void

// Wheel event
onWheel?: (event: ThreeEvent<WheelEvent>) => void
```

### ThreeEvent Object

```typescript
interface ThreeEvent<T> extends Omit<T, 'target'> {
  // Three.js specific
  intersections: Intersection[]
  object: Object3D
  eventObject: Object3D
  unprojectedPoint: Vector3
  ray: Ray
  camera: Camera
  sourceEvent: T
  delta: number

  // Helpers
  stopPropagation: () => void
  nativeEvent: T
  pointer: Vector2
  pointerId: number
  distance: number
  point: Vector3
  uv: Vector2
  face: Face | null
  faceIndex: number | null
}
```

### Examples

```jsx
// Basic click handler
<mesh onClick={(e) => console.log('Clicked!', e.point)}>
  <boxGeometry />
  <meshStandardMaterial />
</mesh>

// Hover states
function InteractiveBox() {
  const [hovered, setHovered] = useState(false)

  return (
    <mesh
      onPointerOver={(e) => {
        e.stopPropagation()
        setHovered(true)
        document.body.style.cursor = 'pointer'
      }}
      onPointerOut={(e) => {
        setHovered(false)
        document.body.style.cursor = 'auto'
      }}
    >
      <boxGeometry />
      <meshStandardMaterial color={hovered ? 'hotpink' : 'orange'} />
    </mesh>
  )
}

// Stop event propagation
<group onClick={(e) => e.stopPropagation()}>
  <mesh onClick={() => console.log('Mesh clicked')} />
  <mesh onClick={() => console.log('This will also fire without stopPropagation')} />
</group>

// Access intersection data
<mesh
  onClick={(e) => {
    console.log('Hit point:', e.point)
    console.log('Hit face:', e.face)
    console.log('UV coordinates:', e.uv)
    console.log('Distance from camera:', e.distance)
    console.log('All intersections:', e.intersections)
  }}
>
  <sphereGeometry />
  <meshStandardMaterial />
</mesh>

// Pointer missed (clicked on empty space)
<Canvas onPointerMissed={() => console.log('Clicked on background')}>
  <mesh />
</Canvas>
```

---

## Three.js Object Props

R3F translates JSX props to Three.js object properties.

### Prop Mapping

```jsx
// Array notation → .set()
<mesh position={[1, 2, 3]} />  // mesh.position.set(1, 2, 3)
<mesh rotation={[0, Math.PI, 0]} />  // mesh.rotation.set(0, Math.PI, 0)
<mesh scale={[2, 2, 2]} />  // mesh.scale.set(2, 2, 2)

// Dash notation (axis-specific)
<mesh position-x={1} position-y={2} position-z={3} />
<mesh scale-x={2} scale-y={1} />

// Direct property assignment
<mesh visible={false} />  // mesh.visible = false
<mesh castShadow receiveShadow />  // mesh.castShadow = true, mesh.receiveShadow = true

// Constructor arguments
<boxGeometry args={[1, 1, 1]} />  // new BoxGeometry(1, 1, 1)
<meshStandardMaterial args={[{ color: 'red' }]} />  // new MeshStandardMaterial({ color: 'red' })

// Attach to specific parent property
<mesh>
  <meshStandardMaterial attach="material" />  // mesh.material = material
</mesh>

// Nested properties
<meshStandardMaterial color="red" roughness={0.5} metalness={0.8} />

// Set (for Vector-like properties)
<pointLight position={[10, 10, 10]} />
```

### Special Props

```jsx
// attach: Attach to parent property
<mesh>
  <meshStandardMaterial attach="material" />
  <boxGeometry attach="geometry" />
</mesh>

// attach-array: Attach to array index
<group>
  <mesh attach="children-0" />
  <mesh attach="children-1" />
</group>

// dispose: Control automatic disposal
<mesh dispose={null}>  {/* Never dispose */}
  <boxGeometry />
  <meshStandardMaterial />
</mesh>

// args: Constructor arguments
<sphereGeometry args={[1, 32, 32]} />  // radius, widthSegments, heightSegments

// object: Pass pre-existing Three.js object
<primitive object={myThreeJsObject} />

// ref: Get reference to underlying Three.js object
<mesh ref={meshRef} />
```

---

## Drei Helpers

Essential Drei components and hooks.

### OrbitControls

```typescript
interface OrbitControlsProps {
  makeDefault?: boolean
  camera?: Camera
  domElement?: HTMLElement
  target?: Vector3
  enableDamping?: boolean
  dampingFactor?: number
  enableZoom?: boolean
  enableRotate?: boolean
  enablePan?: boolean
  minDistance?: number
  maxDistance?: number
  minPolarAngle?: number
  maxPolarAngle?: number
  onChange?: (e?: Event) => void
  onStart?: (e?: Event) => void
  onEnd?: (e?: Event) => void
}
```

```jsx
import { OrbitControls } from '@react-three/drei'

<OrbitControls
  makeDefault
  enableDamping
  dampingFactor={0.05}
  minDistance={3}
  maxDistance={20}
  maxPolarAngle={Math.PI / 2}
  target={[0, 1, 0]}
/>
```

### Environment

```jsx
import { Environment } from '@react-three/drei'

// Preset HDRI
<Environment preset="sunset" background />

// Custom HDRI
<Environment files="/hdri.hdr" />

// Ground reflection
<Environment preset="city" ground={{ height: 15, radius: 60, scale: 100 }} />
```

### useGLTF

```jsx
import { useGLTF } from '@react-three/drei'

function Model() {
  const { scene, nodes, materials } = useGLTF('/model.glb')
  return <primitive object={scene} />
}

// Pre-load
useGLTF.preload('/model.glb')
```

### Text & Text3D

```jsx
import { Text, Text3D } from '@react-three/drei'

// 2D billboard text
<Text
  position={[0, 2, 0]}
  fontSize={1}
  color="white"
  anchorX="center"
  anchorY="middle"
  maxWidth={5}
  lineHeight={1}
  letterSpacing={0.02}
  textAlign="center"
  font="/fonts/font.woff"
  outlineWidth={0.1}
  outlineColor="#000000"
>
  Hello World
</Text>

// 3D extruded text
<Text3D
  font="/fonts/helvetiker_regular.typeface.json"
  size={1}
  height={0.2}
  curveSegments={12}
  bevelEnabled
  bevelThickness={0.02}
  bevelSize={0.02}
  bevelOffset={0}
  bevelSegments={5}
>
  3D Text
  <meshNormalMaterial />
</Text3D>
```

### Center & Bounds

```jsx
import { Center, Bounds, useBounds } from '@react-three/drei'

// Auto-center
<Center>
  <Model />
</Center>

// Auto-fit camera
<Bounds fit clip observe margin={1.2}>
  <Model />
</Bounds>

// Manual control
function SelectToZoom() {
  const bounds = useBounds()

  return (
    <mesh onClick={(e) => {
      e.stopPropagation()
      bounds.refresh(e.object).fit()
    }}>
      <boxGeometry />
      <meshStandardMaterial />
    </mesh>
  )
}
```

### Html

```jsx
import { Html } from '@react-three/drei'

<mesh>
  <boxGeometry />
  <meshStandardMaterial />

  <Html
    position={[0, 1, 0]}
    center
    distanceFactor={10}
    occlude
    transform
    sprite
  >
    <div className="annotation">Label</div>
  </Html>
</mesh>
```

### ScrollControls

```jsx
import { ScrollControls, Scroll, useScroll } from '@react-three/drei'

function Scene() {
  const scroll = useScroll()
  const meshRef = useRef()

  useFrame(() => {
    const offset = scroll.offset // 0-1
    meshRef.current.position.y = offset * 10
  })

  return <mesh ref={meshRef}>...</mesh>
}

<Canvas>
  <ScrollControls pages={3} damping={0.5}>
    <Scroll>
      <Scene />
    </Scroll>
    <Scroll html>
      <h1>HTML Content</h1>
    </Scroll>
  </ScrollControls>
</Canvas>
```

### ContactShadows

```jsx
import { ContactShadows } from '@react-three/drei'

<ContactShadows
  position={[0, -0.8, 0]}
  opacity={0.5}
  scale={10}
  blur={1}
  far={10}
  resolution={256}
  color="#000000"
/>
```

### Sky

```jsx
import { Sky } from '@react-three/drei'

<Sky
  distance={450000}
  sunPosition={[0, 1, 0]}
  inclination={0}
  azimuth={0.25}
  rayleigh={2}
  turbidity={10}
  mieCoefficient={0.005}
  mieDirectionalG={0.8}
/>
```

### Stars

```jsx
import { Stars } from '@react-three/drei'

<Stars
  radius={100}
  depth={50}
  count={5000}
  factor={4}
  saturation={0}
  fade
  speed={1}
/>
```

---

## Performance Helpers (Drei)

### AdaptiveDpr

```jsx
import { AdaptiveDpr } from '@react-three/drei'

<AdaptiveDpr pixelated />
```

### AdaptiveEvents

```jsx
import { AdaptiveEvents } from '@react-three/drei'

<AdaptiveEvents />
```

### PerformanceMonitor

```jsx
import { PerformanceMonitor } from '@react-three/drei'

<PerformanceMonitor
  onIncline={() => console.log('Performance improved')}
  onDecline={() => console.log('Performance degraded')}
  onFallback={() => console.log('Fallback triggered')}
  onChange={({ factor }) => console.log('Factor:', factor)}
  flipflops={3}
  bounds={(refreshRate) => [50, 90]}
>
  <Scene />
</PerformanceMonitor>
```

### Preload

```jsx
import { Preload } from '@react-three/drei'

<Canvas>
  <Scene />
  <Preload all />  {/* Preload all assets */}
</Canvas>
```

---

## Resources

- [Official R3F Docs](https://docs.pmnd.rs/react-three-fiber)
- [Drei Documentation](https://github.com/pmndrs/drei)
- [Three.js Documentation](https://threejs.org/docs/)
- [R3F Examples](https://docs.pmnd.rs/react-three-fiber/examples)
