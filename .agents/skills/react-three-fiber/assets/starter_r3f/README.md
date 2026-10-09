# React Three Fiber Starter Template

A minimal, production-ready starter template for building 3D experiences with React Three Fiber (R3F), Drei helpers, and Vite.

## Features

- ⚡️ **Vite** - Fast build tool and dev server
- ⚛️ **React 18** - Latest React with concurrent features
- 🎨 **React Three Fiber** - Declarative Three.js in React
- 🛠️ **Drei** - Essential R3F helpers (OrbitControls, Environment, etc.)
- 🎮 **Interactive Components** - Click and hover interactions
- 🌅 **Environment & Lighting** - HDRI environment with proper lighting
- 💫 **Animations** - useFrame examples for smooth 60fps animations
- 📦 **Optimized Build** - Code-splitting for Three.js and R3F
- 🎛️ **Leva** - Optional GUI controls for debugging

## Quick Start

### Installation

```bash
npm install
# or
yarn
# or
pnpm install
```

### Development

```bash
npm run dev
```

Opens at `http://localhost:3000`

### Build

```bash
npm run build
```

### Preview Production Build

```bash
npm run preview
```

## Project Structure

```
starter_r3f/
├── index.html           # Entry HTML with full-page canvas styling
├── package.json         # Dependencies and scripts
├── vite.config.js       # Vite configuration with code-splitting
└── src/
    ├── main.jsx         # React root
    ├── App.jsx          # Main App component with UI overlay
    ├── Experience.jsx   # Canvas wrapper and Scene component
    └── components/
        ├── Box.jsx      # Interactive box with click/hover
        └── Sphere.jsx   # Floating animated sphere
```

## What's Included

### Components

**Box.jsx** - Interactive component with:
- Click to toggle rotation animation
- Hover for color change
- Scale animation on click
- Cast shadows

**Sphere.jsx** - Animated component with:
- Floating sine wave animation
- Continuous rotation
- Metallic material
- Cast shadows

### Scene Setup (Experience.jsx)

- **Lighting**: Ambient + Directional with shadows
- **Environment**: Drei Environment preset (HDRI)
- **Shadows**: Contact shadows for soft ground shadows
- **Controls**: OrbitControls for camera manipulation
- **Ground Plane**: Receives shadows

### Performance Features

- **Code-splitting**: Separate chunks for Three.js and R3F
- **Suspense**: Async loading with fallback
- **Optimized imports**: Tree-shaking friendly imports

## Customization

### Change Environment Preset

```jsx
// Experience.jsx
<Environment preset="sunset" /> // Try: city, forest, night, warehouse, etc.
```

### Add New Components

```jsx
// src/components/MyComponent.jsx
import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'

export default function MyComponent() {
  const meshRef = useRef()

  useFrame((state, delta) => {
    meshRef.current.rotation.y += delta
  })

  return (
    <mesh ref={meshRef}>
      <boxGeometry />
      <meshStandardMaterial color="orange" />
    </mesh>
  )
}
```

Then import in Experience.jsx:
```jsx
import MyComponent from './components/MyComponent'

// In Scene component:
<MyComponent />
```

### Add Leva Controls

```jsx
import { useControls } from 'leva'

export default function Box() {
  const { color, scale } = useControls({
    color: '#ff6b6b',
    scale: { value: 1, min: 0.5, max: 2, step: 0.1 }
  })

  return (
    <mesh scale={scale}>
      <boxGeometry />
      <meshStandardMaterial color={color} />
    </mesh>
  )
}
```

## Common Patterns

### Load GLTF Models

```jsx
import { useGLTF } from '@react-three/drei'

function Model() {
  const { scene } = useGLTF('/models/mymodel.glb')
  return <primitive object={scene} />
}

// Preload
useGLTF.preload('/models/mymodel.glb')
```

### Add Post-Processing

```bash
npm install @react-three/postprocessing
```

```jsx
import { EffectComposer, Bloom } from '@react-three/postprocessing'

<Canvas>
  <Scene />
  <EffectComposer>
    <Bloom intensity={0.5} />
  </EffectComposer>
</Canvas>
```

### Optimize Performance

```jsx
// Enable adaptive pixel ratio
<Canvas dpr={[1, 2]} />

// Use on-demand rendering for static scenes
<Canvas frameloop="demand" />

// Use instancing for many objects
import { Instance, Instances } from '@react-three/drei'

<Instances>
  <boxGeometry />
  <meshStandardMaterial />
  <Instance position={[0, 0, 0]} />
  <Instance position={[2, 0, 0]} />
  {/* ... thousands more */}
</Instances>
```

## Resources

- [React Three Fiber Docs](https://docs.pmnd.rs/react-three-fiber)
- [Drei Helpers](https://github.com/pmndrs/drei)
- [Three.js Docs](https://threejs.org/docs/)
- [Vite Docs](https://vitejs.dev/)
- [React Docs](https://react.dev/)

## Troubleshooting

### Canvas Not Rendering

- Ensure `#root` has width and height set (see index.html styles)
- Check browser console for errors
- Verify Three.js and R3F versions are compatible

### Performance Issues

- Reduce shadow quality: `shadow-mapSize={[512, 512]}`
- Disable shadows: Remove `castShadow` and `receiveShadow`
- Use adaptive DPR: `<Canvas dpr={[1, 2]} />`
- Enable frameloop demand: `<Canvas frameloop="demand" />`

### TypeScript Support

```bash
npm install -D typescript @types/react @types/react-dom @types/three
```

Rename files to `.tsx` and add `tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true
  },
  "include": ["src"]
}
```

## License

MIT - Use freely for personal and commercial projects.
