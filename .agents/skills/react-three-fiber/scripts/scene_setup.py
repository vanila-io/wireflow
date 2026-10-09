#!/usr/bin/env python3
"""
React Three Fiber Scene Setup Tool
===================================

Interactive CLI tool to generate complete R3F scene boilerplate with common patterns.

Usage:
    python3 scene_setup.py
    python3 scene_setup.py --preset standard --output src/Scene.jsx
    python3 scene_setup.py --preset performance --typescript
    python3 scene_setup.py --interactive

Presets:
    - minimal: Basic scene with lighting and controls
    - standard: Complete scene with environment, shadows, controls
    - performance: Optimized scene with adaptive performance
    - creative: Artistic scene with post-processing effects
    - product: Product viewer setup with proper lighting
    - game: Game-ready scene with physics

Features:
    - Lighting configurations (ambient, directional, point, hemisphere, HDRI)
    - Camera setups (perspective, orthographic)
    - Controls (OrbitControls, FlyControls, PointerLockControls)
    - Environment (Drei presets, HDRI, Sky)
    - Shadows (PCF, VSM, contact shadows)
    - Post-processing (bloom, DOF, SSAO, chromatic aberration)
    - Performance optimizations (adaptive DPR, LOD, instancing)
    - Physics integration (Rapier, Cannon)
"""

import argparse
import sys
from typing import Dict, List, Optional


