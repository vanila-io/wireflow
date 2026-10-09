# React Three Fiber - Real-World Component Examples

A comprehensive collection of production-ready R3F component patterns and examples.

## Table of Contents

1. [GLTF Model Loading](#1-gltf-model-loading)
2. [Interactive Product Viewer](#2-interactive-product-viewer)
3. [Scroll-Based Animations](#3-scroll-based-animations)
4. [Particle System](#4-particle-system)
5. [Text 3D](#5-text-3d)
6. [Post-Processing Effects](#6-post-processing-effects)
7. [Physics Simulation](#7-physics-simulation)
8. [Camera Animations](#8-camera-animations)
9. [LOD (Level of Detail)](#9-lod-level-of-detail)
10. [Performance Monitoring](#10-performance-monitoring)

---

## 1. GLTF Model Loading

### Basic Model Loader

```jsx
import { useGLTF } from '@react-three/drei'
import { Suspense } from 'react'

function Model({ url, ...props }) {
  const { scene } = useGLTF(url)
  return <primitive object={scene} {...props} />
}

// Preload for faster initial load
useGLTF.preload('/models/scene.glb')

export default function Scene() {
  return (
    <Suspense fallback={<Loader />}>
      <Model url="/models/scene.glb" position={[0, 0, 0]} scale={0.5} />
    </Suspense>
  )
}

function Loader() {
  return (
    <mesh>
      <boxGeometry args={[1, 1, 1]} />
      <meshBasicMaterial wireframe color="white" />
    </mesh>
  )
}
```

### Model with Animations

```jsx
import { useGLTF, useAnimations } from '@react-three/drei'
import { useEffect, useRef } from 'react'

function AnimatedModel({ url }) {
  const group = useRef()
  const { scene, animations } = useGLTF(url)
  const { actions, names } = useAnimations(animations, group)

  useEffect(() => {
    // Play first animation
    actions[names[0]]?.play()
  }, [actions, names])

  return <primitive ref={group} object={scene} />
}

useGLTF.preload('/models/animated.glb')
```

### Model with Material Override

```jsx
import { useGLTF } from '@react-three/drei'
import { useEffect } from 'react'
import * as THREE from 'three'

function ModelWithCustomMaterial({ url }) {
  const { scene } = useGLTF(url)

  useEffect(() => {
    const customMaterial = new THREE.MeshStandardMaterial({
      color: '#ff6b6b',
      metalness: 0.8,
      roughness: 0.2,
    })

    scene.traverse((child) => {
      if (child.isMesh) {
        child.material = customMaterial
        child.castShadow = true
        child.receiveShadow = true
      }
    })
  }, [scene])

  return <primitive object={scene} />
}
```

---

## 2. Interactive Product Viewer

```jsx
import { useRef, useState } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls, Environment, useGLTF, Center, Bounds } from '@react-three/drei'
import { useControls } from 'leva'

function Product({ url }) {
  const { scene } = useGLTF(url)
  const meshRef = useRef()
  const [hovered, setHovered] = useState(false)

  // Material controls
  const { metalness, roughness, color } = useControls({
    metalness: { value: 0.9, min: 0, max: 1, step: 0.01 },
    roughness: { value: 0.1, min: 0, max: 1, step: 0.01 },
    color: '#ffffff',
  })

  useFrame((state) => {
    if (hovered) {
      meshRef.current.rotation.y += 0.01
    }
  })

  return (
    <Center>
      <primitive
        ref={meshRef}
        object={scene}
        onPointerOver={() => setHovered(true)}
        onPointerOut={() => setHovered(false)}
        onClick={(e) => {
          e.stopPropagation()
          console.log('Product clicked:', e.object.name)
        }}
      />
    </Center>
  )
}

export default function ProductViewer() {
  return (
    <Canvas camera={{ position: [0, 0, 5], fov: 45 }}>
      <color attach="background" args={['#f0f0f0']} />

      <ambientLight intensity={0.5} />
      <directionalLight position={[5, 5, 5]} intensity={1} />

      <Suspense fallback={null}>
        <Bounds fit clip observe margin={1.2}>
          <Product url="/models/product.glb" />
        </Bounds>
        <Environment preset="studio" />
      </Suspense>

      <OrbitControls
        enablePan={false}
        minDistance={2}
        maxDistance={10}
        minPolarAngle={Math.PI / 4}
        maxPolarAngle={Math.PI / 2}
      />
    </Canvas>
  )
}
```

---

## 3. Scroll-Based Animations

### Using Drei ScrollControls

```jsx
import { Canvas } from '@react-three/fiber'
import { ScrollControls, Scroll, useScroll } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useRef } from 'react'

function ScrollScene() {
  const meshRef = useRef()
  const scroll = useScroll()

  useFrame(() => {
    // scroll.offset: 0 to 1
    meshRef.current.position.y = scroll.offset * -10
    meshRef.current.rotation.y = scroll.offset * Math.PI * 2
  })

  return (
    <mesh ref={meshRef}>
      <boxGeometry />
      <meshStandardMaterial color="orange" />
    </mesh>
  )
}

export default function ScrollAnimation() {
  return (
    <Canvas>
      <ambientLight intensity={0.5} />
      <directionalLight position={[5, 5, 5]} />

      <ScrollControls pages={3} damping={0.1}>
        <Scroll>
          <ScrollScene />
        </Scroll>

        {/* HTML content that scrolls */}
        <Scroll html>
          <div style={{ height: '100vh' }}>
            <h1>Page 1</h1>
          </div>
          <div style={{ height: '100vh' }}>
            <h1>Page 2</h1>
          </div>
          <div style={{ height: '100vh' }}>
            <h1>Page 3</h1>
          </div>
        </Scroll>
      </ScrollControls>
    </Canvas>
  )
}
```

### Syncing with GSAP ScrollTrigger

```jsx
import { useRef, useEffect } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

gsap.registerPlugin(ScrollTrigger)

function ScrollSyncedBox() {
  const meshRef = useRef()
  const { viewport } = useThree()

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.to(meshRef.current.position, {
        x: 5,
        scrollTrigger: {
          trigger: '.section-2',
          start: 'top center',
          end: 'bottom center',
          scrub: true,
        },
      })

      gsap.to(meshRef.current.rotation, {
        y: Math.PI * 2,
        scrollTrigger: {
          trigger: '.section-2',
          start: 'top center',
          end: 'bottom center',
          scrub: true,
        },
      })
    })

    return () => ctx.revert()
  }, [])

  return (
    <mesh ref={meshRef}>
      <boxGeometry />
      <meshStandardMaterial color="orange" />
    </mesh>
  )
}
```

---

## 4. Particle System

### Instanced Particles

```jsx
import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

export default function Particles({ count = 5000 }) {
  const meshRef = useRef()

  const particles = useMemo(() => {
    const temp = []
    for (let i = 0; i < count; i++) {
      const t = Math.random() * 100
      const factor = 20 + Math.random() * 100
      const speed = 0.01 + Math.random() / 200
      const x = Math.random() * 40 - 20
      const y = Math.random() * 40 - 20
      const z = Math.random() * 40 - 20
      temp.push({ t, factor, speed, x, y, z })
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
      dummy.rotation.set(s * 5, s * 5, s * 5)
      dummy.updateMatrix()

      meshRef.current.setMatrixAt(i, dummy.matrix)
    })
    meshRef.current.instanceMatrix.needsUpdate = true
  })

  return (
    <instancedMesh ref={meshRef} args={[null, null, count]}>
      <dodecahedronGeometry args={[0.1, 0]} />
      <meshPhongMaterial color="#ff4040" />
    </instancedMesh>
  )
}
```

---

## 5. Text 3D

### Using Drei Text

```jsx
import { Text } from '@react-three/drei'
import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'

export default function Text3D() {
  const textRef = useRef()

  useFrame((state) => {
    textRef.current.position.y = Math.sin(state.clock.elapsedTime) * 0.5
  })

  return (
    <Text
      ref={textRef}
      fontSize={1}
      color="#ffffff"
      anchorX="center"
      anchorY="middle"
      font="/fonts/Inter-Bold.woff"
    >
      Hello R3F!
    </Text>
  )
}
```

### Text with Gradient Material

```jsx
import { Text, shaderMaterial } from '@react-three/drei'
import { extend } from '@react-three/fiber'
import * as THREE from 'three'

const GradientMaterial = shaderMaterial(
  { uTime: 0 },
  // Vertex shader
  `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  // Fragment shader
  `
    uniform float uTime;
    varying vec2 vUv;
    void main() {
      vec3 colorA = vec3(1.0, 0.4, 0.7);
      vec3 colorB = vec3(0.2, 0.6, 1.0);
      vec3 color = mix(colorA, colorB, vUv.y);
      gl_FragColor = vec4(color, 1.0);
    }
  `
)

extend({ GradientMaterial })

export default function GradientText() {
  const materialRef = useRef()

  useFrame((state) => {
    materialRef.current.uTime = state.clock.elapsedTime
  })

  return (
    <Text fontSize={1} anchorX="center" anchorY="middle">
      Gradient Text
      <gradientMaterial ref={materialRef} />
    </Text>
  )
}
```

---

## 6. Post-Processing Effects

```bash
npm install @react-three/postprocessing
```

```jsx
import { Canvas } from '@react-three/fiber'
import { EffectComposer, Bloom, DepthOfField, Vignette } from '@react-three/postprocessing'

export default function PostProcessingScene() {
  return (
    <Canvas>
      <ambientLight intensity={0.5} />
      <directionalLight position={[5, 5, 5]} />

      <mesh>
        <torusKnotGeometry />
        <meshStandardMaterial color="orange" emissive="orange" emissiveIntensity={0.5} />
      </mesh>

      <EffectComposer>
        <Bloom
          intensity={1.5}
          luminanceThreshold={0}
          luminanceSmoothing={0.9}
        />
        <DepthOfField
          focusDistance={0}
          focalLength={0.02}
          bokehScale={2}
        />
        <Vignette
          offset={0.5}
          darkness={0.5}
        />
      </EffectComposer>
    </Canvas>
  )
}
```

---

## 7. Physics Simulation

```bash
npm install @react-three/rapier
```

```jsx
import { Canvas } from '@react-three/fiber'
import { Physics, RigidBody, CuboidCollider } from '@react-three/rapier'

function Box({ position }) {
  return (
    <RigidBody position={position} colliders="cuboid">
      <mesh castShadow>
        <boxGeometry />
        <meshStandardMaterial color="orange" />
      </mesh>
    </RigidBody>
  )
}

function Floor() {
  return (
    <RigidBody type="fixed">
      <CuboidCollider args={[10, 0.5, 10]} />
      <mesh receiveShadow position={[0, -0.5, 0]}>
        <boxGeometry args={[20, 1, 20]} />
        <meshStandardMaterial color="#808080" />
      </mesh>
    </RigidBody>
  )
}

export default function PhysicsScene() {
  return (
    <Canvas shadows camera={{ position: [0, 5, 10] }}>
      <ambientLight intensity={0.5} />
      <directionalLight position={[5, 5, 5]} castShadow />

      <Physics gravity={[0, -9.81, 0]}>
        <Box position={[0, 5, 0]} />
        <Box position={[1, 8, 0]} />
        <Box position={[-1, 10, 0]} />
        <Floor />
      </Physics>
    </Canvas>
  )
}
```

---

## 8. Camera Animations

### Smooth Camera Movement

```jsx
import { useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'

export default function CameraRig({ children }) {
  const ref = useRef()
  const { camera, pointer } = useThree()

  useFrame((state, delta) => {
    // Smooth camera follow mouse
    const targetX = pointer.x * 2
    const targetY = pointer.y * 2

    camera.position.x += (targetX - camera.position.x) * delta * 2
    camera.position.y += (targetY - camera.position.y) * delta * 2

    camera.lookAt(0, 0, 0)
  })

  return <group ref={ref}>{children}</group>
}
```

### Camera Path Animation

```jsx
import { useEffect, useRef } from 'react'
import { useThree } from '@react-three/fiber'
import * as THREE from 'three'
import gsap from 'gsap'

export default function CameraPath() {
  const { camera } = useThree()
  const pathRef = useRef()

  useEffect(() => {
    // Define camera path points
    const points = [
      new THREE.Vector3(0, 0, 5),
      new THREE.Vector3(5, 2, 5),
      new THREE.Vector3(5, 2, -5),
      new THREE.Vector3(-5, 2, -5),
      new THREE.Vector3(-5, 2, 5),
      new THREE.Vector3(0, 0, 5),
    ]

    const curve = new THREE.CatmullRomCurve3(points)
    pathRef.current = curve

    // Animate camera along path
    gsap.to({ progress: 0 }, {
      progress: 1,
      duration: 10,
      repeat: -1,
      ease: 'none',
      onUpdate: function() {
        const point = curve.getPointAt(this.targets()[0].progress)
        camera.position.copy(point)
        camera.lookAt(0, 0, 0)
      }
    })
  }, [camera])

  return null
}
```

---

## 9. LOD (Level of Detail)

```jsx
import { useMemo } from 'react'
import { useThree } from '@react-three/fiber'
import * as THREE from 'three'

export default function LODMesh({ position }) {
  const { camera } = useThree()

  const lod = useMemo(() => {
    const lodObject = new THREE.LOD()

    // High detail (close)
    const geometryHigh = new THREE.IcosahedronGeometry(1, 3)
    const materialHigh = new THREE.MeshStandardMaterial({ color: 'orange' })
    const meshHigh = new THREE.Mesh(geometryHigh, materialHigh)
    lodObject.addLevel(meshHigh, 0)

    // Medium detail
    const geometryMid = new THREE.IcosahedronGeometry(1, 1)
    const materialMid = new THREE.MeshStandardMaterial({ color: 'orange' })
    const meshMid = new THREE.Mesh(geometryMid, materialMid)
    lodObject.addLevel(meshMid, 10)

    // Low detail (far)
    const geometryLow = new THREE.IcosahedronGeometry(1, 0)
    const materialLow = new THREE.MeshStandardMaterial({ color: 'orange' })
    const meshLow = new THREE.Mesh(geometryLow, materialLow)
    lodObject.addLevel(meshLow, 20)

    lodObject.position.set(...position)
    return lodObject
  }, [position])

  useFrame(() => {
    lod.update(camera)
  })

  return <primitive object={lod} />
}
```

---

## 10. Performance Monitoring

```jsx
import { Canvas } from '@react-three/fiber'
import {
  PerformanceMonitor,
  AdaptiveDpr,
  AdaptiveEvents,
  Stats
} from '@react-three/drei'
import { useState } from 'react'

export default function AdaptiveScene() {
  const [dpr, setDpr] = useState(1.5)

  return (
    <>
      <Stats />
      <Canvas dpr={dpr}>
        <PerformanceMonitor
          onIncline={() => setDpr(2)}
          onDecline={() => setDpr(1)}
        >
          <AdaptiveDpr pixelated />
          <AdaptiveEvents />

          {/* Your scene */}
          <ambientLight intensity={0.5} />
          <mesh>
            <torusKnotGeometry args={[1, 0.3, 128, 32]} />
            <meshStandardMaterial color="orange" />
          </mesh>
        </PerformanceMonitor>
      </Canvas>
    </>
  )
}
```

---

## Additional Resources

- [Poimandres Market](https://market.pmnd.rs/) - Ready-to-use R3F components
- [Three.js Journey](https://threejs-journey.com/) - Comprehensive Three.js course
- [R3F Examples](https://docs.pmnd.rs/react-three-fiber/getting-started/examples) - Official examples
- [Codesandbox Collection](https://codesandbox.io/examples/package/@react-three/fiber) - Live examples

## Performance Best Practices

1. **Use instancing** for many similar objects
2. **Implement LOD** for distant objects
3. **Enable frustum culling** (automatic in R3F)
4. **Use adaptive DPR** for mobile devices
5. **Lazy load models** with Suspense
6. **Optimize textures** (compress, use power-of-2 sizes)
7. **Reduce shadow quality** on low-end devices
8. **Use frameloop="demand"** for static scenes
9. **Profile with Stats** and Chrome DevTools
10. **Dispose unused resources** properly

---

**Note**: All examples assume you have the necessary dependencies installed. Refer to each example's comments for additional package requirements.
