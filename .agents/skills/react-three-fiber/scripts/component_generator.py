#!/usr/bin/env python3
"""
React Three Fiber Component Generator
======================================

Generates R3F component boilerplate for common patterns with TypeScript support.

Usage:
    python3 component_generator.py --type box --name MyBox --output MyBox.jsx
    python3 component_generator.py --type model --name Scene --props "modelPath,scale" --typescript
    python3 component_generator.py --type interactive --name Button --events "onClick,onPointerOver"
    python3 component_generator.py --type animated --name FloatingCube --animation "rotation,position"

Component Types:
    - box: Basic mesh with geometry and material
    - sphere: Sphere mesh component
    - model: GLTF model loader with Suspense
    - interactive: Interactive mesh with pointer events
    - animated: Animated component with useFrame
    - group: Group container with multiple children
    - instanced: Instanced mesh for performance
    - camera-rig: Camera control component
    - lighting: Lighting setup component
    - environment: Environment with Drei helpers
    - scene: Complete scene setup
    - custom: Custom component template

Options:
    --type: Component type (required)
    --name: Component name (default: Component)
    --output: Output file path (default: stdout)
    --typescript: Generate TypeScript component
    --props: Comma-separated list of props
    --events: Comma-separated list of event handlers
    --animation: Comma-separated list of animation targets (rotation, position, scale)
    --drei: Include Drei helper imports
    --framework: Target framework (vanilla, nextjs, vite)
"""

import argparse
import sys
from typing import List, Dict, Optional


