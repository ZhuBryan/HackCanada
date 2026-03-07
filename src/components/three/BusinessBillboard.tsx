"use client";

/**
 * Avenue-X: BusinessBillboard
 *
 * A floating billboard at the end of a tether showing the business icon/logo.
 * Always faces the camera using Drei's Billboard component.
 */

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Billboard, Text, RoundedBox } from "@react-three/drei";
import { getCategoryColor } from "@/lib/cloudinary";
import * as THREE from "three";

// Category icons (emoji-style text rendered in 3D)
const CATEGORY_ICONS: Record<string, string> = {
  cafe: "☕",
  restaurant: "🍽",
  pharmacy: "💊",
  hospital: "🏥",
  park: "🌳",
  grocery: "🛒",
  gym: "💪",
  clinic: "⚕",
  default: "📍",
};

interface BusinessBillboardProps {
  position: [number, number, number];
  name: string;
  category: string;
  isSmallBusiness?: boolean;
  onClick?: () => void;
}

export default function BusinessBillboard({
  position,
  name,
  category,
  isSmallBusiness = false,
  onClick,
}: BusinessBillboardProps) {
  const glowRef = useRef<THREE.Mesh>(null);
  const groupRef = useRef<THREE.Group>(null);
  const color = getCategoryColor(category);
  const icon = CATEGORY_ICONS[category.toLowerCase()] || CATEGORY_ICONS.default;

  useFrame((state) => {
    // Distance scaling to keep billboards readable when zoomed out (Map View)
    if (groupRef.current) {
      const worldPos = new THREE.Vector3(...position);
      const dist = state.camera.position.distanceTo(worldPos);
      const s = Math.max(1, dist / 20); // Base scale of 1, scales up as camera pulls away
      groupRef.current.scale.set(s, s, s);
    }

    if (glowRef.current && isSmallBusiness) {
      // Pulsing glow ring for small businesses
      const pulse = 1 + Math.sin(state.clock.elapsedTime * 3) * 0.15;
      glowRef.current.scale.set(pulse, pulse, 1);
    }
  });

  return (
    <Billboard
      position={position}
      follow
      lockX={false}
      lockY={false}
      lockZ={false}
    >
      <group
        ref={groupRef}
        onClick={onClick}
        onPointerOver={() => { document.body.style.cursor = "pointer"; }}
        onPointerOut={() => { document.body.style.cursor = "auto"; }}
      >
        {/* Glow ring behind (visible for small businesses) */}
        {isSmallBusiness && (
          <mesh ref={glowRef} position={[0, 0, -0.05]}>
            <ringGeometry args={[0.55, 0.75, 32]} />
            <meshBasicMaterial
              color="#FFD700"
              transparent
              opacity={0.6}
              side={THREE.DoubleSide}
              blending={THREE.AdditiveBlending}
              depthWrite={false}
            />
          </mesh>
        )}

        {/* Card background */}
        <RoundedBox args={[1.4, 0.9, 0.05]} radius={0.08}>
          <meshStandardMaterial
            color="#1A1A2E"
            transparent
            opacity={0.92}
            roughness={0.3}
            metalness={0.1}
          />
        </RoundedBox>

        {/* Category icon */}
        <Text
          position={[0, 0.12, 0.04]}
          fontSize={0.3}
          anchorX="center"
          anchorY="middle"
        >
          {icon}
        </Text>

        {/* Business name */}
        <Text
          position={[0, -0.22, 0.04]}
          fontSize={0.1}
          maxWidth={1.2}
          anchorX="center"
          anchorY="middle"
          color={color}
          outlineWidth={0.005}
          outlineColor="#000000"
        >
          {name.length > 20 ? name.substring(0, 18) + "…" : name}
        </Text>

        {/* Accent line */}
        <mesh position={[0, -0.35, 0.04]}>
          <planeGeometry args={[0.8, 0.02]} />
          <meshBasicMaterial
            color={color}
            transparent
            opacity={0.8}
          />
        </mesh>

        {/* Small business badge */}
        {isSmallBusiness && (
          <group position={[0.55, 0.35, 0.04]}>
            <mesh>
              <circleGeometry args={[0.12, 16]} />
              <meshBasicMaterial color="#FFD700" />
            </mesh>
            <Text
              fontSize={0.08}
              anchorX="center"
              anchorY="middle"
              color="#1A1A2E"
            >
              ★
            </Text>
          </group>
        )}
      </group>
    </Billboard>
  );
}
