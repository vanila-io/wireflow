---
name: react-three-fiber
description: Build declarative 3D scenes with React Three Fiber (R3F) - a React renderer for Three.js. Use when building interactive 3D experiences in React applications with component-based architecture, state management, and reusable abstractions. Ideal for product configurators, portfolios, games, data visualization, and immersive web experiences.
---

# React Three Fiber

## Overview

React Three Fiber (R3F) is a React renderer for Three.js that brings declarative, component-based 3D development to React applications. Instead of imperatively creating and managing Three.js objects, you build 3D scenes using JSX components that map directly to Three.js objects.

**When to Use This Skill**:
- Building 3D experiences within React applications
- Creating interactive product configurators or showcases
- Developing 3D portfolios, galleries, or storytelling experiences
- Building games or simulations in React
- Adding 3D elements to existing React projects
- When you need state management and React hooks with 3D graphics
- When working with React frameworks (Next.js, Gatsby, Remix)

**Key Benefits**:
- **Declarative**: Write 3D scenes like React components
- **React Integration**: Full access to hooks, context, state management
- **Reusability**: Create and share 3D component libraries
- **Performance**: Automatic render optimization and reconciliation
- **Ecosystem**: Works with Drei helpers, Zustand, Framer Motion, etc.
- **TypeScript Support**: Full type safety for Three.js objects

---

## Core Concepts

### 1. Canvas Component

The `<Canvas>` component sets up a Three.js scene, camera, renderer, and render loop.

```jsx
import { Canvas } from '@react-three/fiber'

function App() {
  return (
    <Canvas
      camera={{ position: [0, 0, 5], fov: 75 }}
      gl={{ antialias: true }}
      dpr={[1, 2]}
    >
      {/* 3D content goes here */}
    </Canvas>
  )
}
```

**Canvas Props**:
- `camera` - Camera configuration (position, fov, near, far)
- `gl` - WebGL renderer settings
- `dpr` - Device pixel ratio (default: [1, 2])
- `shadows` - Enable shadow mapping (default: false)
- `frameloop` - "always" (default), "demand", or "never"
- `flat` - Disable color management for simpler colors
- `linear` - Use linear color space instead of sRGB

### 2. Declarative 3D Objects

Three.js objects are created using JSX with kebab-case props:

```jsx
// THREE.Mesh + THREE.BoxGeometry + THREE.MeshStandardMaterial
<mesh position={[0, 0, 0]} rotation={[0, Math.PI / 4, 0]}>
  <boxGeometry args={[1, 1, 1]} />
  <meshStandardMaterial color="hotpink" />
</mesh>
```

**Prop Mapping**:
- `position` → `object.position.set(x, y, z)`
- `rotation` → `object.rotation.set(x, y, z)`
- `scale` → `object.scale.set(x, y, z)`
- `args` → Constructor arguments for geometry/material
- `attach` → Attach to parent property (e.g., `attach="material"`)

**Shorthand Notation**:
```jsx
// Full notation
<mesh position={[1, 2, 3]} />

// Axis-specific (dash notation)
<mesh position-x={1} position-y={2} position-z={3} />
```

### 3. useFrame Hook

Execute code on every frame (animation loop):

```jsx
import { useFrame } from '@react-three/fiber'
import { useRef } from 'react'

function RotatingBox() {
  const meshRef = useRef()

  useFrame((state, delta) => {
    // Rotate mesh on every frame
    meshRef.current.rotation.x += delta
    meshRef.current.rotation.y += delta * 0.5

    // Access scene state
    const time = state.clock.elapsedTime
    meshRef.current.position.y = Math.sin(time) * 2
  })

  return (
    <mesh ref={meshRef}>
      <boxGeometry />
      <meshStandardMaterial color="orange" />
    </mesh>
  )
}
```

**useFrame Parameters**:
- `state` - Scene state (camera, scene, gl, clock, etc.)
- `delta` - Time since last frame (for frame-rate independence)
- `xrFrame` - XR frame data (for VR/AR)

**Important**: Never use `setState` inside `useFrame` - it causes unnecessary re-renders!

### 4. useThree Hook

Access scene state and methods:

