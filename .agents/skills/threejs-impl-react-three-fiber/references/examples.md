# examples.md -- React Three Fiber Working Examples

> Verified patterns for @react-three/fiber 8.x+ with React 18+.

---

## Example 1: Basic Scene with Animated Mesh

```tsx
import { Canvas, useFrame } from '@react-three/fiber'
import { useRef } from 'react'
import * as THREE from 'three'

function SpinningBox() {
  const meshRef = useRef<THREE.Mesh>(null!)

  useFrame((state, delta) => {
    // ALWAYS use delta for frame-rate-independent rotation
    meshRef.current.rotation.x += delta
    meshRef.current.rotation.y += delta * 0.5
  })

  return (
    <mesh ref={meshRef}>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial color="royalblue" />
    </mesh>
  )
}

export default function App() {
  return (
    <Canvas camera={{ position: [0, 0, 5] }}>
      <ambientLight intensity={0.5} />
      <directionalLight position={[5, 5, 5]} />
      <SpinningBox />
    </Canvas>
  )
}
```

**Key points:**
- `useFrame` callback receives `delta` -- ALWAYS use it for animation timing.
- `meshRef` uses `null!` assertion for non-null initial value in TypeScript.
- Geometry and material are declared as JSX children, auto-attached.

---

## Example 2: Loading a GLTF Model with Suspense

```tsx
import { Canvas, useLoader } from '@react-three/fiber'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader'
import { Suspense } from 'react'

// Preload at module scope for instant availability
useLoader.preload(GLTFLoader, '/models/robot.glb')

function Robot() {
  const gltf = useLoader(GLTFLoader, '/models/robot.glb')

  return <primitive object={gltf.scene} scale={0.5} position={[0, -1, 0]} />
}

export default function App() {
  return (
    <Canvas>
      <ambientLight intensity={0.8} />
      {/* ALWAYS wrap useLoader consumers in Suspense */}
      <Suspense fallback={null}>
        <Robot />
      </Suspense>
    </Canvas>
  )
}
```

**Key points:**
- `useLoader.preload()` at module scope starts loading before mount.
- ALWAYS wrap in `<Suspense>` -- without it, the component throws.
- `<primitive>` inserts the loaded scene into the R3F tree.

---

## Example 3: On-Demand Rendering for Static Scenes

```tsx
import { Canvas, useThree } from '@react-three/fiber'
import { useEffect } from 'react'

function SceneController() {
  const invalidate = useThree((state) => state.invalidate)

  useEffect(() => {
    // Trigger a re-render after data changes
    invalidate()
  }, [invalidate])

  return null
}

function InteractiveBox() {
  const invalidate = useThree((state) => state.invalidate)

  return (
    <mesh
      onClick={(event) => {
        event.object.material.color.set('orange')
        invalidate() // Request render after color change
      }}
    >
      <boxGeometry args={[2, 2, 2]} />
      <meshStandardMaterial color="green" />
    </mesh>
  )
}

export default function Configurator() {
  return (
    <Canvas frameloop="demand">
      <ambientLight />
      <directionalLight position={[3, 3, 3]} />
      <InteractiveBox />
      <SceneController />
    </Canvas>
  )
}
```

**Key points:**
- `frameloop="demand"` stops continuous rendering -- saves GPU.
- ALWAYS call `invalidate()` after any visual change in demand mode.
- Use `useThree` with a selector to avoid unnecessary re-renders.

---

## Example 4: Custom Class with extend() and Events

```tsx
import { Canvas, extend, useFrame } from '@react-three/fiber'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls'
import { useRef, useState } from 'react'
import * as THREE from 'three'

// Register OrbitControls as a JSX element
extend({ OrbitControls })

// Declare the JSX intrinsic element for TypeScript
declare global {
  namespace JSX {
    interface IntrinsicElements {
      orbitControls: any
    }
  }
}

function Controls() {
  const { camera, gl } = useThree()
  return <orbitControls args={[camera, gl.domElement]} />
}

function HoverableSphere() {
  const [hovered, setHovered] = useState(false)
  const meshRef = useRef<THREE.Mesh>(null!)

  useFrame((state, delta) => {
    meshRef.current.rotation.y += delta * 0.3
  })

  return (
    <mesh
      ref={meshRef}
      onPointerEnter={() => setHovered(true)}
      onPointerLeave={() => setHovered(false)}
      scale={hovered ? 1.2 : 1}
    >
      <sphereGeometry args={[1, 32, 32]} />
      <meshStandardMaterial color={hovered ? 'hotpink' : 'mediumpurple'} />
    </mesh>
  )
}

export default function App() {
  return (
    <Canvas>
      <ambientLight intensity={0.5} />
      <pointLight position={[10, 10, 10]} />
      <HoverableSphere />
      <Controls />
    </Canvas>
  )
}
```

**Key points:**
- `extend()` MUST be called before using the custom element in JSX.
- `onPointerEnter`/`onPointerLeave` fire once (not continuously like `onPointerOver`/`onPointerOut`).
- State changes via `useState` trigger re-renders and R3F reconciles props.

---

## Example 5: Portal for Off-Screen Rendering

```tsx
import { Canvas, createPortal, useFrame, useThree } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'

function MiniMap() {
  const { gl, scene, size } = useThree()
  const miniMapScene = useMemo(() => new THREE.Scene(), [])
  const miniMapCamera = useMemo(
    () => new THREE.OrthographicCamera(-5, 5, 5, -5, 0.1, 100),
    []
  )

  useFrame(() => {
    // Render the minimap into a viewport corner
    const width = size.width * 0.25
    const height = size.height * 0.25
    gl.setViewport(0, 0, width, height)
    gl.setScissor(0, 0, width, height)
    gl.setScissorTest(true)
    gl.render(miniMapScene, miniMapCamera)
    gl.setScissorTest(false)
    gl.setViewport(0, 0, size.width, size.height)
  }, 1) // priority > 0: manual rendering

  return createPortal(
    <>
      <ambientLight intensity={1} />
      <mesh>
        <planeGeometry args={[10, 10]} />
        <meshBasicMaterial color="lightgray" />
      </mesh>
    </>,
    miniMapScene
  )
}

export default function App() {
  return (
    <Canvas>
      <ambientLight />
      <mesh>
        <boxGeometry />
        <meshNormalMaterial />
      </mesh>
      <MiniMap />
    </Canvas>
  )
}
```

**Key points:**
- `createPortal` renders children into a separate scene.
- Priority > 0 disables auto-render -- the callback MUST render manually.
- `useMemo` prevents recreating the scene and camera on every render.
