# methods.md -- React Three Fiber API Reference

> Complete hook signatures and Canvas API for @react-three/fiber 8.x+.

---

## Canvas Component

```tsx
import { Canvas } from '@react-three/fiber'

<Canvas
  gl={rendererProps | factoryFn}        // WebGL renderer config
  camera={cameraProps | THREE.Camera}   // Default camera
  scene={sceneProps | THREE.Scene}      // Scene config
  shadows={boolean | ShadowMapType}     // Shadow maps
  raycaster={raycasterProps}            // Raycaster config
  frameloop={"always" | "demand" | "never"}  // Render loop
  resize={ResizeOptions}                // Resize behavior
  orthographic={boolean}                // Orthographic camera
  dpr={number | [min, max]}            // Device pixel ratio
  linear={boolean}                      // Linear color space
  flat={boolean}                        // Disable tone mapping
  legacy={boolean}                      // Disable color management
  events={EventManager}                 // Custom event manager
  eventSource={HTMLElement | RefObject} // Event capture element
  eventPrefix={string}                  // Coordinate prefix
  fallback={ReactNode}                  // DOM fallback
  onCreated={(state: RootState) => void}       // Post-init callback
  onPointerMissed={(event: PointerEvent) => void}  // Miss callback
>
  {children}
</Canvas>
```

---

## Hooks

### useFrame

```typescript
useFrame(
  callback: (state: RootState, delta: number, xrFrame?: XRFrame) => void,
  priority?: number
): void
```

- `state` -- Full R3F root state (gl, scene, camera, clock, pointer, size, viewport, etc.)
- `delta` -- Time in seconds since last frame. ALWAYS use for frame-rate-independent animation.
- `xrFrame` -- XR frame object when in WebXR session, undefined otherwise.
- `priority` -- Execution order (ascending). When any priority > 0, auto-render is disabled.

### useThree

```typescript
// Full state (triggers re-renders on any state change)
useThree(): RootState

// Selector pattern (triggers re-renders ONLY when selected value changes)
useThree<T>(selector: (state: RootState) => T): T
```

**RootState properties:**

| Property | Type |
|----------|------|
| `gl` | `THREE.WebGLRenderer` |
| `scene` | `THREE.Scene` |
| `camera` | `THREE.Camera` |
| `raycaster` | `THREE.Raycaster` |
| `pointer` | `THREE.Vector2` |
| `clock` | `THREE.Clock` |
| `size` | `{ width: number, height: number, top: number, left: number }` |
| `viewport` | `{ width: number, height: number, initialDpr: number, dpr: number, factor: number, distance: number, aspect: number, getCurrentViewport: () => Viewport }` |
| `linear` | `boolean` |
| `flat` | `boolean` |
| `legacy` | `boolean` |
| `frameloop` | `"always" \| "demand" \| "never"` |
| `performance` | `{ current: number, min: number, max: number, debounce: number, regress: () => void }` |
| `set` | `(state: Partial<RootState>) => void` |
| `get` | `() => RootState` |
| `invalidate` | `() => void` |
| `advance` | `(timestamp: number) => void` |
| `setSize` | `(width: number, height: number) => void` |
| `setDpr` | `(dpr: number \| [min, max]) => void` |
| `setFrameloop` | `(mode: string) => void` |
| `setEvents` | `(events: Partial<EventManager>) => void` |
| `events` | `{ connected: boolean, handlers: object, connect: () => void, disconnect: () => void }` |

### useLoader

```typescript
// Single URL
useLoader<T>(
  loader: new () => Loader<T>,
  url: string,
  extensions?: (loader: Loader<T>) => void,
  onProgress?: (event: ProgressEvent) => void
): T

// Multiple URLs
useLoader<T>(
  loader: new () => Loader<T>,
  urls: string[],
  extensions?: (loader: Loader<T>) => void,
  onProgress?: (event: ProgressEvent) => void
): T[]

// Preload (call at module scope or outside components)
useLoader.preload<T>(
  loader: new () => Loader<T>,
  url: string | string[],
  extensions?: (loader: Loader<T>) => void
): void

// Clear cache
useLoader.clear<T>(
  loader: new () => Loader<T>,
  url: string | string[]
): void
```

### useGraph

```typescript
useGraph(
  object: THREE.Object3D
): {
  nodes: Record<string, THREE.Object3D>,
  materials: Record<string, THREE.Material>
}
```

Returns memoized collections keyed by `object.name`.

---

## Utility Functions

### extend

```typescript
import { extend } from '@react-three/fiber'

extend(objects: Record<string, new (...args: any[]) => any>): void
```

Registers custom Three.js classes as lowercase JSX elements.

### createPortal

```typescript
import { createPortal } from '@react-three/fiber'

createPortal(
  children: React.ReactNode,
  container: THREE.Object3D,
  state?: Partial<RootState>
): React.ReactNode
```

Renders children into a different scene/container.

---

## JSX Element Props (Universal)

Every R3F JSX element accepts these props:

| Prop | Type | Purpose |
|------|------|---------|
| `args` | `any[]` | Constructor arguments |
| `attach` | `string \| AttachFn` | Bind to parent property |
| `dispose` | `null` | Prevent auto-disposal on unmount |
| `ref` | `React.Ref` | Access underlying Three.js object |
| `key` | `string \| number` | React reconciliation key |
| `onClick` | `EventHandler` | Click event |
| `onPointerOver` | `EventHandler` | Pointer enter (continuous) |
| `onPointerOut` | `EventHandler` | Pointer leave |
| `onPointerDown` | `EventHandler` | Pointer press |
| `onPointerUp` | `EventHandler` | Pointer release |
| `onPointerMove` | `EventHandler` | Pointer move |
| `onPointerEnter` | `EventHandler` | Pointer enter (once) |
| `onPointerLeave` | `EventHandler` | Pointer leave (once) |
| `onDoubleClick` | `EventHandler` | Double click |
| `onContextMenu` | `EventHandler` | Right-click |
| `onWheel` | `EventHandler` | Scroll wheel |
| `onUpdate` | `(self: Object3D) => void` | Called after prop updates |

### Event Handler Signature

```typescript
type EventHandler = (event: ThreeEvent) => void

interface ThreeEvent {
  object: THREE.Object3D        // Mesh actually hit
  eventObject: THREE.Object3D   // Object with handler attached
  point: THREE.Vector3           // World-space intersection
  distance: number               // Camera-to-hit distance
  uv: THREE.Vector2             // UV at intersection
  face: THREE.Face              // Intersected face
  faceIndex: number             // Face index
  ray: THREE.Ray                // Intersection ray
  camera: THREE.Camera          // Active camera
  intersections: Intersection[] // All hits
  delta: number                 // Pixel distance (down to up)
  sourceEvent: Event            // Original DOM event
  unprojectedPoint: THREE.Vector3
  stopPropagation(): void       // Stop bubbling
}
```

---

## Official Sources

- https://r3f.docs.pmnd.rs/api/canvas
- https://r3f.docs.pmnd.rs/api/hooks
- https://r3f.docs.pmnd.rs/api/events
- https://r3f.docs.pmnd.rs/api/objects
