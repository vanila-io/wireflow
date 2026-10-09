import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'

export default function Sphere({ position = [0, 0, 0], ...props }) {
  const meshRef = useRef()

  // Floating animation
  useFrame((state) => {
    const time = state.clock.elapsedTime
    meshRef.current.position.y = position[1] + Math.sin(time * 2) * 0.5
    meshRef.current.rotation.y = time * 0.5
  })

  return (
    <mesh {...props} ref={meshRef} position={position} castShadow>
      <sphereGeometry args={[0.75, 32, 32]} />
      <meshStandardMaterial
        color="skyblue"
        metalness={0.6}
        roughness={0.2}
      />
    </mesh>
  )
}