class R3FComponentGenerator:
    """Generate React Three Fiber component boilerplate."""

    def __init__(
        self,
        component_type: str,
        name: str = "Component",
        typescript: bool = False,
        props: Optional[List[str]] = None,
        events: Optional[List[str]] = None,
        animation: Optional[List[str]] = None,
        drei: bool = False,
        framework: str = "vanilla"
    ):
        self.component_type = component_type
        self.name = name
        self.typescript = typescript
        self.props = props or []
        self.events = events or []
        self.animation = animation or []
        self.drei = drei
        self.framework = framework

    def generate(self) -> str:
        """Generate component code."""
        generators = {
            'box': self._generate_box,
            'sphere': self._generate_sphere,
            'model': self._generate_model,
            'interactive': self._generate_interactive,
            'animated': self._generate_animated,
            'group': self._generate_group,
            'instanced': self._generate_instanced,
            'camera-rig': self._generate_camera_rig,
            'lighting': self._generate_lighting,
            'environment': self._generate_environment,
            'scene': self._generate_scene,
            'custom': self._generate_custom,
        }

        generator = generators.get(self.component_type)
        if not generator:
            raise ValueError(f"Unknown component type: {self.component_type}")

        return generator()

    def _get_imports(self, additional: List[str] = None) -> str:
        """Generate import statements."""
        imports = ["import { useRef } from 'react'"]

        r3f_imports = ["useFrame", "useThree"]
        if additional:
            r3f_imports.extend(additional)
        imports.append(f"import {{ {', '.join(set(r3f_imports))} }} from '@react-three/fiber'")

        if self.drei:
            drei_imports = ["OrbitControls", "Environment", "useGLTF"]
            imports.append(f"import {{ {', '.join(drei_imports)} }} from '@react-three/drei'")

        if self.typescript:
            imports.append("import * as THREE from 'three'")

        return "\n".join(imports)

    def _get_props_interface(self) -> str:
        """Generate TypeScript props interface."""
        if not self.typescript or not self.props:
            return ""

        props_lines = []
        for prop in self.props:
            # Infer types from common prop names
            if prop in ['position', 'rotation', 'scale']:
                props_lines.append(f"  {prop}?: [number, number, number]")
            elif prop in ['color', 'modelPath', 'name']:
                props_lines.append(f"  {prop}?: string")
            elif prop in ['visible', 'castShadow', 'receiveShadow']:
                props_lines.append(f"  {prop}?: boolean")
            elif prop.endswith('Ref'):
                props_lines.append(f"  {prop}?: React.RefObject<THREE.Mesh>")
            else:
                props_lines.append(f"  {prop}?: any")

        return f"\ninterface {self.name}Props {{\n" + "\n".join(props_lines) + "\n}\n"

    def _get_props_signature(self) -> str:
        """Generate props parameter signature."""
        if not self.props:
            return "()"

        if self.typescript:
            return f"({{ {', '.join(self.props)} }}: {self.name}Props)"
        else:
            return f"({{ {', '.join(self.props)} }})"

    def _get_event_handlers(self) -> str:
        """Generate event handler props."""
        if not self.events:
            return ""

        handlers = []
        for event in self.events:
            if event.startswith('on'):
                handler_name = event[2:].lower()
                handlers.append(f'{event}={(e) => console.log("{handler_name}", e)}')
            else:
                handlers.append(f'on{event.capitalize()}={(e) => console.log("{event}", e)}')

        return "\n      ".join(handlers)

    def _generate_box(self) -> str:
        """Generate basic box component."""
        imports = self._get_imports()
        props_interface = self._get_props_interface()
        props_sig = self._get_props_signature()

        default_props = ["position = [0, 0, 0]", "color = 'orange'"]
        props_str = ', '.join(default_props + self.props)

        return f"""{imports}
{props_interface}
export function {self.name}{props_sig} {{
  return (
    <mesh position={{position}}>
      <boxGeometry args={{[1, 1, 1]}} />
      <meshStandardMaterial color={{color}} />
    </mesh>
  )
}}
"""

    def _generate_sphere(self) -> str:
        """Generate sphere component."""
        imports = self._get_imports()
        props_interface = self._get_props_interface()
        props_sig = self._get_props_signature()

        return f"""{imports}
{props_interface}
export function {self.name}{props_sig} {{
  const meshRef = useRef{f'<THREE.Mesh>(null)' if self.typescript else '()'}

  return (
    <mesh ref={{meshRef}}>
      <sphereGeometry args={{[1, 32, 32]}} />
      <meshStandardMaterial color="hotpink" />
    </mesh>
  )
}}
"""

    def _generate_model(self) -> str:
        """Generate GLTF model loader component."""
        imports = ["import { Suspense } from 'react'"]
        imports.append("import { useGLTF } from '@react-three/drei'")
        if self.typescript:
            imports.append("import { GLTF } from 'three-stdlib'")

        props_interface = ""
        if self.typescript:
            props_interface = f"""
interface {self.name}Props {{
  modelPath: string
  position?: [number, number, number]
  scale?: number | [number, number, number]
}}
"""

        return f"""{chr(10).join(imports)}
{props_interface}
function Model({{ modelPath, position = [0, 0, 0], scale = 1 }}{f': {self.name}Props' if self.typescript else ''}) {{
  const {{ scene }} = useGLTF(modelPath)

  return <primitive object={{scene}} position={{position}} scale={{scale}} />
}}

// Preload the model
useGLTF.preload('/path/to/model.glb')

export function {self.name}({{ modelPath = '/model.glb', ...props }}{f': {self.name}Props' if self.typescript else ''}) {{
  return (
    <Suspense fallback={{null}}>
      <Model modelPath={{modelPath}} {{...props}} />
    </Suspense>
  )
}}
"""

    def _generate_interactive(self) -> str:
        """Generate interactive component with pointer events."""
        imports = self._get_imports() + "\nimport { useState } from 'react'"
        props_interface = self._get_props_interface()
        props_sig = self._get_props_signature()

        event_handlers = self._get_event_handlers() or """onClick={(e) => {
        e.stopPropagation()
        setActive(!active)
      }}
      onPointerOver={(e) => {
        e.stopPropagation()
        setHovered(true)
      }}
      onPointerOut={(e) => setHovered(false)}"""

        return f"""{imports}
{props_interface}
export function {self.name}{props_sig} {{
  const [hovered, setHovered] = useState(false)
  const [active, setActive] = useState(false)

  return (
    <mesh
      scale={{active ? 1.5 : 1}}
      {event_handlers}>
      <boxGeometry args={{[1, 1, 1]}} />
      <meshStandardMaterial color={{hovered ? 'hotpink' : 'orange'}} />
    </mesh>
  )
}}
"""

    def _generate_animated(self) -> str:
        """Generate animated component with useFrame."""
        imports = self._get_imports()
        props_interface = self._get_props_interface()
        props_sig = self._get_props_signature()

        # Generate animation code based on targets
        animation_code = []
        if 'rotation' in self.animation or not self.animation:
            animation_code.append("meshRef.current.rotation.x += delta")
            animation_code.append("meshRef.current.rotation.y += delta * 0.5")
        if 'position' in self.animation:
            animation_code.append("meshRef.current.position.y = Math.sin(state.clock.elapsedTime) * 2")
        if 'scale' in self.animation:
            animation_code.append("meshRef.current.scale.x = 1 + Math.sin(state.clock.elapsedTime) * 0.3")

        if not animation_code:
            animation_code = ["// Add your animation logic here"]

        return f"""{imports}
{props_interface}
export function {self.name}{props_sig} {{
  const meshRef = useRef{f'<THREE.Mesh>(null!)' if self.typescript else '()'}

  useFrame((state, delta) => {{
    {chr(10).join(f'    {line}' for line in animation_code)}
  }})

  return (
    <mesh ref={{meshRef}}>
      <boxGeometry args={{[1, 1, 1]}} />
      <meshStandardMaterial color="orange" />
    </mesh>
  )
}}
"""

    def _generate_group(self) -> str:
        """Generate group component."""
        imports = self._get_imports()
        props_interface = self._get_props_interface()
        props_sig = self._get_props_signature()

        return f"""{imports}
{props_interface}
export function {self.name}{props_sig} {{
  const groupRef = useRef{f'<THREE.Group>(null!)' if self.typescript else '()'}

  useFrame((state, delta) => {{
    groupRef.current.rotation.y += delta * 0.5
  }})

  return (
    <group ref={{groupRef}}>
      <mesh position={{[-2, 0, 0]}}>
        <boxGeometry />
        <meshStandardMaterial color="orange" />
      </mesh>
      <mesh position={{[2, 0, 0]}}>
        <sphereGeometry />
        <meshStandardMaterial color="hotpink" />
      </mesh>
    </group>
  )
}}
"""

    def _generate_instanced(self) -> str:
        """Generate instanced mesh component for performance."""
        imports = ["import { useRef, useMemo } from 'react'"]
        imports.append("import { useFrame } from '@react-three/fiber'")
        if self.typescript:
            imports.append("import * as THREE from 'three'")

        return f"""{chr(10).join(imports)}

export function {self.name}({{ count = 1000 }}) {{
  const meshRef = useRef{f'<THREE.InstancedMesh>(null!)' if self.typescript else '()'}

  const particles = useMemo(() => {{
    const temp = []
    for (let i = 0; i < count; i++) {{
      const t = Math.random() * 100
      const factor = 20 + Math.random() * 100
      const speed = 0.01 + Math.random() / 200
      const x = Math.random() * 40 - 20
      const y = Math.random() * 40 - 20
      const z = Math.random() * 40 - 20
      temp.push({{ t, factor, speed, x, y, z, mx: 0, my: 0 }})
    }}
    return temp
  }}, [count])

  const dummy = useMemo(() => new THREE.Object3D(), [])

  useFrame(() => {{
    particles.forEach((particle, i) => {{
      let {{ t, factor, speed, x, y, z }} = particle
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
    }})
    meshRef.current.instanceMatrix.needsUpdate = true
  }})

  return (
    <instancedMesh ref={{meshRef}} args={{[undefined, undefined, count]}}>
      <dodecahedronGeometry args={{[0.2, 0]}} />
      <meshPhongMaterial color="#ff4040" />
    </instancedMesh>
  )
}}
"""

    def _generate_camera_rig(self) -> str:
        """Generate camera rig component."""
        imports = ["import { useRef } from 'react'"]
        imports.append("import { useFrame } from '@react-three/fiber'")
        if self.typescript:
            imports.append("import * as THREE from 'three'")

        return f"""{chr(10).join(imports)}

export function {self.name}({{ children }}) {{
  const groupRef = useRef{f'<THREE.Group>(null!)' if self.typescript else '()'}

  useFrame((state) => {{
    // Smooth camera follow
    groupRef.current.position.lerp(
      new THREE.Vector3(
        state.mouse.x * 2,
        state.mouse.y * 2,
        10
      ),
      0.05
    )

    // Look at center
    groupRef.current.lookAt(0, 0, 0)
  }})

  return (
    <group ref={{groupRef}}>
      {{children}}
    </group>
  )
}}
"""

    def _generate_lighting(self) -> str:
        """Generate lighting setup component."""
        return f"""import {{ useRef }} from 'react'
import {{ useFrame }} from '@react-three/fiber'

export function {self.name}() {{
  const lightRef = useRef()

  useFrame((state) => {{
    const time = state.clock.elapsedTime
    lightRef.current.position.x = Math.sin(time) * 5
    lightRef.current.position.z = Math.cos(time) * 5
  }})

  return (
    <>
      <ambientLight intensity={{0.5}} />
      <directionalLight
        ref={{lightRef}}
        position={{[5, 5, 5]}}
        intensity={{1}}
        castShadow
        shadow-mapSize={{[1024, 1024]}}
        shadow-camera-far={{50}}
        shadow-camera-left={{-10}}
        shadow-camera-right={{10}}
        shadow-camera-top={{10}}
        shadow-camera-bottom={{-10}}
      />
      <pointLight position={{[-10, -10, -10]}} intensity={{0.5}} />
      <hemisphereLight intensity={{0.35}} groundColor="black" />
    </>
  )
}}
"""

    def _generate_environment(self) -> str:
        """Generate environment component with Drei helpers."""
        return f"""import {{ Environment, ContactShadows, Sky }} from '@react-three/drei'

export function {self.name}() {{
  return (
    <>
      <Environment preset="sunset" />
      <ContactShadows
        position={{[0, -1.4, 0]}}
        opacity={{0.75}}
        scale={{10}}
        blur={{2.5}}
        far={{4}}
      />
      <Sky sunPosition={{[100, 20, 100]}} />
    </>
  )
}}
"""

    def _generate_scene(self) -> str:
        """Generate complete scene setup."""
        return f"""import {{ Canvas }} from '@react-three/fiber'
import {{ OrbitControls, Environment, ContactShadows }} from '@react-three/drei'

function Scene() {{
  return (
    <>
      {/* Lighting */}
      <ambientLight intensity={{0.5}} />
      <directionalLight position={{[5, 5, 5]}} intensity={{1}} castShadow />

      {/* 3D Objects */}
      <mesh position={{[0, 1, 0]}} castShadow>
        <boxGeometry args={{[1, 1, 1]}} />
        <meshStandardMaterial color="orange" />
      </mesh>

      {/* Ground */}
      <mesh rotation={{[-Math.PI / 2, 0, 0]}} position={{[0, 0, 0]}} receiveShadow>
        <planeGeometry args={{[10, 10]}} />
        <meshStandardMaterial color="#808080" />
      </mesh>

      {/* Environment */}
      <Environment preset="city" />
      <ContactShadows position={{[0, 0, 0]}} opacity={{0.5}} scale={{10}} blur={{1}} far={{10}} />

      {/* Camera Controls */}
      <OrbitControls makeDefault />
    </>
  )
}}

export function {self.name}() {{
  return (
    <Canvas shadows camera={{{{ position: [5, 5, 5], fov: 50 }}}}>
      <Scene />
    </Canvas>
  )
}}
"""

    def _generate_custom(self) -> str:
        """Generate custom component template."""
        imports = self._get_imports()
        props_interface = self._get_props_interface()
        props_sig = self._get_props_signature()

        return f"""{imports}
{props_interface}
export function {self.name}{props_sig} {{
  const meshRef = useRef{f'<THREE.Mesh>(null!)' if self.typescript else '()'}

  // Add your custom logic here
  useFrame((state, delta) => {{
    // Animation logic
  }})

  return (
    <mesh ref={{meshRef}}>
      <boxGeometry args={{[1, 1, 1]}} />
      <meshStandardMaterial color="orange" />
    </mesh>
  )
}}
"""


