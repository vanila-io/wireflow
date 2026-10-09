# anti-patterns.md -- React Three Fiber Anti-Patterns

> What NOT to do with @react-three/fiber 8.x+. Each anti-pattern includes the mistake, why it fails, and the correct alternative.

---

## Anti-Pattern 1: Creating Objects Inside useFrame

### WRONG

```tsx
function BadAnimation() {
  useFrame((state) => {
    // WRONG: allocates a new Vector3 every frame (60+ times per second)
    const target = new THREE.Vector3(
      Math.sin(state.clock.elapsedTime),
      0,
      0
    )
    meshRef.current.position.copy(target)
  })
}
```

### WHY IT FAILS

`useFrame` runs every frame. Creating objects inside it causes thousands of allocations per minute, triggering garbage collection pauses and frame drops.

### CORRECT

```tsx
function GoodAnimation() {
  const target = useMemo(() => new THREE.Vector3(), [])

  useFrame((state) => {
    target.set(Math.sin(state.clock.elapsedTime), 0, 0)
    meshRef.current.position.copy(target)
  })
}
```

ALWAYS create reusable objects with `useMemo` or `useRef` outside `useFrame`.

---

## Anti-Pattern 2: Missing Suspense Boundary for useLoader

### WRONG

```tsx
function Model() {
  const gltf = useLoader(GLTFLoader, '/model.glb')
  return <primitive object={gltf.scene} />
}

// No Suspense boundary -- crashes with unhandled suspension
function App() {
  return (
    <Canvas>
      <Model />
    </Canvas>
  )
}
```

### WHY IT FAILS

`useLoader` uses React Suspense internally. Without a `<Suspense>` boundary, React throws an error because it has no fallback to show during loading.

### CORRECT

```tsx
function App() {
  return (
    <Canvas>
      <Suspense fallback={null}>
        <Model />
      </Suspense>
    </Canvas>
  )
}
```

ALWAYS wrap components that use `useLoader` in `<Suspense fallback={...}>`.

---

## Anti-Pattern 3: Using useThree Without a Selector

### WRONG

```tsx
function CameraLogger() {
  // WRONG: subscribes to the ENTIRE state -- re-renders on every frame
  const state = useThree()
  console.log(state.camera.position)
  return null
}
```

### WHY IT FAILS

`useThree()` without a selector returns the full RootState object, which changes on every frame (pointer position, clock, etc.). This causes the component to re-render 60+ times per second unnecessarily.

### CORRECT

```tsx
function CameraLogger() {
  // Selector: only re-renders when the camera itself changes
  const camera = useThree((state) => state.camera)
  console.log(camera.position)
  return null
}
```

ALWAYS use a selector function when you only need specific properties from the R3F state.

---

## Anti-Pattern 4: Imperative scene.add() Inside R3F

### WRONG

```tsx
function BadMesh() {
  const { scene } = useThree()

  useEffect(() => {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(),
      new THREE.MeshBasicMaterial({ color: 'red' })
    )
    scene.add(mesh) // WRONG: bypasses R3F reconciler

    return () => {
      scene.remove(mesh)
      mesh.geometry.dispose()
      mesh.material.dispose()
    }
  }, [scene])

  return null
}
```

### WHY IT FAILS

R3F manages the scene graph declaratively. Imperatively adding objects via `scene.add()` bypasses the reconciler, which means:
- R3F does not track the object for events or disposal.
- The object may conflict with R3F's internal state.
- Manual cleanup is error-prone and often missed.

### CORRECT

```tsx
function GoodMesh() {
  return (
    <mesh>
      <boxGeometry />
      <meshBasicMaterial color="red" />
    </mesh>
  )
}
```

ALWAYS use JSX elements for scene objects. R3F handles creation, updates, and disposal automatically.

---

## Anti-Pattern 5: Reusing the Same Object Instance in Multiple Primitives

### WRONG