```jsx
import { useThree } from '@react-three/fiber'

function CameraInfo() {
  const { camera, gl, scene, size, viewport } = useThree()

  // Selective subscription (only re-render on size change)
  const size = useThree((state) => state.size)

  // Get state non-reactively
  const get = useThree((state) => state.get)
  const freshState = get() // Latest state without triggering re-render

  return null
}
```

**Available State**:
- `camera` - Default camera
- `scene` - Three.js scene
- `gl` - WebGL renderer
- `size` - Canvas dimensions
- `viewport` - Viewport dimensions in 3D units
- `clock` - Three.js clock
- `pointer` - Normalized mouse coordinates
- `invalidate()` - Manually trigger render
- `setSize()` - Manually resize canvas

### 5. useLoader Hook

Load assets with automatic caching and Suspense integration:

```jsx
import { Suspense } from 'react'
import { useLoader } from '@react-three/fiber'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader'
import { TextureLoader } from 'three'

function Model() {
  const gltf = useLoader(GLTFLoader, '/model.glb')
  return <primitive object={gltf.scene} />
}

function TexturedMesh() {
  const texture = useLoader(TextureLoader, '/texture.jpg')
  return (
    <mesh>
      <boxGeometry />
      <meshStandardMaterial map={texture} />
    </mesh>
  )
}

function App() {
  return (
    <Canvas>
      <Suspense fallback={<LoadingIndicator />}>
        <Model />
        <TexturedMesh />
      </Suspense>
    </Canvas>
  )
}
```

**Loading Multiple Assets**:
```jsx
const [texture1, texture2, texture3] = useLoader(TextureLoader, [
  '/tex1.jpg',
  '/tex2.jpg',
  '/tex3.jpg'
])
```

**Loader Extensions**:
```jsx
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader'

useLoader(GLTFLoader, '/model.glb', (loader) => {
  const dracoLoader = new DRACOLoader()
  dracoLoader.setDecoderPath('/draco/')
  loader.setDRACOLoader(dracoLoader)
})
```

**Pre-loading**:
```jsx
// Pre-load assets before component mounts
useLoader.preload(GLTFLoader, '/model.glb')
```

---

## Common Patterns

### Pattern 1: Basic Scene Setup

```jsx
import { Canvas } from '@react-three/fiber'

function Scene() {
  return (
    <>
      {/* Lights */}
      <ambientLight intensity={0.5} />
      <spotLight position={[10, 10, 10]} angle={0.15} penumbra={1} />

      {/* Objects */}
      <mesh position={[0, 0, 0]}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="hotpink" />
      </mesh>
    </>
  )
}

function App() {
  return (
    <Canvas camera={{ position: [0, 0, 5], fov: 75 }}>
      <Scene />
    </Canvas>
  )
}
```

### Pattern 2: Interactive Objects (Click, Hover)

```jsx
import { useState } from 'react'

function InteractiveBox() {
  const [hovered, setHovered] = useState(false)
  const [active, setActive] = useState(false)

  return (
    <mesh
      scale={active ? 1.5 : 1}
      onClick={() => setActive(!active)}
      onPointerOver={() => setHovered(true)}
      onPointerOut={() => setHovered(false)}
    >
      <boxGeometry />
      <meshStandardMaterial color={hovered ? 'hotpink' : 'orange'} />
    </mesh>
  )
}
```

### Pattern 3: Animated Component with useFrame

```jsx
import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'

function AnimatedSphere() {
  const meshRef = useRef()

  useFrame((state, delta) => {
    // Rotate
    meshRef.current.rotation.y += delta

    // Oscillate position
    const time = state.clock.elapsedTime
    meshRef.current.position.y = Math.sin(time) * 2
  })

  return (
    <mesh ref={meshRef}>
      <sphereGeometry args={[1, 32, 32]} />
      <meshStandardMaterial color="cyan" />
    </mesh>
  )
}
```

### Pattern 4: Loading GLTF Models