def main():
    parser = argparse.ArgumentParser(
        description='Generate React Three Fiber component boilerplate',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__
    )

    parser.add_argument(
        '--type',
        required=True,
        choices=['box', 'sphere', 'model', 'interactive', 'animated', 'group',
                 'instanced', 'camera-rig', 'lighting', 'environment', 'scene', 'custom'],
        help='Component type to generate'
    )

    parser.add_argument(
        '--name',
        default='Component',
        help='Component name (default: Component)'
    )

    parser.add_argument(
        '--output',
        help='Output file path (default: stdout)'
    )

    parser.add_argument(
        '--typescript',
        action='store_true',
        help='Generate TypeScript component'
    )

    parser.add_argument(
        '--props',
        help='Comma-separated list of props'
    )

    parser.add_argument(
        '--events',
        help='Comma-separated list of event handlers (e.g., onClick,onPointerOver)'
    )

    parser.add_argument(
        '--animation',
        help='Comma-separated list of animation targets (rotation,position,scale)'
    )

    parser.add_argument(
        '--drei',
        action='store_true',
        help='Include Drei helper imports'
    )

    parser.add_argument(
        '--framework',
        default='vanilla',
        choices=['vanilla', 'nextjs', 'vite'],
        help='Target framework (default: vanilla)'
    )

    args = parser.parse_args()

    # Parse comma-separated lists
    props = args.props.split(',') if args.props else []
    events = args.events.split(',') if args.events else []
    animation = args.animation.split(',') if args.animation else []

    # Generate component
    generator = R3FComponentGenerator(
        component_type=args.type,
        name=args.name,
        typescript=args.typescript,
        props=props,
        events=events,
        animation=animation,
        drei=args.drei,
        framework=args.framework
    )

    try:
        code = generator.generate()

        # Output
        if args.output:
            with open(args.output, 'w') as f:
                f.write(code)
            print(f"✅ Generated {args.name} component → {args.output}")
        else:
            print(code)

    except Exception as e:
        print(f"❌ Error: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == '__main__':
    main()