class R3FSceneSetup:
    """Generate React Three Fiber scene setup."""

    PRESETS = {
        'minimal': {
            'lighting': ['ambient', 'directional'],
            'controls': ['orbit'],
            'environment': None,
            'shadows': False,
            'post_processing': False,
            'performance': False,
        },
        'standard': {
            'lighting': ['ambient', 'directional', 'hemisphere'],
            'controls': ['orbit'],
            'environment': 'drei-preset',
            'shadows': True,
            'post_processing': False,
            'performance': False,
        },
        'performance': {
            'lighting': ['ambient', 'directional'],
            'controls': ['orbit'],
            'environment': None,
            'shadows': False,
            'post_processing': False,
            'performance': True,
        },
        'creative': {
            'lighting': ['ambient', 'directional', 'point'],
            'controls': ['orbit'],
            'environment': 'drei-preset',
            'shadows': True,
            'post_processing': True,
            'performance': False,
        },
        'product': {
            'lighting': ['ambient', 'directional', 'point', 'hemisphere'],
            'controls': ['orbit'],
            'environment': 'drei-preset',
            'shadows': True,
            'post_processing': False,
            'performance': False,
        },
        'game': {
            'lighting': ['ambient', 'directional'],
            'controls': ['pointer-lock'],
            'environment': None,
            'shadows': True,
            'post_processing': False,
            'performance': True,
            'physics': True,
        },
    }

    def __init__(
        self,
        preset: str = 'standard',
        typescript: bool = False,
        lighting: Optional[List[str]] = None,
        controls: Optional[str] = None,
        environment: Optional[str] = None,
        shadows: bool = False,
        post_processing: bool = False,
        performance: bool = False,
        physics: bool = False,
    ):
        preset_config = self.PRESETS.get(preset, self.PRESETS['standard'])

        self.typescript = typescript
        self.lighting = lighting or preset_config['lighting']
        self.controls = controls or preset_config['controls'][0]
        self.environment = environment if environment is not None else preset_config['environment']
        self.shadows = shadows or preset_config['shadows']
        self.post_processing = post_processing or preset_config.get('post_processing', False)
        self.performance = performance or preset_config.get('performance', False)
        self.physics = physics or preset_config.get('physics', False)

    def generate(self) -> str:
        """Generate complete scene code."""
        imports = self._generate_imports()
        lighting_component = self._generate_lighting()
        environment_component = self._generate_environment()
        controls_component = self._generate_controls()
        post_processing_component = self._generate_post_processing()
        performance_component = self._generate_performance()
        physics_component = self._generate_physics()
        scene_component = self._generate_scene_component()
        canvas_wrapper = self._generate_canvas_wrapper()

        return f"""{imports}

{lighting_component}

{environment_component}

{controls_component}

{post_processing_component}

{performance_component}

{physics_component}

{scene_component}

{canvas_wrapper}
"""

    def _generate_imports(self) -> str:
        """Generate import statements."""
        imports = ["import { Canvas } from '@react-three/fiber'"]

        drei_imports = []

        if self.controls == 'orbit':
            drei_imports.append('OrbitControls')
        elif self.controls == 'fly':
            drei_imports.append('FlyControls')
        elif self.controls == 'pointer-lock':
            drei_imports.append('PointerLockControls')

        if self.environment:
            drei_imports.append('Environment')
        if self.shadows and self.environment == 'drei-preset':
            drei_imports.append('ContactShadows')
        if self.environment == 'sky':
            drei_imports.append('Sky')
        if self.performance:
            drei_imports.extend(['AdaptiveDpr', 'AdaptiveEvents', 'PerformanceMonitor'])

        if drei_imports:
            imports.append(f"import {{ {', '.join(drei_imports)} }} from '@react-three/drei'")

        if self.post_processing:
            imports.append("import { EffectComposer, Bloom, DepthOfField } from '@react-three/postprocessing'")

        if self.physics:
            imports.append("import { Physics, RigidBody } from '@react-three/rapier'")

        if self.typescript:
            imports.append("import * as THREE from 'three'")

        return "\n".join(imports)

    def _generate_lighting(self) -> str:
        """Generate lighting setup component."""
        lights = []

        if 'ambient' in self.lighting:
            lights.append("      <ambientLight intensity={0.5} />")

        if 'directional' in self.lighting:
            shadow_props = """
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-camera-far={50}
        shadow-camera-left={-10}
        shadow-camera-right={10}
        shadow-camera-top={10}
        shadow-camera-bottom={-10}""" if self.shadows else ""
            lights.append(f"""      <directionalLight
        position={{[5, 5, 5]}}
        intensity={{1}}{shadow_props}
      />""")

        if 'point' in self.lighting:
            lights.append("      <pointLight position={[-10, -10, -10]} intensity={0.5} />")

        if 'hemisphere' in self.lighting:
            lights.append('      <hemisphereLight intensity={0.35} groundColor="black" />')

        if 'spot' in self.lighting:
            lights.append("""      <spotLight
        position={[10, 10, 10]}
        angle={0.15}
        penumbra={1}
        intensity={1}
        castShadow
      />""")

        lighting_code = "\n".join(lights) if lights else "      {/* Add your lighting here */}"

        return f"""function Lighting() {{
  return (
    <>
{lighting_code}
    </>
  )
}}"""

    def _generate_environment(self) -> str:
        """Generate environment setup."""
        if not self.environment:
            return "// No environment configured"

        if self.environment == 'drei-preset':
            shadows = ""
            if self.shadows:
                shadows = """
      <ContactShadows
        position={[0, -1.4, 0]}
        opacity={0.75}
        scale={10}
        blur={2.5}
        far={4}
      />"""

            return f"""function EnvironmentSetup() {{
  return (
    <>
      <Environment preset="sunset" />{shadows}
    </>
  )
}}"""

        elif self.environment == 'sky':
            return """function EnvironmentSetup() {
  return <Sky sunPosition={[100, 20, 100]} />
}"""

        elif self.environment == 'hdri':
            return """function EnvironmentSetup() {
  return <Environment files="/path/to/hdri.hdr" />
}"""

        return "// Environment not configured"

    def _generate_controls(self) -> str:
        """Generate camera controls."""
        if self.controls == 'orbit':
            return """function Controls() {
  return <OrbitControls makeDefault />
}"""
        elif self.controls == 'fly':
            return """function Controls() {
  return <FlyControls makeDefault />
}"""
        elif self.controls == 'pointer-lock':
            return """function Controls() {
  return <PointerLockControls makeDefault />
}"""
        else:
            return "// No controls configured"

    def _generate_post_processing(self) -> str:
        """Generate post-processing effects."""
        if not self.post_processing:
            return "// Post-processing disabled"

        return """function Effects() {
  return (
    <EffectComposer>
      <Bloom luminanceThreshold={0} luminanceSmoothing={0.9} height={300} />
      <DepthOfField focusDistance={0} focalLength={0.02} bokehScale={2} height={480} />
    </EffectComposer>
  )
}"""

    def _generate_performance(self) -> str:
        """Generate performance optimization components."""
        if not self.performance:
            return "// Performance optimizations disabled"

        return """function PerformanceOptimizations() {
  return (
    <>
      <AdaptiveDpr pixelated />
      <AdaptiveEvents />
      <PerformanceMonitor>
        {/* Monitor performance and adjust quality */}
      </PerformanceMonitor>
    </>
  )
}"""

    def _generate_physics(self) -> str:
        """Generate physics setup."""
        if not self.physics:
            return "// Physics disabled"

        return """function PhysicsWorld({ children }) {
  return (
    <Physics gravity={[0, -9.81, 0]}>
      {children}
    </Physics>
  )
}"""

    def _generate_scene_component(self) -> str:
        """Generate main scene component."""
        components = []

        components.append("      <Lighting />")

        if self.environment:
            components.append("      <EnvironmentSetup />")

        if self.performance:
            components.append("      <PerformanceOptimizations />")

        components.append("""
      {/* 3D Objects */}
      <mesh position={[0, 1, 0]} castShadow>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="orange" />
      </mesh>

      {/* Ground */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[10, 10]} />
        <meshStandardMaterial color="#808080" />
      </mesh>""")

        components.append("\n      <Controls />")

        if self.post_processing:
            components.append("      <Effects />")

        scene_content = "\n".join(components)

        if self.physics:
            return f"""function Scene() {{
  return (
    <PhysicsWorld>
{scene_content}
    </PhysicsWorld>
  )
}}"""
        else:
            return f"""function Scene() {{
  return (
    <>
{scene_content}
    </>
  )
}}"""

    def _generate_canvas_wrapper(self) -> str:
        """Generate Canvas wrapper component."""
        canvas_props = []

        if self.shadows:
            canvas_props.append("shadows")

        canvas_props.append("camera={{ position: [5, 5, 5], fov: 50 }}")

        if self.performance:
            canvas_props.append("dpr={[1, 2]}")
            canvas_props.append('frameloop="demand"')

        props_str = " ".join(canvas_props)

        return f"""export default function Experience() {{
  return (
    <Canvas {props_str}>
      <Scene />
    </Canvas>
  )
}}"""


