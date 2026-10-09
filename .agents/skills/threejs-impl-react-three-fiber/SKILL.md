---
name: threejs-impl-react-three-fiber
description: Use when building 3D scenes with React using React Three Fiber (R3F). Prevents the common mistake of mixing imperative Three.js code with R3F's declarative model, creating objects inside useFrame, or forgetting Suspense for loaders. Covers Canvas, useFrame, useThree, useLoader, JSX mapping, event system, performance patterns. Keywords: React Three Fiber, R3F, Canvas, useFrame, useThree, useLoader, @react-three/fiber, 3D React, declarative Three.js, use Three.js with React, JSX 3D components.
---

# threejs-impl-react-three-fiber

## Quick Reference

### Canvas Component Props

| Prop | Type | Default | Purpose |
|------|------|---------|---------|
| `gl` | `Renderer props \| (canvas) => Renderer` | `{}` | WebGL renderer config or factory |
| `camera` | `Camera props \| THREE.Camera` | `{ fov: 75, near: 0.1, far: 1000, position: [0,0,5] }` | Default camera |
| `scene` | `Scene props \| THREE.Scene` | `{}` | Scene configuration |
| `shadows` | `boolean \| ShadowMapType` | `false` | Enable shadow maps |
| `raycaster` | `Raycaster props` | `{}` | Raycaster configuration |
| `frameloop` | `"always" \| "demand" \| "never"` | `"always"` | Render loop strategy |
| `resize` | `ResizeOptions` | `{ scroll: true, debounce: { scroll: 50, resize: 0 } }` | Resize behavior |
| `orthographic` | `boolean` | `false` | Use OrthographicCamera |
| `dpr` | `number \| [min, max]` | `[1, 2]` | Device pixel ratio |
| `linear` | `boolean` | `false` | Linear color space |
| `flat` | `boolean` | `false` | Disable tone mapping |
| `legacy` | `boolean` | `false` | Disable color management |
| `events` | `EventManager` | R3F default | Custom event manager |
| `eventSource` | `HTMLElement \| React.RefObject` | Parent node | Event capture element |
| `eventPrefix` | `string` | `"offset"` | Coordinate prefix |
| `onCreated` | `(state: RootState) => void` | -- | Post-init callback |
| `onPointerMissed` | `(event: PointerEvent) => void` | -- | Click misses all meshes |
| `fallback` | `React.ReactNode` | -- | DOM fallback during init |

### Frameloop Modes

| Mode | Behavior |
|------|----------|
| `"always"` | ALWAYS renders every frame via requestAnimationFrame |
| `"demand"` | ONLY renders when `invalidate()` is called -- use for static scenes |
| `"never"` | NEVER renders automatically -- caller MUST invoke `advance(timestamp)` |

### Critical Warnings

**NEVER** create Three.js objects inside `useFrame` -- this allocates memory every frame and causes GC pressure. ALWAYS create objects outside the callback or use `useMemo`.

**NEVER** forget `<Suspense>` when using `useLoader` -- the component WILL suspend and crash without a Suspense boundary.

**NEVER** add the same Three.js object instance to the scene tree multiple times via `<primitive>` -- Three.js objects can only have one parent.

**NEVER** use `useThree()` without a selector when you only need one property -- the full state object triggers re-renders on every frame. ALWAYS use `useThree((s) => s.camera)`.

**NEVER** mix imperative `scene.add()` calls with R3F's declarative JSX tree -- R3F manages the scene graph and imperative mutations cause desync.

**ALWAYS** use `delta` from `useFrame` for animations -- hardcoded time steps cause speed variations across different frame rates.

**ALWAYS** use `useMemo` for imperatively created geometries and materials -- without it, new objects are allocated on every render.

---

## JSX-to-Three.js Mapping Rules

R3F uses deterministic conventions to translate JSX into Three.js scene graph operations:

1. **Lowercase JSX = Three.js class.** `<mesh />` creates `new THREE.Mesh()`. `<meshStandardMaterial />` creates `new THREE.MeshStandardMaterial()`.

2. **`args` = constructor arguments (array).** `<sphereGeometry args={[1, 32, 32]} />` becomes `new THREE.SphereGeometry(1, 32, 32)`. When `args` changes, the object is destroyed and recreated.

3. **`attach` = parent property binding.** `<meshStandardMaterial attach="material" />` sets `parent.material = this`. Geometries auto-attach to `"geometry"`, materials to `"material"`.

4. **Dash-notation attach for nested paths.** `attach="shadow-camera"` sets `parent.shadow.camera = this`. Array indexing: `attach="material-0"`.

5. **Functional attach.** `attach={(parent, self) => { parent.add(self); return () => parent.remove(self); }}` for custom bind/unbind.

6. **Properties with `.set()` accept shorthand.** `position={[1, 2, 3]}` calls `object.position.set(1, 2, 3)`. `color="hotpink"` calls `object.color.set("hotpink")`.

7. **Scalar shorthand.** `scale={2}` calls `object.scale.setScalar(2)`.

8. **Dash-case pierces nested properties.** `rotation-x={Math.PI}` sets `object.rotation.x = Math.PI`.

---

## Hooks

### useFrame

```typescript
useFrame((state: RootState, delta: number, xrFrame?: XRFrame) => void, priority?: number)
```

Subscribes a callback to the render loop. Executes every frame.

**State object key properties:**

