import { Canvas } from '@react-three/fiber'
import { OrbitControls, Environment, ContactShadows } from '@react-three/drei'
import { Suspense } from 'react'
import Box from './components/Box'
import Sphere from './components/Sphere'

function Scene() {
  return (
    <>
      {/* Lighting */}
      <ambientLight intensity={0.5} />
      <directionalLight
        position={[5, 5, 5]}
        intensity={1}
        castShadow
        shadow-mapSize={[1024, 1024]}
      />

      {/* 3D Objects */}
      <Box position={[-2, 1, 0]} />
      <Sphere position={[2, 1, 0]} />

      {/* Ground */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[10, 10]} />
        <meshStandardMaterial color="#808080" />
      </mesh>

      {/* Environment */}
      <Environment preset="sunset" />
      <ContactShadows
        position={[0, 0, 0]}
        opacity={0.5}
        scale={10}
        blur={1}
        far={10}
      />

      {/* Camera Controls */}
      <OrbitControls makeDefault />
    </>
  )
}

export default function Experience() {
  return (
    <Canvas
      shadows
      camera={{ position: [5, 5, 5], fov: 50 }}
      style={{ width: '100%', height: '100%' }}
    >
      <Suspense fallback={null}>
        <Scene />
      </Suspense>
    </Canvas>
  )
}