```jsx
import { Suspense } from 'react'
import { useLoader } from '@react-three/fiber'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader'

function Model({ url }) {
  const gltf = useLoader(GLTFLoader, url)

  return (
    <primitive
      object={gltf.scene}
      scale={0.5}
      position={[0, 0, 0]}
    />
  )
}

function App() {
  return (
    <Canvas>
      <Suspense fallback={<LoadingPlaceholder />}>
        <Model url="/model.glb" />
      </Suspense>
    </Canvas>
  )
}

function LoadingPlaceholder() {
  return (
    <mesh>
      <boxGeometry />
      <meshBasicMaterial wireframe />
    </mesh>
  )
}
```

### Pattern 5: Multiple Lights

```jsx
function Lighting() {
  return (
    <>
      {/* Ambient light for base illumination */}
      <ambientLight intensity={0.3} />

      {/* Directional light with shadows */}
      <directionalLight
        position={[5, 5, 5]}
        intensity={1}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
      />

      {/* Point light for accent */}
      <pointLight position={[-5, 5, -5]} intensity={0.5} color="blue" />

      {/* Spot light for focused illumination */}
      <spotLight
        position={[10, 10, 10]}
        angle={0.3}
        penumbra={1}
        intensity={1}
      />
    </>
  )
}
```

### Pattern 6: Instancing (Many Objects)

```jsx
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'

function Particles({ count = 1000 }) {
  const meshRef = useRef()

  // Generate random positions
  const particles = useMemo(() => {
    const temp = []
    for (let i = 0; i < count; i++) {
      const t = Math.random() * 100
      const factor = 20 + Math.random() * 100
      const speed = 0.01 + Math.random() / 200
      const x = Math.random() * 2 - 1
      const y = Math.random() * 2 - 1
      const z = Math.random() * 2 - 1
      temp.push({ t, factor, speed, x, y, z, mx: 0, my: 0 })
    }
    return temp
  }, [count])

  const dummy = useMemo(() => new THREE.Object3D(), [])

  useFrame(() => {
    particles.forEach((particle, i) => {
      let { t, factor, speed, x, y, z } = particle
      t = particle.t += speed / 2
      const a = Math.cos(t) + Math.sin(t * 1) / 10
      const b = Math.sin(t) + Math.cos(t * 2) / 10
      const s = Math.cos(t)

      dummy.position.set(
        x + Math.cos((t / 10) * factor) + (Math.sin(t * 1) * factor) / 10,
        y + Math.sin((t / 10) * factor) + (Math.cos(t * 2) * factor) / 10,
        z + Math.cos((t / 10) * factor) + (Math.sin(t * 3) * factor) / 10
      )
      dummy.scale.set(s, s, s)
      dummy.updateMatrix()
      meshRef.current.setMatrixAt(i, dummy.matrix)
    })
    meshRef.current.instanceMatrix.needsUpdate = true
  })

  return (
    <instancedMesh ref={meshRef} args={[null, null, count]}>
      <sphereGeometry args={[0.05, 8, 8]} />
      <meshBasicMaterial color="white" />
    </instancedMesh>
  )
}
```

### Pattern 7: Groups and Nesting

```jsx
function Robot() {
  return (
    <group position={[0, 0, 0]}>
      {/* Body */}
      <mesh position={[0, 0, 0]}>
        <boxGeometry args={[1, 2, 1]} />
        <meshStandardMaterial color="gray" />
      </mesh>

      {/* Head */}
      <mesh position={[0, 1.5, 0]}>
        <sphereGeometry args={[0.5, 32, 32]} />
        <meshStandardMaterial color="silver" />
      </mesh>

      {/* Arms */}
      <group position={[-0.75, 0.5, 0]}>
        <mesh>
          <cylinderGeometry args={[0.1, 0.1, 1.5]} />
          <meshStandardMaterial color="darkgray" />
        </mesh>
      </group>

      <group position={[0.75, 0.5, 0]}>
        <mesh>
          <cylinderGeometry args={[0.1, 0.1, 1.5]} />
          <meshStandardMaterial color="darkgray" />
        </mesh>
      </group>
    </group>
  )
}
```

---

## Integration with Drei Helpers

