import { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Environment, Html, OrbitControls, Sky } from '@react-three/drei';
import gsap from 'gsap';
import * as THREE from 'three';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import type { Complaint } from '../types/civic';

export type CameraPreset = 'overview' | 'downtown' | 'residential' | 'civic';

interface BuildingSpec {
  id: string;
  x: number;
  z: number;
  w: number;
  d: number;
  h: number;
  zone: 'commercial' | 'residential' | 'civic';
  color: string;
  emissive: string;
}

interface VehicleSpec {
  id: string;
  axis: 'x' | 'z';
  lane: number;
  speed: number;
  offset: number;
  color: string;
}

export interface CityMarker {
  id: string;
  trackingCode: string;
  title: string;
  status: string;
  priority: string;
  position: [number, number, number];
}

const CAMERA_PRESETS: Record<CameraPreset, { pos: [number, number, number]; target: [number, number, number] }> = {
  overview: { pos: [26, 20, 28], target: [0, 1.5, 0] },
  downtown: { pos: [12, 11, 14], target: [-3, 3, -3] },
  residential: { pos: [-18, 12, 18], target: [-10, 1.5, 9] },
  civic: { pos: [16, 10, -14], target: [8, 2, -8] },
};

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(mq.matches);
    const handler = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);
  return reduced;
}

function CameraRig({
  preset,
  reducedMotion,
}: {
  preset: CameraPreset;
  reducedMotion: boolean;
}) {
  const { camera } = useThree();
  const controlsRef = useRef<OrbitControlsImpl | null>(null);

  useEffect(() => {
    const cfg = CAMERA_PRESETS[preset];
    if (reducedMotion) {
      camera.position.set(...cfg.pos);
      if (controlsRef.current) {
        controlsRef.current.target.set(...cfg.target);
        controlsRef.current.update();
      }
      return;
    }

    gsap.to(camera.position, {
      x: cfg.pos[0],
      y: cfg.pos[1],
      z: cfg.pos[2],
      duration: 1.3,
      ease: 'power3.inOut',
    });

    if (controlsRef.current) {
      gsap.to(controlsRef.current.target, {
        x: cfg.target[0],
        y: cfg.target[1],
        z: cfg.target[2],
        duration: 1.3,
        ease: 'power3.inOut',
        onUpdate: () => controlsRef.current?.update(),
      });
    }
  }, [preset, camera, reducedMotion]);

  return (
    <OrbitControls
      ref={controlsRef}
      enableDamping
      dampingFactor={0.06}
      maxPolarAngle={Math.PI / 2.15}
      minDistance={8}
      maxDistance={52}
    />
  );
}

