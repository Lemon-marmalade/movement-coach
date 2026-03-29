import React, { useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Grid, PerspectiveCamera } from '@react-three/drei';
import * as THREE from 'three';
import { Results } from '@mediapipe/pose';

interface Skeleton3DProps {
  results: Results | null;
}

const POSE_CONNECTIONS_INDICES = [
  [11, 12], [11, 13], [13, 15], [12, 14], [14, 16], // Shoulders and arms
  [11, 23], [12, 24], [23, 24], // Torso
  [23, 25], [25, 27], [27, 29], [29, 31], // Left leg
  [24, 26], [26, 28], [28, 30], [30, 32], // Right leg
];

const SkeletonModel: React.FC<{ results: Results | null }> = ({ results }) => {
  const groupRef = useRef<THREE.Group>(null);

  useFrame(() => {
    if (!results?.poseWorldLandmarks || !groupRef.current) return;

    const landmarks = results.poseWorldLandmarks;
    const points: THREE.Vector3[] = landmarks.map(l => new THREE.Vector3(-l.x, -l.y, -l.z));

    // Update spheres (joints)
    groupRef.current.children.forEach((child, i) => {
      if (child instanceof THREE.Mesh && i < landmarks.length) {
        child.position.copy(points[i]);
        child.visible = (landmarks[i].visibility || 0) > 0.5;
      }
    });
  });

  return (
    <group ref={groupRef}>
      {/* Joints */}
      {results?.poseWorldLandmarks?.map((_, i) => (
        <mesh key={i}>
          <sphereGeometry args={[0.02, 16, 16]} />
          <meshStandardMaterial color="#00FF00" emissive="#00FF00" emissiveIntensity={0.5} />
        </mesh>
      ))}
      
      {/* Bones (Lines) */}
      {results?.poseWorldLandmarks && POSE_CONNECTIONS_INDICES.map(([start, end], i) => (
        <Bone key={i} startIdx={start} endIdx={end} results={results} />
      ))}
    </group>
  );
};

const Bone: React.FC<{ startIdx: number; endIdx: number; results: Results }> = ({ startIdx, endIdx, results }) => {
  const lineRef = useRef<THREE.Line>(null);

  useFrame(() => {
    if (!lineRef.current) return;
    const start = results.poseWorldLandmarks[startIdx];
    const end = results.poseWorldLandmarks[endIdx];
    
    if (start && end && (start.visibility || 0) > 0.5 && (end.visibility || 0) > 0.5) {
      const positions = new Float32Array([
        -start.x, -start.y, -start.z,
        -end.x, -end.y, -end.z
      ]);
      lineRef.current.geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      lineRef.current.visible = true;
    } else {
      lineRef.current.visible = false;
    }
  });

  return (
    <line ref={lineRef as any}>
      <bufferGeometry />
      <lineBasicMaterial color="#00FF00" linewidth={2} />
    </line>
  );
};

export const Skeleton3D: React.FC<Skeleton3DProps> = ({ results }) => {
  return (
    <div className="w-full h-full bg-zinc-950 rounded-lg border border-zinc-800 overflow-hidden relative">
      <div className="absolute top-4 left-4 z-10">
        <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">3D Spatial Projection</p>
      </div>
      <Canvas>
        <PerspectiveCamera makeDefault position={[0, 0, 2]} />
        <OrbitControls />
        <ambientLight intensity={0.5} />
        <pointLight position={[10, 10, 10]} />
        <Grid 
          infiniteGrid 
          fadeDistance={10} 
          sectionSize={1} 
          sectionThickness={1} 
          sectionColor="#18181b" 
          cellColor="#27272a" 
        />
        <SkeletonModel results={results} />
      </Canvas>
    </div>
  );
};