| Property | Type | Description |
|----------|------|-------------|
| `gl` | `THREE.WebGLRenderer` | The renderer |
| `scene` | `THREE.Scene` | The scene |
| `camera` | `THREE.Camera` | Active camera |
| `clock` | `THREE.Clock` | System clock |
| `pointer` | `THREE.Vector2` | Normalized pointer (-1 to +1) |
| `size` | `{ width, height, top, left }` | Canvas dimensions (px) |
| `viewport` | `{ width, height, factor, distance, aspect }` | Camera-relative metrics |
| `invalidate` | `() => void` | Request render in demand mode |
| `advance` | `(timestamp: number) => void` | Advance one tick in never mode |
| `performance` | `{ current, min, max, regress() }` | Adaptive performance |
| `set` | `(state) => void` | Mutate state directly |
| `get` | `() => RootState` | Read state non-reactively |

**Priority system:** Callbacks execute in ascending priority order. When ANY callback has priority > 0, R3F disables automatic `renderer.render()`. The highest-priority subscriber MUST call `state.gl.render(state.scene, state.camera)` manually. Negative priorities do NOT disable auto-rendering.

### useThree

```typescript
const state = useThree()                              // full state (re-renders often)
const camera = useThree((state) => state.camera)      // selector (re-renders only on change)
```

Returns the RootState (same object as useFrame's state). ALWAYS use a selector when only one property is needed.

### useLoader

```typescript
const result = useLoader(LoaderClass, url, extensions?, onProgress?)
const results = useLoader(LoaderClass, [url1, url2], extensions?)
```

Suspense-based asset loading. ALWAYS wrap in `<Suspense fallback={...}>`.

- Assets are cached by URL -- loading the same URL twice returns the cached result.
- `useLoader.preload(LoaderClass, url)` preloads before component mount.
- GLTF results include `{ nodes, materials, scene, animations }`.

### useGraph

```typescript
const { nodes, materials } = useGraph(object3D)
```

Traverses an Object3D hierarchy and returns memoized `{ nodes, materials }` collections keyed by name.

---

## Primitives and extend()

### Primitives

Insert pre-existing Three.js objects into the declarative tree:

```jsx
<primitive object={existingMesh} position={[10, 0, 0]} />
```

- NEVER add the same object instance multiple times -- Three.js objects can have only one parent.
- Primitives do NOT auto-dispose; the caller MUST manage lifecycle.

### extend()

Register custom Three.js classes as JSX elements:

```jsx
import { extend } from '@react-three/fiber'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls'

extend({ OrbitControls })
// Now usable as <orbitControls args={[camera, domElement]} />
```

The JSX element name is the camelCase version of the registered key.

---

## Event System

R3F implements pointer events via raycasting. Events bubble through the scene graph.

### Supported Events

| Event | Trigger |
|-------|---------|
| `onClick` | Pointer click on mesh |
| `onContextMenu` | Right-click / context menu |
| `onDoubleClick` | Double click |
| `onPointerUp` | Pointer released |
| `onPointerDown` | Pointer pressed |
| `onPointerOver` | Pointer enters mesh (fires continuously) |
| `onPointerOut` | Pointer leaves mesh |
| `onPointerEnter` | Pointer enters mesh (fires once) |
| `onPointerLeave` | Pointer leaves mesh (fires once) |
| `onPointerMove` | Pointer moves over mesh |
| `onPointerMissed` | Click hits no mesh (Canvas-level) |
| `onWheel` | Scroll wheel |
| `onUpdate` | Object receives new props |

### Event Object Properties

| Property | Type | Description |
|----------|------|-------------|
| `object` | `THREE.Object3D` | The mesh actually hit |
| `eventObject` | `THREE.Object3D` | Object with the event handler |
| `point` | `THREE.Vector3` | Intersection in world space |
| `distance` | `number` | Camera-to-intersection distance |
| `uv` | `THREE.Vector2` | UV coordinates at intersection |
| `face` | `THREE.Face` | Intersected face |
| `ray` | `THREE.Ray` | Ray used for intersection |
| `camera` | `THREE.Camera` | Active camera |
| `intersections` | `Intersection[]` | All intersected objects |
| `delta` | `number` | Pixel distance down-to-up |
| `sourceEvent` | `Event` | Original DOM event |
| `stopPropagation()` | `function` | Prevent bubbling to occluded objects |

---

## Performance Patterns

### Disposal

- R3F ALWAYS calls `dispose()` on Three.js objects when components unmount, freeing GPU resources.
- Set `dispose={null}` on an element to PREVENT auto-disposal -- use when objects are shared across components.

### Static Scenes

Use `frameloop="demand"` with `invalidate()` for scenes that do not animate continuously (dashboards, configurators). This saves GPU cycles.

### Portals

```jsx
import { createPortal } from '@react-three/fiber'

createPortal(children, targetScene)
```

Renders children into a different scene/layer without affecting the main scene graph.

### useMemo for Imperative Objects

ALWAYS wrap imperatively created geometries and materials in `useMemo`:

```jsx
const geometry = useMemo(() => new THREE.TorusKnotGeometry(1, 0.3, 128, 32), [])
```

Without `useMemo`, a new object is created on every render.

---

## Reference Links

- [references/methods.md](references/methods.md) -- Hook signatures and Canvas API
- [references/examples.md](references/examples.md) -- Working R3F code examples
- [references/anti-patterns.md](references/anti-patterns.md) -- What NOT to do with R3F

### Official Sources

- https://r3f.docs.pmnd.rs/
- https://r3f.docs.pmnd.rs/api/canvas
- https://r3f.docs.pmnd.rs/api/hooks
- https://r3f.docs.pmnd.rs/api/events
