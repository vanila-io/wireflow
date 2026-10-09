import { useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'

export default function Box({ position = [0, 0, 0], ...props }) {
  const meshRef = useRef()
  const [hovered, setHovered] = useState(false)
  const [active, setActive] = useState(false)

  // Animate on every frame
  useFrame((state, delta) => {
    if (active) {
      meshRef.current.rotation.x += delta
      meshRef.current.rotation.y += delta * 0.5
    }
  })

  return (
    <mesh
      {...props}
      ref={meshRef}
      position={position}
      scale={active ? 1.5 : 1}
      onClick={(e) => {
        e.stopPropagation()
        setActive(!active)
      }}
      onPointerOver={(e) => {
        e.stopPropagation()
        setHovered(true)
      }}
      onPointerOut={() => setHovered(false)}
      castShadow
    >
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial color={hovered ? 'hotpink' : 'orange'} />
    </mesh>
  )
}
