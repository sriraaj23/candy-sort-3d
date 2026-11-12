import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { getTheme, type Theme } from '../game';
import { useProgress } from '../store/progressStore';
import { useSettings } from '../store/settingsStore';
import { useUi } from '../store/uiStore';
import { getSpiralTexture } from './assets';
import { DriftParticles } from './Effects';

/** Procedural studio reflections so glossy candies shine without files. */
function EnvMap() {
  const { gl, scene } = useThree();
  useEffect(() => {
    const pm = new THREE.PMREMGenerator(gl);
    const room = new RoomEnvironment();
    const rt = pm.fromScene(room, 0.04);
    scene.environment = rt.texture;
    scene.environmentIntensity = 0.55;
    return () => {
      scene.environment = null;
      rt.dispose();
      pm.dispose();
      room.traverse((o) => {
        const mesh = o as THREE.Mesh;
        mesh.geometry?.dispose();
        const mat = mesh.material as THREE.Material | undefined;
        mat?.dispose?.();
      });
    };
  }, [gl, scene]);
  return null;
}

function Sky({ theme }: { theme: Theme }) {
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        fog: false,
        uniforms: { top: { value: new THREE.Color() }, bottom: { value: new THREE.Color() } },
        vertexShader: `varying vec3 vPos; void main(){ vPos = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
        fragmentShader: `uniform vec3 top; uniform vec3 bottom; varying vec3 vPos;
          void main(){ float h = smoothstep(-0.15, 0.7, vPos.y); gl_FragColor = vec4(mix(bottom, top, h), 1.0);
          #include <colorspace_fragment>
          }`,
      }),
    [],
  );
  useEffect(() => {
    mat.uniforms.top.value.set(theme.skyTop);
    mat.uniforms.bottom.value.set(theme.skyBottom);
  }, [mat, theme]);
  useEffect(() => () => mat.dispose(), [mat]);
  return (
    <mesh material={mat} renderOrder={-10}>
      <sphereGeometry args={[160, 32, 16]} />
    </mesh>
  );
}

/** Rounded candy mountain with stripes baked into vertex colours. */
function useMountainGeometry() {
  return useMemo(() => {
    const pts: THREE.Vector2[] = [];
    for (let i = 0; i <= 24; i++) {
      const t = i / 24;
      const r = 1 - Math.pow(t, 1.6);
      pts.push(new THREE.Vector2(Math.max(0.0001, r * (0.9 + 0.1 * Math.cos(t * 3))), t));
    }
    pts.push(new THREE.Vector2(0, 1));
    const g = new THREE.LatheGeometry(pts, 36);
    const pos = g.attributes.position as THREE.BufferAttribute;
    const colors = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i);
      const band = Math.floor(y * 7 + Math.atan2(pos.getZ(i), pos.getX(i)) * 0.25) % 2;
      const v = y > 0.82 ? 1.18 : band ? 1.0 : 0.88; // frosting cap + stripes
      colors[i * 3] = colors[i * 3 + 1] = colors[i * 3 + 2] = v;
    }
    g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    return g;
  }, []);
}

const MOUNTAINS: [number, number, number, number, number][] = [
  // x, z, radius, height, colour index
  [-34, -60, 14, 16, 0],
  [-16, -66, 12, 22, 1],
  [4, -72, 16, 18, 2],
  [24, -64, 12, 20, 3],
  [42, -58, 14, 14, 0],
  [-50, -48, 10, 11, 2],
  [56, -46, 10, 12, 1],
];

function Mountains({ theme }: { theme: Theme }) {
  const geo = useMountainGeometry();
  useEffect(() => () => geo.dispose(), [geo]);
  return (
    <group>
      {MOUNTAINS.map(([x, z, r, h, c], i) => (
        <mesh key={i} geometry={geo} position={[x, -4, z]} scale={[r, h, r]}>
          <meshStandardMaterial color={theme.mountains[c % theme.mountains.length]} vertexColors roughness={0.75} />
        </mesh>
      ))}
    </group>
  );
}

function Lollipop({ position, scale, theme, tilt }: { position: [number, number, number]; scale: number; theme: Theme; tilt: number }) {
  const tex = getSpiralTexture(theme.lollipop[0], theme.lollipop[1]);
  const ref = useRef<THREE.Mesh>(null);
  const reduced = useUi((s) => s.reducedMotion);
  useFrame((_, dt) => {
    if (ref.current && !reduced) ref.current.rotation.z += dt * 0.15;
  });
  return (
    <group position={position} scale={scale} rotation-z={tilt}>
      <mesh position-y={2.5}>
        <cylinderGeometry args={[0.12, 0.12, 5, 10]} />
        <meshStandardMaterial color="#fffaf2" roughness={0.5} />
      </mesh>
      <group position-y={5.6}>
        <mesh ref={ref} rotation-x={Math.PI / 2}>
          <cylinderGeometry args={[1.6, 1.6, 0.4, 40]} />
          <meshStandardMaterial attach="material-0" color={theme.lollipop[0]} roughness={0.3} />
          <meshStandardMaterial attach="material-1" map={tex} roughness={0.25} />
          <meshStandardMaterial attach="material-2" map={tex} roughness={0.25} />
        </mesh>
      </group>
    </group>
  );
}

const CLOUDS: [number, number, number, number][] = [
  [-22, 16, -50, 1.4],
  [6, 20, -58, 1.8],
  [30, 15, -48, 1.2],
  [-40, 22, -62, 1.6],
];
const PUFFS: [number, number, number, number][] = [
  [0, 0, 0, 2.2],
  [2.2, -0.4, 0.3, 1.7],
  [-2.2, -0.5, 0.2, 1.6],
  [1, 0.9, -0.2, 1.6],
  [-1, 0.8, 0, 1.4],
];

function Clouds({ theme }: { theme: Theme }) {
  const ref = useRef<THREE.Group>(null);
  const reduced = useUi((s) => s.reducedMotion);
  const geo = useMemo(() => new THREE.SphereGeometry(1, 16, 12), []);
  useEffect(() => () => geo.dispose(), [geo]);
  useFrame((state) => {
    if (!ref.current || reduced) return;
    const t = state.clock.elapsedTime;
    ref.current.children.forEach((c, i) => {
      c.position.x = CLOUDS[i][0] + Math.sin(t * 0.03 + i * 2) * 6;
    });
  });
  return (
    <group ref={ref}>
      {CLOUDS.map(([x, y, z, s], i) => (
        <group key={i} position={[x, y, z]} scale={s}>
          {PUFFS.map(([px, py, pz, ps], j) => (
            <mesh key={j} geometry={geo} position={[px, py, pz]} scale={[ps, ps * 0.8, ps]}>
              <meshStandardMaterial color={theme.cloud} roughness={1} emissive={theme.cloud} emissiveIntensity={0.25} />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  );
}

function Ground({ theme, shadows }: { theme: Theme; shadows: boolean }) {
  const platform = useMemo(() => {
    const pts = [
      [0, -0.6],
      [7.6, -0.6],
      [8, -0.45],
      [8.15, -0.2],
      [8.05, -0.03],
      [7.8, 0],
      [0, 0],
    ].map(([x, y]) => new THREE.Vector2(x, y));
    return new THREE.LatheGeometry(pts, 64);
  }, []);
  useEffect(() => () => platform.dispose(), [platform]);
  return (
    <group>
      {/* far meadow */}
      <mesh rotation-x={-Math.PI / 2} position-y={-4} receiveShadow={false}>
        <circleGeometry args={[150, 48]} />
        <meshStandardMaterial color={theme.groundEdge} roughness={1} />
      </mesh>
      {/* platform the jars stand on */}
      <mesh geometry={platform} receiveShadow={shadows} scale={[1, 1, 0.62]} position={[0, 0, -0.9]}>
        <meshStandardMaterial color={theme.ground} roughness={0.6} />
      </mesh>
      <mesh position={[0, -2.3, -0.9]} scale={[1, 1, 0.62]}>
        <cylinderGeometry args={[7.9, 6.5, 3.5, 48]} />
        <meshStandardMaterial color={theme.groundEdge} roughness={0.7} />
      </mesh>
    </group>
  );
}

export function World() {
  const themeId = useProgress((s) => s.selectedTheme);
  const quality = useSettings((s) => s.quality);
  const theme = getTheme(themeId);
  const shadows = quality === 'high';
  const { scene } = useThree();

  useEffect(() => {
    scene.fog = new THREE.Fog(theme.fog, 60, 170);
    return () => {
      scene.fog = null;
    };
  }, [scene, theme.fog]);

  return (
    <>
      <EnvMap />
      <ambientLight color={theme.ambient} intensity={1.0} />
      <directionalLight
        color={theme.keyLight}
        intensity={2.1}
        position={[5, 12, 8]}
        castShadow={shadows}
        shadow-mapSize={[1024, 1024]}
        shadow-camera-left={-9}
        shadow-camera-right={9}
        shadow-camera-top={9}
        shadow-camera-bottom={-4}
        shadow-camera-near={1}
        shadow-camera-far={40}
        shadow-bias={-0.0005}
        shadow-radius={4}
      />
      <Sky theme={theme} />
      <Mountains theme={theme} />
      <Lollipop position={[-13, -4, -22]} scale={1.6} theme={theme} tilt={0.08} />
      <Lollipop position={[15, -4, -26]} scale={1.9} theme={theme} tilt={-0.1} />
      {quality !== 'low' && <Lollipop position={[-30, -4, -40]} scale={2.2} theme={theme} tilt={-0.05} />}
      <Clouds theme={theme} />
      <Ground theme={theme} shadows={shadows} />
      <DriftParticles quality={quality} />
    </>
  );
}