```tsx
function BadDuplication() {
  const gltf = useLoader(GLTFLoader, '/model.glb')

  return (
    <>
      {/* WRONG: same object instance appears twice */}
      <primitive object={gltf.scene} position={[0, 0, 0]} />
      <primitive object={gltf.scene} position={[5, 0, 0]} />
    </>
  )
}
```

### WHY IT FAILS

Three.js objects can only have ONE parent. Adding the same object to two locations silently removes it from the first and places it at the second. The first `<primitive>` renders nothing.

### CORRECT

```tsx
function GoodDuplication() {
  const gltf = useLoader(GLTFLoader, '/model.glb')

  // Clone for each instance
  const clone1 = useMemo(() => gltf.scene.clone(), [gltf])
  const clone2 = useMemo(() => gltf.scene.clone(), [gltf])

  return (
    <>
      <primitive object={clone1} position={[0, 0, 0]} />
      <primitive object={clone2} position={[5, 0, 0]} />
    </>
  )
}
```

ALWAYS clone objects when placing them at multiple positions. Use `useMemo` to avoid re-cloning on every render.

---

## Anti-Pattern 6: Forgetting dispose={null} for Shared Resources

### WRONG

```tsx
const sharedGeometry = new THREE.SphereGeometry(1, 32, 32)

function Particle({ position }) {
  return (
    <mesh position={position}>
      {/* WRONG: R3F will dispose this geometry when ANY Particle unmounts */}
      <primitive object={sharedGeometry} attach="geometry" />
      <meshBasicMaterial color="white" />
    </mesh>
  )
}
```

### WHY IT FAILS

R3F auto-disposes Three.js objects on unmount. When the first `Particle` unmounts, `sharedGeometry` is disposed -- corrupting all remaining particles that reference it.

### CORRECT

```tsx
function Particle({ position }) {
  return (
    <mesh position={position}>
      <primitive object={sharedGeometry} attach="geometry" dispose={null} />
      <meshBasicMaterial color="white" />
    </mesh>
  )
}
```

ALWAYS set `dispose={null}` on shared resources to prevent premature disposal.

---

## Anti-Pattern 7: Hardcoded Time Steps in Animations

### WRONG

```tsx
function BadRotation() {
  const meshRef = useRef<THREE.Mesh>(null!)

  useFrame(() => {
    // WRONG: rotates at different speeds depending on frame rate
    meshRef.current.rotation.y += 0.01
  })

  return <mesh ref={meshRef}><boxGeometry /><meshNormalMaterial /></mesh>
}
```

### WHY IT FAILS

A fixed increment per frame means the animation runs faster on 144Hz monitors and slower on 30fps devices. The visual result is inconsistent across hardware.

### CORRECT

```tsx
function GoodRotation() {
  const meshRef = useRef<THREE.Mesh>(null!)

  useFrame((state, delta) => {
    // Consistent rotation speed regardless of frame rate
    meshRef.current.rotation.y += delta * 0.5
  })

  return <mesh ref={meshRef}><boxGeometry /><meshNormalMaterial /></mesh>
}
```

ALWAYS multiply animation increments by `delta` for frame-rate-independent behavior.

---

## Anti-Pattern 8: Not Calling invalidate() in Demand Mode

### WRONG

```tsx
function BadDemandMode() {
  return (
    <Canvas frameloop="demand">
      <mesh
        onClick={(e) => {
          // WRONG: changes color but never requests a re-render
          e.object.material.color.set('red')
        }}
      >
        <boxGeometry />
        <meshStandardMaterial />
      </mesh>
    </Canvas>
  )
}
```

### WHY IT FAILS

In `frameloop="demand"` mode, R3F does NOT render continuously. Changing a property without calling `invalidate()` means the change is never drawn to screen.

### CORRECT

```tsx
function GoodDemandMode() {
  const invalidate = useThree((s) => s.invalidate)

  return (
    <mesh
      onClick={(e) => {
        e.object.material.color.set('red')
        invalidate() // Tell R3F to render the next frame
      }}
    >
      <boxGeometry />
      <meshStandardMaterial />
    </mesh>
  )
}
```

ALWAYS call `invalidate()` after any visual mutation when using `frameloop="demand"`.