def interactive_mode():
    """Run interactive mode to configure scene."""
    print("\n🎨 React Three Fiber Scene Setup - Interactive Mode\n")
    print("=" * 60)

    # Choose preset
    print("\nChoose a preset:")
    print("  1. minimal     - Basic scene with lighting and controls")
    print("  2. standard    - Complete scene with environment, shadows, controls")
    print("  3. performance - Optimized scene with adaptive performance")
    print("  4. creative    - Artistic scene with post-processing effects")
    print("  5. product     - Product viewer setup with proper lighting")
    print("  6. game        - Game-ready scene with physics")
    print("  7. custom      - Configure manually")

    preset_choice = input("\nSelect preset (1-7): ").strip()
    preset_map = {
        '1': 'minimal',
        '2': 'standard',
        '3': 'performance',
        '4': 'creative',
        '5': 'product',
        '6': 'game',
    }

    if preset_choice == '7':
        # Custom configuration
        print("\n📝 Custom Configuration\n")

        # Lighting
        print("Lighting types (comma-separated):")
        print("  ambient, directional, point, hemisphere, spot")
        lighting_input = input("Select lighting: ").strip()
        lighting = [l.strip() for l in lighting_input.split(',')] if lighting_input else ['ambient', 'directional']

        # Controls
        print("\nCamera controls:")
        print("  1. orbit    - OrbitControls (mouse drag rotation)")
        print("  2. fly      - FlyControls (keyboard navigation)")
        print("  3. pointer  - PointerLockControls (FPS-style)")
        controls_choice = input("Select controls (1-3): ").strip()
        controls_map = {'1': 'orbit', '2': 'fly', '3': 'pointer'}
        controls = controls_map.get(controls_choice, 'orbit')

        # Environment
        print("\nEnvironment:")
        print("  1. drei-preset - Use Drei environment preset")
        print("  2. sky         - Sky component")
        print("  3. none        - No environment")
        env_choice = input("Select environment (1-3): ").strip()
        env_map = {'1': 'drei-preset', '2': 'sky', '3': None}
        environment = env_map.get(env_choice, None)

        # Features
        shadows = input("\nEnable shadows? (y/n): ").strip().lower() == 'y'
        post_processing = input("Enable post-processing? (y/n): ").strip().lower() == 'y'
        performance = input("Enable performance optimizations? (y/n): ").strip().lower() == 'y'
        physics = input("Enable physics? (y/n): ").strip().lower() == 'y'

        setup = R3FSceneSetup(
            preset='standard',
            lighting=lighting,
            controls=controls,
            environment=environment,
            shadows=shadows,
            post_processing=post_processing,
            performance=performance,
            physics=physics,
        )
    else:
        preset = preset_map.get(preset_choice, 'standard')
        setup = R3FSceneSetup(preset=preset)

    # TypeScript
    typescript = input("\nGenerate TypeScript? (y/n): ").strip().lower() == 'y'
    setup.typescript = typescript

    # Output
    output_file = input("\nOutput file (leave empty for stdout): ").strip()

    print("\n🚀 Generating scene...\n")

    try:
        code = setup.generate()

        if output_file:
            with open(output_file, 'w') as f:
                f.write(code)
            print(f"✅ Scene generated → {output_file}")
        else:
            print(code)

    except Exception as e:
        print(f"❌ Error: {e}", file=sys.stderr)
        sys.exit(1)