[Drei](https://github.com/pmndrs/drei) is the essential helper library for R3F, providing ready-to-use components:

### OrbitControls

```jsx
import { OrbitControls } from '@react-three/drei'

<Canvas>
  <OrbitControls
    makeDefault
    enableDamping
    dampingFactor={0.05}
    minDistance={3}
    maxDistance={20}
  />
  <Box />
</Canvas>
```

### Environment & Lighting

```jsx
import { Environment, ContactShadows } from '@react-three/drei'

<Canvas>
  {/* HDRI environment map */}
  <Environment preset="sunset" />

  {/* Or custom */}
  <Environment files="/hdri.hdr" />

  {/* Soft contact shadows */}
  <ContactShadows
    opacity={0.5}
    scale={10}
    blur={1}
    far={10}
    resolution={256}
  />

  <Model />
</Canvas>
```

### Text

```jsx
import { Text, Text3D } from '@react-three/drei'

// 2D Billboard text
<Text
  position={[0, 2, 0]}
  fontSize={1}
  color="white"
  anchorX="center"
  anchorY="middle"
>
  Hello World
</Text>

// 3D extruded text
<Text3D
  font="/fonts/helvetiker_regular.typeface.json"
  size={1}
  height={0.2}
>
  3D Text
  <meshNormalMaterial />
</Text3D>
```

### useGLTF Hook (Drei)

```jsx
import { useGLTF } from '@react-three/drei'

function Model() {
  const { scene, materials, nodes } = useGLTF('/model.glb')

  return <primitive object={scene} />
}

// Pre-load
useGLTF.preload('/model.glb')
```

### Center & Bounds

```jsx
import { Center, Bounds, useBounds } from '@react-three/drei'

// Auto-center objects
<Center>
  <Model />
</Center>

// Auto-fit camera to bounds
<Bounds fit clip observe margin={1.2}>
  <Model />
</Bounds>
```

### HTML Overlay

```jsx
import { Html } from '@react-three/drei'

<mesh>
  <boxGeometry />
  <meshStandardMaterial />

  <Html
    position={[0, 1, 0]}
    center
    distanceFactor={10}
  >
    <div className="annotation">
      This is a box
    </div>
  </Html>
</mesh>
```

### Scroll Controls

```jsx
import { ScrollControls, Scroll, useScroll } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'

function AnimatedScene() {
  const scroll = useScroll()
  const meshRef = useRef()

  useFrame(() => {
    const offset = scroll.offset // 0-1 normalized scroll position
    meshRef.current.position.y = offset * 10
  })

  return <mesh ref={meshRef}>...</mesh>
}

<Canvas>
  <ScrollControls pages={3} damping={0.5}>
    <Scroll>
      <AnimatedScene />
    </Scroll>

    {/* HTML overlay */}
    <Scroll html>
      <div style={{ height: '100vh' }}>
        <h1>Scrollable content</h1>
      </div>
    </Scroll>
  </ScrollControls>
</Canvas>
```

---

## Integration with Other Libraries

### With GSAP

```jsx
import { useRef, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import gsap from 'gsap'

function AnimatedBox() {
  const meshRef = useRef()

  useEffect(() => {
    // GSAP timeline animation
    const tl = gsap.timeline({ repeat: -1, yoyo: true })

    tl.to(meshRef.current.position, {
      y: 2,
      duration: 1,
      ease: 'power2.inOut'
    })
    .to(meshRef.current.rotation, {
      y: Math.PI * 2,
      duration: 2,
      ease: 'none'
    }, 0)

    return () => tl.kill()
  }, [])

  return (
    <mesh ref={meshRef}>
      <boxGeometry />
      <meshStandardMaterial color="orange" />
    </mesh>
  )
}
```

### With Framer Motion

```jsx
import { motion } from 'framer-motion-3d'

function AnimatedSphere() {
  return (
    <motion.mesh
      initial={{ scale: 0 }}
      animate={{ scale: 1 }}
      transition={{ duration: 1 }}
    >
      <sphereGeometry />
      <meshStandardMaterial color="hotpink" />
    </motion.mesh>
  )
}
```

### With Zustand (State Management)

```jsx
import create from 'zustand'

const useStore = create((set) => ({
  color: 'orange',
  setColor: (color) => set({ color })
}))

function Box() {
  const color = useStore((state) => state.color)
  const setColor = useStore((state) => state.setColor)

  return (
    <mesh onClick={() => setColor('hotpink')}>
      <boxGeometry />
      <meshStandardMaterial color={color} />
    </mesh>
  )
}
```

---

## Performance Optimization

### 1. On-Demand Rendering

```jsx
<Canvas frameloop="demand">
  {/* Only renders when needed */}
</Canvas>

// Manually trigger render
function MyComponent() {
  const invalidate = useThree((state) => state.invalidate)

  return (
    <mesh onClick={() => invalidate()}>
      <boxGeometry />
      <meshStandardMaterial />
    </mesh>
  )
}
```

### 2. Instancing

Use `<instancedMesh>` for rendering many identical objects:

```jsx
function Particles({ count = 10000 }) {
  const meshRef = useRef()

  useEffect(() => {
    const temp = new THREE.Object3D()

    for (let i = 0; i < count; i++) {
      temp.position.set(
        Math.random() * 10 - 5,
        Math.random() * 10 - 5,
        Math.random() * 10 - 5
      )
      temp.updateMatrix()
      meshRef.current.setMatrixAt(i, temp.matrix)
    }

    meshRef.current.instanceMatrix.needsUpdate = true
  }, [count])

  return (
    <instancedMesh ref={meshRef} args={[null, null, count]}>
      <sphereGeometry args={[0.1, 8, 8]} />
      <meshBasicMaterial color="white" />
    </instancedMesh>
  )
}
```

### 3. Frustum Culling

Objects outside the camera view are automatically culled.

```jsx
// Disable for always-visible objects
<mesh frustumCulled={false}>
  <boxGeometry />
  <meshStandardMaterial />
</mesh>
```

### 4. LOD (Level of Detail)

```jsx
import { Detailed } from '@react-three/drei'

<Detailed distances={[0, 10, 20]}>
  {/* High detail - close to camera */}
  <mesh geometry={highPolyGeometry} />

  {/* Medium detail */}
  <mesh geometry={mediumPolyGeometry} />

  {/* Low detail - far from camera */}
  <mesh geometry={lowPolyGeometry} />
</Detailed>
```

### 5. Adaptive Performance

```jsx
import { AdaptiveDpr, AdaptiveEvents, PerformanceMonitor } from '@react-three/drei'

<Canvas>
  {/* Reduce DPR when performance drops */}
  <AdaptiveDpr pixelated />

  {/* Reduce raycast frequency */}
  <AdaptiveEvents />

  {/* Monitor and respond to performance */}
  <PerformanceMonitor
    onIncline={() => console.log('Performance improved')}
    onDecline={() => console.log('Performance degraded')}
  >
    <Scene />
  </PerformanceMonitor>
</Canvas>
```

### 6. Selective Re-renders

Use `useThree` selectors to avoid unnecessary re-renders:

```jsx
// ❌ Re-renders on any state change
const state = useThree()

// ✅ Only re-renders when size changes
const size = useThree((state) => state.size)

// ✅ Only re-renders when camera changes
const camera = useThree((state) => state.camera)
```

---

## Common Pitfalls & Solutions

### ❌ Pitfall 1: setState in useFrame

```jsx
// ❌ BAD: Triggers React re-renders every frame
const [x, setX] = useState(0)
useFrame(() => setX((x) => x + 0.1))
return <mesh position-x={x} />
```

✅ **Solution**: Mutate refs directly

```jsx
// ✅ GOOD: Direct mutation, no re-renders
const meshRef = useRef()
useFrame((state, delta) => {
  meshRef.current.position.x += delta
})
return <mesh ref={meshRef} />
```

### ❌ Pitfall 2: Creating Objects in Render

```jsx
// ❌ BAD: Creates new Vector3 every render
<mesh position={new THREE.Vector3(1, 2, 3)} />
```

✅ **Solution**: Use arrays or useMemo

```jsx
// ✅ GOOD: Use array notation
<mesh position={[1, 2, 3]} />

// Or useMemo for complex objects
const position = useMemo(() => new THREE.Vector3(1, 2, 3), [])
<mesh position={position} />
```

### ❌ Pitfall 3: Not Using useLoader Cache

```jsx
// ❌ BAD: Loads texture every render
function Component() {
  const [texture, setTexture] = useState()
  useEffect(() => {
    new TextureLoader().load('/texture.jpg', setTexture)
  }, [])
  return texture ? <meshBasicMaterial map={texture} /> : null
}
```

✅ **Solution**: Use useLoader (automatic caching)

```jsx
// ✅ GOOD: Cached and reused
function Component() {
  const texture = useLoader(TextureLoader, '/texture.jpg')
  return <meshBasicMaterial map={texture} />
}
```

### ❌ Pitfall 4: Conditional Mounting (Expensive)

```jsx
// ❌ BAD: Unmounts and remounts (expensive)
{stage === 1 && <Stage1 />}
{stage === 2 && <Stage2 />}
{stage === 3 && <Stage3 />}
```

✅ **Solution**: Use visibility prop

```jsx
// ✅ GOOD: Components stay mounted, just hidden
<Stage1 visible={stage === 1} />
<Stage2 visible={stage === 2} />
<Stage3 visible={stage === 3} />

function Stage1({ visible, ...props }) {
  return <group {...props} visible={visible}>...</group>
}
```

### ❌ Pitfall 5: useThree Outside Canvas

```jsx
// ❌ BAD: Crashes - useThree must be inside Canvas
function App() {
  const { size } = useThree()
  return <Canvas>...</Canvas>
}
```

✅ **Solution**: Use hooks inside Canvas children

```jsx
// ✅ GOOD: useThree inside Canvas child
function CameraInfo() {
  const { size } = useThree()
  return null
}

function App() {
  return (
    <Canvas>
      <CameraInfo />
    </Canvas>
  )
}
```

### ❌ Pitfall 6: Not Disposing Resources

```jsx
// ❌ BAD: Memory leak - textures not disposed
const texture = useLoader(TextureLoader, '/texture.jpg')
```

✅ **Solution**: R3F handles disposal automatically, but be careful with manual Three.js objects

```jsx
// ✅ GOOD: Manual cleanup when needed
useEffect(() => {
  const geometry = new THREE.SphereGeometry(1)
  const material = new THREE.MeshBasicMaterial()

  return () => {
    geometry.dispose()
    material.dispose()
  }
}, [])
```

---

## Best Practices

### 1. Component Composition

Break scenes into reusable components:

```jsx
function Lights() {
  return (
    <>
      <ambientLight intensity={0.5} />
      <spotLight position={[10, 10, 10]} angle={0.15} />
    </>
  )
}

function Scene() {
  return (
    <>
      <Lights />
      <Model />
      <Ground />
      <Effects />
    </>
  )
}

<Canvas>
  <Scene />
</Canvas>
```

### 2. Suspend Heavy Assets

Always wrap async operations in Suspense:

```jsx
<Canvas>
  <Suspense fallback={<Loader />}>
    <Model />
    <Environment />
  </Suspense>
</Canvas>
```

### 3. Use TypeScript

```typescript
import { ThreeElements } from '@react-three/fiber'

function Box(props: ThreeElements['mesh']) {
  return (
    <mesh {...props}>
      <boxGeometry />
      <meshStandardMaterial />
    </mesh>
  )
}
```

### 4. Organize by Feature

```
src/
  components/
    3d/
      Scene.tsx
      Lights.tsx
      Camera.tsx
    models/
      Robot.tsx
      Character.tsx
    effects/
      PostProcessing.tsx
```

### 5. Test with React DevTools Profiler

Monitor re-renders and optimize components causing performance issues.

---

## Resources

### References
- `references/api_reference.md` - Complete R3F & Drei API documentation
- `references/hooks_guide.md` - Detailed hooks usage and patterns
- `references/drei_helpers.md` - Comprehensive Drei library guide

### Scripts
- `scripts/component_generator.py` - Generate R3F component boilerplate
- `scripts/scene_setup.py` - Initialize R3F scene with common patterns

### Assets
- `assets/starter_r3f/` - Complete R3F + Vite starter template
- `assets/examples/` - Real-world R3F component examples

### External Resources
- [Official Docs](https://docs.pmnd.rs/react-three-fiber)
- [Drei Docs](https://github.com/pmndrs/drei)
- [Three.js Docs](https://threejs.org/docs/)
- [R3F Discord](https://discord.gg/ZZjjNvJ)
- [Poimandres (pmnd.rs)](https://pmnd.rs/) - Ecosystem overview
