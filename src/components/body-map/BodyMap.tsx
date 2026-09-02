"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, useGLTF } from "@react-three/drei";
import { Suspense, useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type { MuscleStatusOnDate } from "@/lib/types";
import { ZONE_COLORS, zoneState } from "./status-colors";

export type BodyView = "front" | "back";

export interface BodyMapProps {
  statuses: MuscleStatusOnDate[];
  selectedId: string | null;
  onSelect: (muscleId: string | null) => void;
  view: BodyView;
  className?: string;
}

const MODEL_URL = `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/models/body.glb`;
const ZONE_PREFIX = "zone_";
const CAMERA_DISTANCE = 2.6;

type Layer = { kind: "zone"; id: string } | { kind: "filler" } | { kind: "skeleton" };

/** The glb nests each mesh under a named node. Walk up to find that name. */
function layerOf(obj: THREE.Object3D): Layer | null {
  for (let o: THREE.Object3D | null = obj; o; o = o.parent) {
    if (o.name.startsWith(ZONE_PREFIX)) return { kind: "zone", id: o.name.slice(ZONE_PREFIX.length) };
    if (o.name === "filler") return { kind: "filler" };
    if (o.name === "skeleton") return { kind: "skeleton" };
  }
  return null;
}

function materialFor(layer: Layer | null): THREE.MeshStandardMaterial {
  switch (layer?.kind) {
    case "zone":
      return new THREE.MeshStandardMaterial({ color: ZONE_COLORS.fresh, roughness: 0.55, metalness: 0.05 });
    case "filler":
      return new THREE.MeshStandardMaterial({ color: "#35353b", roughness: 0.75, metalness: 0.0 });
    default:
      return new THREE.MeshStandardMaterial({
        color: "#d4d4d8",
        roughness: 0.8,
        transparent: true,
        opacity: 0.22,
        depthWrite: false,
      });
  }
}

function Model({ statuses, selectedId, onSelect, view }: Omit<BodyMapProps, "className">) {
  const { scene } = useGLTF(MODEL_URL, false, true);
  const group = useRef<THREE.Group>(null);
  const byId = useMemo(() => new Map(statuses.map((s) => [s.muscle_id, s])), [statuses]);

  // One material per mesh, so each zone can take its own color.
  useEffect(() => {
    scene.traverse((obj) => {
      if (!(obj instanceof THREE.Mesh)) return;
      const layer = layerOf(obj);
      obj.material = materialFor(layer);
      obj.userData.zone = layer?.kind === "zone" ? layer.id : null;
      obj.renderOrder = layer?.kind === "skeleton" ? 0 : 1;
    });
  }, [scene]);

  useEffect(() => {
    scene.traverse((obj) => {
      if (!(obj instanceof THREE.Mesh) || !obj.userData.zone) return;
      const id = obj.userData.zone as string;
      const mat = obj.material as THREE.MeshStandardMaterial;
      const color = ZONE_COLORS[zoneState(byId.get(id))];
      mat.color.set(color);
      const selected = id === selectedId;
      // Selected zone glows in its own color, so the status stays readable.
      mat.emissive.set(selected ? color : "#000000");
      mat.emissiveIntensity = selected ? 0.9 : 0;
    });
  }, [scene, byId, selectedId]);

  // Turn the body, not the camera, so OrbitControls keeps the user's zoom.
  useFrame((_, dt) => {
    const g = group.current;
    if (!g) return;
    const target = view === "front" ? 0 : Math.PI;
    const delta = target - g.rotation.y;
    if (Math.abs(delta) < 0.002) {
      g.rotation.y = target;
      return;
    }
    // Frame-rate independent ease-out, ~0.5 s to settle.
    g.rotation.y += delta * (1 - Math.exp(-8 * Math.min(dt, 0.1)));
  });

  return (
    <group ref={group}>
      <primitive
        object={scene}
        onClick={(e: { stopPropagation: () => void; object: THREE.Object3D }) => {
          e.stopPropagation();
          onSelect((e.object.userData.zone as string | null) ?? null);
        }}
        onPointerMissed={() => onSelect(null)}
      />
    </group>
  );
}

export default function BodyMap({ statuses, selectedId, onSelect, view, className }: BodyMapProps) {
  return (
    <div className={className}>
      <Canvas
        camera={{ position: [0, 0, CAMERA_DISTANCE], fov: 35, near: 0.05, far: 50 }}
        dpr={[1, 2]}
        gl={{ antialias: true, alpha: true }}
      >
        <ambientLight intensity={0.9} />
        <directionalLight position={[3, 5, 4]} intensity={1.4} />
        <directionalLight position={[-3, 2, -4]} intensity={0.6} />
        <Suspense fallback={null}>
          <Model statuses={statuses} selectedId={selectedId} onSelect={onSelect} view={view} />
        </Suspense>
        <OrbitControls enablePan={false} minDistance={1.2} maxDistance={5} target={[0, 0, 0]} />
      </Canvas>
    </div>
  );
}

useGLTF.preload(MODEL_URL, false, true);