function SmartBuilding({ spec }: { spec: BuildingSpec }) {
  const hasTopCrown = spec.zone === 'commercial' && spec.h > 7;
  return (
    <group position={[spec.x, 0, spec.z]}>
      <mesh position={[0, spec.h / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[spec.w, spec.h, spec.d]} />
        <meshStandardMaterial
          color={spec.color}
          metalness={spec.zone === 'commercial' ? 0.65 : 0.25}
          roughness={spec.zone === 'commercial' ? 0.28 : 0.65}
          emissive={spec.emissive}
          emissiveIntensity={0.18}
        />
      </mesh>
      <mesh position={[0, spec.h + 0.35, 0]} castShadow>
        <boxGeometry args={[spec.w * 0.68, 0.7, spec.d * 0.68]} />
        <meshStandardMaterial color="#1e293b" metalness={0.5} roughness={0.4} />
      </mesh>
      {hasTopCrown && (
        <mesh position={[0, spec.h + 0.75, 0]}>
          <boxGeometry args={[spec.w * 0.72, 0.12, spec.d * 0.72]} />
          <meshStandardMaterial color="#38bdf8" emissive="#38bdf8" emissiveIntensity={1.6} />
        </mesh>
      )}
    </group>
  );
}

function RoadNetwork() {
  const roadPositions = [-12, 0, 12];
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]} receiveShadow>
        <planeGeometry args={[72, 72]} />
        <meshStandardMaterial color="#0b1322" roughness={0.95} />
      </mesh>
      <gridHelper args={[68, 34, '#1e3a5f', '#111c33']} position={[0, 0.01, 0]} />
      {roadPositions.map((pos) => (
        <group key={`roads-${pos}`}>
          <mesh position={[0, 0.03, pos]} receiveShadow>
            <boxGeometry args={[52, 0.06, 4.4]} />
            <meshStandardMaterial color="#334155" roughness={0.85} />
          </mesh>
          <mesh position={[0, 0.05, pos]} receiveShadow>
            <boxGeometry args={[52, 0.06, 3.2]} />
            <meshStandardMaterial color="#111827" roughness={0.9} />
          </mesh>
          <mesh position={[pos, 0.035, 0]} receiveShadow>
            <boxGeometry args={[4.4, 0.06, 52]} />
            <meshStandardMaterial color="#334155" roughness={0.85} />
          </mesh>
          <mesh position={[pos, 0.055, 0]} receiveShadow>
            <boxGeometry args={[3.2, 0.06, 52]} />
            <meshStandardMaterial color="#111827" roughness={0.9} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function ParkAndTrees() {
  const treeCoords: Array<[number, number]> = [
    [-16, -6], [-18, -8], [-15, -9],
    [16, 6], [18, 8], [15, 9],
    [-6, 16], [-8, 18], [6, -16], [8, -18],
  ];

  return (
    <group>
      <mesh position={[6, 0.04, 6]} receiveShadow>
        <boxGeometry args={[7.2, 0.08, 7.2]} />
        <meshStandardMaterial color="#14532d" roughness={0.9} />
      </mesh>
      <mesh position={[6, 0.09, 6]}>
        <cylinderGeometry args={[1.6, 1.8, 0.12, 24]} />
        <meshStandardMaterial color="#0284c7" metalness={0.3} roughness={0.15} />
      </mesh>
      {treeCoords.map(([x, z], idx) => (
        <group key={`tree-${idx}`} position={[x, 0, z]}>
          <mesh position={[0, 0.45, 0]} castShadow>
            <cylinderGeometry args={[0.12, 0.16, 0.9, 8]} />
            <meshStandardMaterial color="#5c4033" roughness={0.9} />
          </mesh>
          <mesh position={[0, 1.25, 0]} castShadow>
            <coneGeometry args={[0.75, 1.5, 8]} />
            <meshStandardMaterial color="#15803d" roughness={0.8} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function Streetlights() {
  const lights: Array<[number, number]> = [
    [-6, -10.2], [6, -10.2], [-6, 1.8], [6, 1.8], [-6, 13.8], [6, 13.8],
    [-10.2, -6], [-10.2, 6], [1.8, -6], [1.8, 6], [13.8, -6], [13.8, 6],
  ];

  return (
    <group>
      {lights.map(([x, z], idx) => (
        <group key={`lamp-${idx}`} position={[x, 0, z]}>
          <mesh position={[0, 1.3, 0]}>
            <cylinderGeometry args={[0.05, 0.07, 2.6, 8]} />
            <meshStandardMaterial color="#64748b" metalness={0.7} roughness={0.3} />
          </mesh>
          <mesh position={[0, 2.6, 0]}>
            <sphereGeometry args={[0.14, 8, 8]} />
            <meshStandardMaterial color="#fef08a" emissive="#facc15" emissiveIntensity={2} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function AnimatedVehicle({
  spec,
  reducedMotion,
}: {
  spec: VehicleSpec;
  reducedMotion: boolean;
}) {
  const ref = useRef<THREE.Group>(null);

  useFrame(({ clock }) => {
    if (!ref.current || reducedMotion) return;
    const t = clock.getElapsedTime() * spec.speed + spec.offset;
    const pos = ((t % 48) + 48) % 48 - 24;
    if (spec.axis === 'x') {
      ref.current.position.set(pos, 0.25, spec.lane);
    } else {
      ref.current.position.set(spec.lane, 0.25, pos);
    }
  });

  const rotationY = spec.axis === 'x' ? 0 : Math.PI / 2;

  return (
    <group
      ref={ref}
      position={spec.axis === 'x' ? [spec.offset, 0.25, spec.lane] : [spec.lane, 0.25, spec.offset]}
      rotation={[0, rotationY, 0]}
    >
      <mesh castShadow>
        <boxGeometry args={[1.2, 0.36, 0.62]} />
        <meshStandardMaterial color={spec.color} metalness={0.5} roughness={0.3} />
      </mesh>
      <mesh position={[0.55, 0.02, 0]}>
        <boxGeometry args={[0.12, 0.12, 0.5]} />
        <meshStandardMaterial color="#e0f2fe" emissive="#38bdf8" emissiveIntensity={2} />
      </mesh>
    </group>
  );
}

function IssueMarker({
  marker,
  selected,
  reducedMotion,
  onSelect,
}: {
  marker: CityMarker;
  selected: boolean;
  reducedMotion: boolean;
  onSelect: (m: CityMarker) => void;
}) {
  const ringRef = useRef<THREE.Mesh>(null);
  const color =
    marker.priority === 'critical'
      ? '#ef4444'
      : marker.priority === 'high'
      ? '#f59e0b'
      : '#38bdf8';

  useFrame(({ clock }) => {
    if (!ringRef.current || reducedMotion) return;
    const pulse = 1 + Math.sin(clock.getElapsedTime() * 3) * 0.2;
    ringRef.current.scale.set(pulse, pulse, 1);
  });

  return (
    <group position={marker.position}>
      <mesh
        position={[0, 1.4, 0]}
        onClick={(e) => {
          e.stopPropagation();
          onSelect(marker);
        }}
      >
        <octahedronGeometry args={[0.45, 0]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={1.6} />
      </mesh>
      <mesh ref={ringRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.14, 0]}>
        <ringGeometry args={[0.55, 0.85, 24]} />
        <meshBasicMaterial color={color} transparent opacity={0.75} side={THREE.DoubleSide} />
      </mesh>
      {selected && (
        <Html position={[0, 2.4, 0]} center distanceFactor={20}>
          <div className="w-52 rounded-xl border border-sky-500/40 bg-slate-950/95 p-2.5 text-xs text-slate-100 shadow-xl">
            <div className="font-mono text-[10px] text-sky-400">{marker.trackingCode}</div>
            <div className="mt-0.5 font-semibold">{marker.title}</div>
            <div className="mt-1 flex items-center justify-between text-[10px] text-slate-400">
              <span>Status: {marker.status}</span>
              <span className="uppercase text-amber-400">{marker.priority}</span>
            </div>
          </div>
        </Html>
      )}
    </group>
  );
}

interface CitySceneProps {
  complaints?: Complaint[];
  preset?: CameraPreset;
}

export function CityScene({ complaints = [], preset = 'overview' }: CitySceneProps) {
  const reducedMotion = usePrefersReducedMotion();
  const [selectedMarker, setSelectedMarker] = useState<CityMarker | null>(null);

  const buildings = useMemo<BuildingSpec[]>(
    () => [
      { id: 'b1', x: -6, z: -6, w: 4.5, d: 4.5, h: 11, zone: 'commercial', color: '#1e293b', emissive: '#0ea5e9' },
      { id: 'b2', x: -6, z: -18, w: 4.2, d: 4.2, h: 8.5, zone: 'commercial', color: '#0f172a', emissive: '#38bdf8' },
      { id: 'b3', x: -18, z: -6, w: 4.8, d: 4.0, h: 9.5, zone: 'commercial', color: '#1e293b', emissive: '#0284c7' },
      { id: 'b4', x: 6, z: -6, w: 5.5, d: 4.6, h: 6.2, zone: 'civic', color: '#1e3a5f', emissive: '#10b981' },
      { id: 'b5', x: 18, z: -6, w: 4.2, d: 4.2, h: 5.4, zone: 'civic', color: '#1e293b', emissive: '#10b981' },
      { id: 'b6', x: -6, z: 6, w: 4.0, d: 3.6, h: 3.8, zone: 'residential', color: '#334155', emissive: '#f59e0b' },
      { id: 'b7', x: -18, z: 6, w: 3.8, d: 3.8, h: 4.2, zone: 'residential', color: '#475569', emissive: '#f59e0b' },
      { id: 'b8', x: -6, z: 18, w: 4.4, d: 3.6, h: 3.4, zone: 'residential', color: '#334155', emissive: '#fbbf24' },
      { id: 'b9', x: 18, z: 18, w: 4.2, d: 4.2, h: 4.6, zone: 'residential', color: '#334155', emissive: '#38bdf8' },
    ],
    []
  );

  const vehicles = useMemo<VehicleSpec[]>(
    () => [
      { id: 'v1', axis: 'x', lane: -11.3, speed: 4.2, offset: -18, color: '#38bdf8' },
      { id: 'v2', axis: 'x', lane: 0.7, speed: 5.1, offset: 4, color: '#10b981' },
      { id: 'v3', axis: 'x', lane: 12.7, speed: 3.6, offset: -8, color: '#f59e0b' },
      { id: 'v4', axis: 'z', lane: -0.7, speed: 4.5, offset: -12, color: '#e2e8f0' },
      { id: 'v5', axis: 'z', lane: 11.3, speed: 3.9, offset: 9, color: '#38bdf8' },
    ],
    []
  );

  const markers = useMemo<CityMarker[]>(() => {
    if (complaints.length > 0) {
      return complaints.slice(0, 12).map((c, idx) => {
        const angle = (idx / Math.max(complaints.length, 1)) * Math.PI * 2;
        const radius = 6 + (idx % 3) * 5.5;
        return {
          id: c.id,
          trackingCode: c.tracking_code,
          title: c.title,
          status: c.status,
          priority: c.priority,
          position: [Math.cos(angle) * radius, 0, Math.sin(angle) * radius],
        };
      });
    }
    return [
      { id: 'demo-1', trackingCode: 'TWIN-NODE-01', title: 'Road Surface Sensor Zone', status: 'monitored', priority: 'high', position: [-12, 0, -1] },
      { id: 'demo-2', trackingCode: 'TWIN-NODE-02', title: 'Smart Streetlight Grid', status: 'active', priority: 'medium', position: [12, 0, 1] },
      { id: 'demo-3', trackingCode: 'TWIN-NODE-03', title: 'Stormwater Drainage Node', status: 'alert', priority: 'critical', position: [0, 0, 12] },
    ];
  }, [complaints]);

  return (
    <div className="relative h-full w-full overflow-hidden rounded-2xl border border-slate-800 bg-slate-950">
      <Canvas
        shadows
        dpr={[1, 2]}
        camera={{ position: [26, 20, 28], fov: 45, near: 0.5, far: 160 }}
        onPointerMissed={() => setSelectedMarker(null)}
      >
        <color attach="background" args={['#070b14']} />
        <fog attach="fog" args={['#070b14', 32, 80]} />
        <Sky sunPosition={[40, 18, -30]} turbidity={6} rayleigh={0.8} />
        <ambientLight intensity={0.45} />
        <directionalLight
          position={[25, 35, 20]}
          intensity={1.35}
          castShadow
          shadow-mapSize-width={1024}
          shadow-mapSize-height={1024}
        />
        <Environment preset="city" />

        <RoadNetwork />
        <ParkAndTrees />
        <Streetlights />

        {buildings.map((b) => (
          <SmartBuilding key={b.id} spec={b} />
        ))}

        {vehicles.map((v) => (
          <AnimatedVehicle key={v.id} spec={v} reducedMotion={reducedMotion} />
        ))}

        {markers.map((m) => (
          <IssueMarker
            key={m.id}
            marker={m}
            selected={selectedMarker?.id === m.id}
            reducedMotion={reducedMotion}
            onSelect={setSelectedMarker}
          />
        ))}

        <CameraRig preset={preset} reducedMotion={reducedMotion} />
      </Canvas>
    </div>
  );
}