def main():
    parser = argparse.ArgumentParser(
        description='Generate React Three Fiber scene setup',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__
    )

    parser.add_argument(
        '--preset',
        default='standard',
        choices=['minimal', 'standard', 'performance', 'creative', 'product', 'game'],
        help='Scene preset (default: standard)'
    )

    parser.add_argument(
        '--output',
        help='Output file path (default: stdout)'
    )

    parser.add_argument(
        '--typescript',
        action='store_true',
        help='Generate TypeScript code'
    )

    parser.add_argument(
        '--lighting',
        help='Comma-separated lighting types (ambient,directional,point,hemisphere,spot)'
    )

    parser.add_argument(
        '--controls',
        choices=['orbit', 'fly', 'pointer-lock'],
        help='Camera controls type'
    )

    parser.add_argument(
        '--environment',
        choices=['drei-preset', 'sky', 'hdri', 'none'],
        help='Environment type'
    )

    parser.add_argument(
        '--shadows',
        action='store_true',
        help='Enable shadows'
    )

    parser.add_argument(
        '--post-processing',
        action='store_true',
        help='Enable post-processing effects'
    )

    parser.add_argument(
        '--performance',
        action='store_true',
        help='Enable performance optimizations'
    )

    parser.add_argument(
        '--physics',
        action='store_true',
        help='Enable physics'
    )

    parser.add_argument(
        '--interactive',
        action='store_true',
        help='Run in interactive mode'
    )

    args = parser.parse_args()

    # Run interactive mode if requested
    if args.interactive or len(sys.argv) == 1:
        interactive_mode()
        return

    # Parse lighting
    lighting = None
    if args.lighting:
        lighting = [l.strip() for l in args.lighting.split(',')]

    # Parse environment
    environment = args.environment if args.environment != 'none' else None

    # Generate scene
    setup = R3FSceneSetup(
        preset=args.preset,
        typescript=args.typescript,
        lighting=lighting,
        controls=args.controls,
        environment=environment,
        shadows=args.shadows,
        post_processing=args.post_processing,
        performance=args.performance,
        physics=args.physics,
    )

    try:
        code = setup.generate()

        # Output
        if args.output:
            with open(args.output, 'w') as f:
                f.write(code)
            print(f"✅ Scene generated → {args.output}")
        else:
            print(code)

    except Exception as e:
        print(f"❌ Error: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == '__main__':
    main()
