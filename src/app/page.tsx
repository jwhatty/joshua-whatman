'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { PointerLockControls, Text, shaderMaterial } from '@react-three/drei';
import {
    Physics,
    RigidBody,
    CapsuleCollider,
    CuboidCollider,
    useRapier,
    type RapierRigidBody,
} from '@react-three/rapier';
import * as THREE from 'three';

// ---- movement tuning ----
const SPEED = 4; // m/s
const CAPSULE_HALF_HEIGHT = 0.6;
const CAPSULE_RADIUS = 0.4;
const EYE_HEIGHT = 1.6;
const GRAVITY = 9.81;
const MAX_FALL_SPEED = 20;
const SCREEN_Y = EYE_HEIGHT + 0.15; // screens sit just above eye height

// ---- interaction tuning ----
const INTERACT_RANGE = 6;
const TWEEN_DURATION = 0.65; // seconds, for both the open and close tween

// ---- screen sizing ----
const FACE_WIDTH = 4.1;
const FACE_HEIGHT = 2.35;
const OUTER_WIDTH = 5.4;
const OUTER_HEIGHT = 3.3;

// ---- world layout ----
const CATEGORY_RADIUS = 15; // distance from spawn to each category's screen wall
const SCREEN_SPACING = 6; // gap between screens within a category
const WORLD_BOUNDARY_RADIUS = CATEGORY_RADIUS + 8; // hard walk limit — can't wander off into the void
const FLOOR_SIZE = (WORLD_BOUNDARY_RADIUS + 6) * 2;

// module-level registry so raycasting can reach every screen's mesh
// without prop-drilling refs. Swap for context/zustand if this grows.
const screenRegistry = new Map<string, { mesh: THREE.Object3D }>();

type CategoryDef = { id: string; label: string; color: string; angle: number }; // angle: 0 = north (-Z)

const CATEGORIES: CategoryDef[] = [
    { id: 'sound-design', label: 'Sound Design', color: '#5b7bff', angle: 60 },
    { id: 'music-composition', label: 'Music Composition', color: '#ff5ba0', angle: 180 },
    { id: 'audio-production', label: 'Audio Production', color: '#33d1c9', angle: 300 },
];

type CategoryLayout = {
    anchor: THREE.Vector3;
    dir: THREE.Vector3;
    tangent: THREE.Vector3;
    facing: number;
    color: string;
    label: string;
};

// facing = -angle: a screen's local +Z (its front) must point from the anchor back
// toward the origin. Rotating (0,0,1) about Y by θ gives (sinθ, 0, cosθ); solving for
// that to equal -dir works out to θ = -angle. (An earlier version used angle + π, which
// only happens to cancel out for east/west-aligned angles — it faced north/south
// screens backward, which is why some were invisible on approach.)
const CATEGORY_LAYOUT: Map<string, CategoryLayout> = new Map(
    CATEGORIES.map((c) => {
        const rad = (c.angle * Math.PI) / 180;
        const dir = new THREE.Vector3(Math.sin(rad), 0, -Math.cos(rad));
        const tangent = new THREE.Vector3(dir.z, 0, -dir.x);
        const anchor = dir.clone().multiplyScalar(CATEGORY_RADIUS);
        return [c.id, { anchor, dir, tangent, facing: -rad, color: c.color, label: c.label }];
    })
);

type ReelDef = { id: string; label: string; categoryId: string; youtubeUrl: string };

// only sound-design-1 is a real link right now — the rest share the same
// placeholder on purpose. Swap each youtubeUrl independently as reels land;
// nothing else about the layout needs to change.
const REEL_DEFS: ReelDef[] = [
    { id: 'sound-design-1', label: 'Sound Design — Featured', categoryId: 'sound-design', youtubeUrl: 'https://www.youtube.com/watch?v=t-uK94HaxeM' },
    { id: 'sound-design-2', label: 'Sound Design — Reel 2', categoryId: 'sound-design', youtubeUrl: 'https://www.youtube.com/watch?v=t-uK94HaxeM' },
    { id: 'sound-design-3', label: 'Sound Design — Reel 3', categoryId: 'sound-design', youtubeUrl: 'https://www.youtube.com/watch?v=t-uK94HaxeM' },
    { id: 'music-composition-1', label: 'Music Composition — Reel 1', categoryId: 'music-composition', youtubeUrl: 'https://www.youtube.com/watch?v=t-uK94HaxeM' },
    { id: 'music-composition-2', label: 'Music Composition — Reel 2', categoryId: 'music-composition', youtubeUrl: 'https://www.youtube.com/watch?v=t-uK94HaxeM' },
    { id: 'music-composition-3', label: 'Music Composition — Reel 3', categoryId: 'music-composition', youtubeUrl: 'https://www.youtube.com/watch?v=t-uK94HaxeM' },
    { id: 'audio-production-1', label: 'Audio Production — Reel 1', categoryId: 'audio-production', youtubeUrl: 'https://www.youtube.com/watch?v=t-uK94HaxeM' },
    { id: 'audio-production-2', label: 'Audio Production — Reel 2', categoryId: 'audio-production', youtubeUrl: 'https://www.youtube.com/watch?v=t-uK94HaxeM' },
    { id: 'audio-production-3', label: 'Audio Production — Reel 3', categoryId: 'audio-production', youtubeUrl: 'https://www.youtube.com/watch?v=t-uK94HaxeM' },
];

type ReelData = {
    id: string;
    label: string;
    categoryId: string;
    youtubeUrl: string;
    position: [number, number, number];
    rotation: [number, number, number];
};

// lay reels out along the tangent of their category's spot on the ring,
// all facing back toward spawn
const REELS: ReelData[] = (() => {
    const counts = new Map<string, number>();
    REEL_DEFS.forEach((r) => counts.set(r.categoryId, (counts.get(r.categoryId) ?? 0) + 1));
    const seen = new Map<string, number>();
    return REEL_DEFS.map((r) => {
        const layout = CATEGORY_LAYOUT.get(r.categoryId)!;
        const count = counts.get(r.categoryId) ?? 1;
        const idx = seen.get(r.categoryId) ?? 0;
        seen.set(r.categoryId, idx + 1);
        const offset = (idx - (count - 1) / 2) * SCREEN_SPACING;
        const pos = layout.anchor.clone().addScaledVector(layout.tangent, offset);
        return {
            id: r.id,
            label: r.label,
            categoryId: r.categoryId,
            youtubeUrl: r.youtubeUrl,
            position: [pos.x, SCREEN_Y, pos.z],
            rotation: [0, layout.facing, 0],
        };
    });
})();

// ---- the standalone hero screen — bigger, not part of a category, reached via stairs.
// Stairs run north from spawn (angle 0 is reserved, no category sits there); rise per
// step stays under the character controller's 0.4 autostep limit so no jump is needed. ----

const STAIR_STEP_COUNT = 8;
const STAIR_RISE = 0.35;
const STAIR_RUN = 0.65;
const STAIR_WIDTH = 4;
const STAIR_START_Z = -3; // first step begins just north of spawn
const HERO_PLATFORM_Y = STAIR_STEP_COUNT * STAIR_RISE;
const HERO_PLATFORM_DEPTH = 5;
const HERO_PLATFORM_WIDTH = 6.5;
const HERO_PLATFORM_Z = STAIR_START_Z - STAIR_STEP_COUNT * STAIR_RUN - HERO_PLATFORM_DEPTH / 2;
const HERO_SCALE = 1.55;

const HERO_REEL: ReelData = {
    id: 'hero-reel',
    label: 'Demo Reel',
    categoryId: 'hero',
    youtubeUrl: 'https://www.youtube.com/watch?v=t-uK94HaxeM',
    // platform top is at HERO_PLATFORM_Y, so the screen sits SCREEN_Y above that — same
    // offset used for every ground-level screen, just re-based to the platform's height
    position: [0, HERO_PLATFORM_Y + SCREEN_Y, HERO_PLATFORM_Z - HERO_PLATFORM_DEPTH / 2 + 0.6],
    // mounted on the platform's far (north) wall, facing back south toward the stairs —
    // rotation 0 means local +Z points to world +Z (south), which is correct here
    rotation: [0, 0, 0],
};

const ALL_SCREENS: ReelData[] = [...REELS, HERO_REEL];

type ScreenPhase = 'rest' | 'opening' | 'docked' | 'closing';
type ActiveReel = { id: string; phase: ScreenPhase } | null;

function getYouTubeId(url: string): string | null {
    try {
        const u = new URL(url);
        if (u.hostname.includes('youtu.be')) return u.pathname.slice(1) || null;
        return u.searchParams.get('v');
    } catch {
        return null;
    }
}

function easeInOutCubic(x: number) {
    return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
}

// cheap value noise for one-time (mount-time) geometry generation — not used per-frame,
// so plain JS is fine here, no need to push this to a shader
function hash2(x: number, y: number) {
    const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
    return s - Math.floor(s);
}
function valueNoise2(x: number, y: number) {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const xf = x - xi;
    const yf = y - yi;
    const a = hash2(xi, yi);
    const b = hash2(xi + 1, yi);
    const c = hash2(xi, yi + 1);
    const d = hash2(xi + 1, yi + 1);
    const u = xf * xf * (3 - 2 * xf);
    const v = yf * yf * (3 - 2 * yf);
    return a * (1 - u) * (1 - v) + b * u * (1 - v) + c * (1 - u) * v + d * u * v;
}

// Re-requesting pointer lock needs a fresh user gesture, and browsers impose a short
// cooldown after an Escape-triggered exit. Going through THREE's own controls.lock()
// logs a console.error internally when that request is rejected — calling the native
// API directly lets us swallow the rejection quietly instead. Worst case, the "click
// to enter" prompt reappears and one more click gets the player back in.
function requestPointerLockSafely() {
    const target = document.body;
    const result = target.requestPointerLock() as unknown;
    if (result && typeof (result as Promise<void>).catch === 'function') {
        (result as Promise<void>).catch(() => {
            // rejected — likely the post-Escape cooldown; no action needed, see comment above
        });
    }
}

function tracedRoundedRect(ctx: CanvasRenderingContext2D, w: number, h: number, r: number) {
    ctx.moveTo(r, 0);
    ctx.lineTo(w - r, 0);
    ctx.quadraticCurveTo(w, 0, w, r);
    ctx.lineTo(w, h - r);
    ctx.quadraticCurveTo(w, h, w - r, h);
    ctx.lineTo(r, h);
    ctx.quadraticCurveTo(0, h, 0, h - r);
    ctx.lineTo(0, r);
    ctx.quadraticCurveTo(0, 0, r, 0);
}

// a grid plane with vertices pushed forward in a smoothstep dome — a gentle,
// rounded "bulge" rather than a raw parabola
function useCRTBulgeGeometry(width: number, height: number, bulge: number, segments = 24) {
    return useMemo(() => {
        const geo = new THREE.PlaneGeometry(width, height, segments, segments);
        const pos = geo.attributes.position;
        for (let i = 0; i < pos.count; i++) {
            const x = pos.getX(i);
            const y = pos.getY(i);
            const nx = x / (width / 2);
            const ny = y / (height / 2);
            const d = Math.min(1, Math.sqrt(nx * nx + ny * ny));
            const s = 1 - d;
            const falloff = s * s * (3 - 2 * s); // smoothstep
            pos.setZ(i, bulge * falloff);
        }
        geo.computeVertexNormals();
        return geo;
    }, [width, height, bulge, segments]);
}

// canvas-generated rounded-rect alpha mask with a blurred (feathered) edge —
// no hard border, the shader noise just fades out
function useRoundedMask(width: number, height: number, radiusRatio: number, feather = 14) {
    return useMemo(() => {
        const res = 256;
        const w = res;
        const h = Math.round(res * (height / width));
        const pad = feather * 2;
        const canvas = document.createElement('canvas');
        canvas.width = w + pad * 2;
        canvas.height = h + pad * 2;
        const ctx = canvas.getContext('2d')!;
        const r = Math.min(w, h) * radiusRatio;
        ctx.save();
        ctx.translate(pad, pad);
        ctx.filter = `blur(${feather}px)`;
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        tracedRoundedRect(ctx, w, h, r);
        ctx.fill();
        ctx.restore();
        return new THREE.CanvasTexture(canvas);
    }, [width, height, radiusRatio, feather]);
}

// soft radial glow, used as the ethereal halo behind each screen
function useGlowTexture(size = 256) {
    return useMemo(() => {
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d')!;
        const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
        grad.addColorStop(0, 'rgba(255,255,255,0.9)');
        grad.addColorStop(0.5, 'rgba(255,255,255,0.35)');
        grad.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, size, size);
        return new THREE.CanvasTexture(canvas);
    }, [size]);
}

// screen face shader: procedural static + scanlines + a mild chromatic split — kept
// deliberately calmer than an earlier version (no random glitch-band jitter) while we
// lock in layout and mechanics
const CRTMaterial = shaderMaterial(
    { uTime: 0, uColor: new THREE.Color('#93a4bd'), uFocus: 0, uMask: null as unknown as THREE.Texture },
    `varying vec2 vUv;
   void main() {
     vUv = uv;
     gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
   }`,
    `varying vec2 vUv;
   uniform float uTime;
   uniform vec3 uColor;
   uniform float uFocus;
   uniform sampler2D uMask;

   float hash(vec2 p) {
     return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
   }

   void main() {
     vec2 uv = vUv;
     vec2 grid = floor(uv * vec2(64.0, 36.0));
     float t = floor(uTime * 12.0);
     float base = hash(grid + t);
     float rNoise = hash(grid + t + vec2(1.3, 0.0));
     float bNoise = hash(grid + t + vec2(0.0, 1.7));
     vec3 staticColor = vec3(rNoise, base, bNoise);

     float scan = 0.82 + 0.18 * sin(uv.y * 220.0 + uTime * 4.0);
     vec3 color = staticColor * scan * uColor * (1.0 + uFocus * 0.7);

     float mask = texture2D(uMask, clamp(uv, 0.0, 1.0)).r;
     gl_FragColor = vec4(color, mask);
   }`
);

function Player({ frozen }: { frozen: boolean }) {
    const { camera } = useThree();
    const { world } = useRapier();

    const rigidBodyRef = useRef<RapierRigidBody>(null);
    const colliderRef = useRef<any>(null);
    const characterController = useRef<any>(null);
    const keys = useRef<Record<string, boolean>>({});
    const verticalVelocity = useRef(0);

    useEffect(() => {
        const controller = world.createCharacterController(0.05);
        controller.enableAutostep(0.4, 0.2, true);
        controller.enableSnapToGround(0.3);
        characterController.current = controller;
        return () => world.removeCharacterController(controller);
    }, [world]);

    useEffect(() => {
        const down = (e: KeyboardEvent) => (keys.current[e.code] = true);
        const up = (e: KeyboardEvent) => (keys.current[e.code] = false);
        window.addEventListener('keydown', down);
        window.addEventListener('keyup', up);
        return () => {
            window.removeEventListener('keydown', down);
            window.removeEventListener('keyup', up);
        };
    }, []);

    useFrame((_, delta) => {
        if (frozen) return; // hold position while a screen is opening/docked/closing

        const body = rigidBodyRef.current;
        const collider = colliderRef.current;
        const controller = characterController.current;
        if (!body || !collider || !controller) return;

        const forward = new THREE.Vector3();
        camera.getWorldDirection(forward);
        forward.y = 0;
        forward.normalize();
        const right = new THREE.Vector3().crossVectors(forward, camera.up).normalize();

        const move = new THREE.Vector3();
        if (keys.current['KeyW']) move.add(forward);
        if (keys.current['KeyS']) move.sub(forward);
        if (keys.current['KeyD']) move.add(right);
        if (keys.current['KeyA']) move.sub(right);
        if (move.lengthSq() > 0) move.normalize().multiplyScalar(SPEED * delta);

        verticalVelocity.current = Math.max(verticalVelocity.current - GRAVITY * delta, -MAX_FALL_SPEED);
        move.y = verticalVelocity.current * delta;

        controller.computeColliderMovement(collider, move);
        const corrected = controller.computedMovement();
        if (controller.computedGrounded()) verticalVelocity.current = 0;

        const pos = body.translation();
        const next = { x: pos.x + corrected.x, y: pos.y + corrected.y, z: pos.z + corrected.z };

        // world border — clamp to a circle instead of letting the player wander
        // off into the fog indefinitely
        const dist = Math.hypot(next.x, next.z);
        if (dist > WORLD_BOUNDARY_RADIUS) {
            const scale = WORLD_BOUNDARY_RADIUS / dist;
            next.x *= scale;
            next.z *= scale;
        }

        body.setNextKinematicTranslation(next);
        camera.position.set(next.x, next.y + EYE_HEIGHT, next.z);
    });

    return (
        <RigidBody ref={rigidBodyRef} type="kinematicPosition" colliders={false} position={[0, 3, 0]}>
            <CapsuleCollider ref={colliderRef} args={[CAPSULE_HALF_HEIGHT, CAPSULE_RADIUS]} />
        </RigidBody>
    );
}

// gentle organic undulation + a soft tint toward whichever zone is nearest — purely
// visual. Height never dips below 0, so it can never read as a dip below the flat
// safety collider below; this is texture, not terrain the player can fall into.
function useOrganicFloorGeometry() {
    return useMemo(() => {
        const size = FLOOR_SIZE;
        const seg = 80;
        const geo = new THREE.PlaneGeometry(size, size, seg, seg);
        const pos = geo.attributes.position;
        const colors = new Float32Array(pos.count * 3);
        const base = new THREE.Color('#0d0f16');
        const tmp = new THREE.Color();
        for (let i = 0; i < pos.count; i++) {
            const x = pos.getX(i);
            const y = pos.getY(i); // becomes world Z once the mesh is rotated flat
            const n = valueNoise2(x * 0.06, y * 0.06);
            const h = Math.max(0, (n - 0.4) * 0.22);
            pos.setZ(i, h);

            let nearestColor = base;
            let nearestDist = Infinity;
            CATEGORY_LAYOUT.forEach((layout) => {
                const dx = x - layout.anchor.x;
                const dz = y - layout.anchor.z;
                const d = Math.sqrt(dx * dx + dz * dz);
                if (d < nearestDist) {
                    nearestDist = d;
                    nearestColor = tmp.set(layout.color);
                }
            });
            const blend = Math.max(0, 1 - nearestDist / 10) * 0.16;
            const mixed = base.clone().lerp(nearestColor, blend);
            colors[i * 3] = mixed.r;
            colors[i * 3 + 1] = mixed.g;
            colors[i * 3 + 2] = mixed.b;
        }
        geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        geo.computeVertexNormals();
        return geo;
    }, []);
}

function Level() {
    const half = FLOOR_SIZE / 2;
    const floorGeometry = useOrganicFloorGeometry();
    return (
        <RigidBody type="fixed" colliders={false}>
            {/* this flat collider is the one true safety net — everything else (islands,
          the hero platform) only ever adds height on top of it, never removes it,
          so there is no path to a gap the player could fall through */}
            <CuboidCollider args={[half, 0.05, half]} position={[0, -0.05, 0]} />
            <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow geometry={floorGeometry}>
                <meshStandardMaterial vertexColors roughness={0.95} />
            </mesh>
        </RigidBody>
    );
}

// raised organic "island" plateaus, one per zone — an irregular extruded polygon rather
// than a perfect rectangle, so each zone reads as its own landmass. Each gets its own
// collider, but it only ever sits ADDITIVELY on top of the full safety floor above —
// removing an island entirely would just mean one less bump, never a hole.
function createIslandShape(baseRadius: number, seed: number) {
    const shape = new THREE.Shape();
    const points = 14;
    for (let i = 0; i <= points; i++) {
        const a = (i / points) * Math.PI * 2;
        const n = valueNoise2(Math.cos(a) * 2 + seed, Math.sin(a) * 2 + seed);
        const r = baseRadius * (0.8 + n * 0.4);
        const x = Math.cos(a) * r;
        const y = Math.sin(a) * r;
        if (i === 0) shape.moveTo(x, y);
        else shape.lineTo(x, y);
    }
    return shape;
}

function IslandPad({ center, radius, color, seed }: { center: THREE.Vector3; radius: number; color: string; seed: number }) {
    const shape = useMemo(() => createIslandShape(radius, seed), [radius, seed]);
    const geometry = useMemo(
        () =>
            new THREE.ExtrudeGeometry(shape, {
                depth: 0.35,
                bevelEnabled: true,
                bevelThickness: 0.08,
                bevelSize: 0.12,
                bevelSegments: 2,
            }),
        [shape]
    );

    return (
        <RigidBody type="fixed" colliders="cuboid">
            <mesh geometry={geometry} rotation={[-Math.PI / 2, 0, 0]} position={[center.x, 0, center.z]} receiveShadow>
                <meshStandardMaterial color={color} roughness={0.55} metalness={0.25} />
            </mesh>
        </RigidBody>
    );
}

function CategoryIslands() {
    return (
        <>
            {Array.from(CATEGORY_LAYOUT.entries()).map(([id, layout], i) => (
                <IslandPad key={id} center={layout.anchor} radius={7.5} color={layout.color} seed={i * 13.7} />
            ))}
        </>
    );
}

function HeroStairs() {
    const steps = useMemo(
        () =>
            new Array(STAIR_STEP_COUNT).fill(0).map((_, i) => {
                const topY = (i + 1) * STAIR_RISE;
                const centerZ = STAIR_START_Z - i * STAIR_RUN - STAIR_RUN / 2;
                return { topY, centerZ };
            }),
        []
    );

    return (
        <>
            {steps.map((s, i) => (
                <RigidBody key={i} type="fixed" colliders="cuboid">
                    <mesh position={[0, s.topY / 2, s.centerZ]} receiveShadow>
                        <boxGeometry args={[STAIR_WIDTH, s.topY, STAIR_RUN]} />
                        <meshStandardMaterial color="#12141c" roughness={0.7} metalness={0.3} />
                    </mesh>
                </RigidBody>
            ))}
            <RigidBody type="fixed" colliders="cuboid">
                <mesh position={[0, HERO_PLATFORM_Y - 0.1, HERO_PLATFORM_Z]} receiveShadow>
                    <boxGeometry args={[HERO_PLATFORM_WIDTH, 0.2, HERO_PLATFORM_DEPTH]} />
                    <meshStandardMaterial color="#14161f" roughness={0.6} metalness={0.35} />
                </mesh>
            </RigidBody>
            <pointLight position={[0, HERO_PLATFORM_Y + 3, HERO_PLATFORM_Z]} color="#cfeaff" intensity={2} distance={16} decay={2} />
        </>
    );
}

// ---- signage + one tinted light marking each zone from a distance ----

function CategorySigns() {
    return (
        <>
            {Array.from(CATEGORY_LAYOUT.entries()).map(([id, layout]) => (
                <Text
                    key={id}
                    position={[layout.anchor.x, SCREEN_Y + 1.9, layout.anchor.z]}
                    rotation={[0, layout.facing, 0]}
                    fontSize={0.5}
                    color={layout.color}
                    anchorX="center"
                    anchorY="middle"
                    letterSpacing={0.08}
                >
                    {layout.label.toUpperCase()}
                </Text>
            ))}
        </>
    );
}

function CategoryLights() {
    return (
        <>
            {Array.from(CATEGORY_LAYOUT.entries()).map(([id, layout]) => (
                <pointLight
                    key={id}
                    position={[layout.anchor.x, SCREEN_Y + 2, layout.anchor.z]}
                    color={layout.color}
                    intensity={1.1}
                    distance={18}
                    decay={2}
                />
            ))}
        </>
    );
}

// ---- the screens themselves ----

function Screen({
                    reel,
                    focused,
                    phase,
                    scaleMultiplier = 1,
                    onArrived,
                    onClosed,
                }: {
    reel: ReelData;
    focused: boolean;
    phase: ScreenPhase;
    scaleMultiplier?: number;
    onArrived: () => void;
    onClosed: () => void;
}) {
    const { camera } = useThree();
    const groupRef = useRef<THREE.Group>(null);
    const faceRef = useRef<THREE.Mesh>(null);

    const tweenStart = useRef<{ pos: THREE.Vector3; quat: THREE.Quaternion; scale: number } | null>(null);
    const tweenStartTime = useRef<number | null>(null);
    const reported = useRef(false);
    const dockedPose = useRef<{ pos: THREE.Vector3; quat: THREE.Quaternion; scale: number } | null>(null);

    const restQuat = useMemo(
        () => new THREE.Quaternion().setFromEuler(new THREE.Euler(...(reel.rotation ?? [0, 0, 0]))),
        [reel.rotation]
    );

    // fresh tween bookkeeping every time the phase changes
    useEffect(() => {
        tweenStart.current = null;
        tweenStartTime.current = null;
        reported.current = false;
    }, [phase]);

    const faceGeometry = useCRTBulgeGeometry(FACE_WIDTH, FACE_HEIGHT, 0.09, 24);
    const roundMask = useRoundedMask(FACE_WIDTH, FACE_HEIGHT, 0.3);
    const glowTexture = useGlowTexture();

    const crtMaterial = useMemo(() => {
        const m = new CRTMaterial();
        m.transparent = true;
        m.depthWrite = false;
        m.toneMapped = false;
        // defensive: even with correct facing math, never let a screen go fully invisible
        // just because it's being viewed from the "wrong" side
        m.side = THREE.DoubleSide;
        return m;
    }, []);

    useEffect(() => {
        crtMaterial.uniforms.uMask.value = roundMask;
    }, [crtMaterial, roundMask]);

    useEffect(() => {
        if (faceRef.current) screenRegistry.set(reel.id, { mesh: faceRef.current });
        return () => {
            screenRegistry.delete(reel.id);
        };
    }, [reel.id]);

    useFrame(({ clock }) => {
        const t = clock.elapsedTime;

        crtMaterial.uniforms.uTime.value = t;
        crtMaterial.uniforms.uFocus.value = THREE.MathUtils.lerp(crtMaterial.uniforms.uFocus.value, focused ? 1 : 0, 0.1);
        (crtMaterial.uniforms.uColor.value as THREE.Color).set(focused ? '#cfeaff' : '#93a4bd');

        const group = groupRef.current;
        if (!group) return;
        const phaseSeed = reel.position[0];
        const s = scaleMultiplier;

        if (phase === 'rest') {
            group.position.set(reel.position[0], reel.position[1] + Math.sin(t * 0.45 + phaseSeed) * 0.12, reel.position[2]);
            group.quaternion.copy(restQuat);
            group.rotateZ(Math.sin(t * 0.3 + phaseSeed) * 0.015);
            group.rotateX(Math.sin(t * 0.22 + phaseSeed) * 0.01);
            group.scale.setScalar(s);
            return;
        }

        if (phase === 'opening') {
            if (!tweenStart.current) {
                tweenStart.current = { pos: group.position.clone(), quat: group.quaternion.clone(), scale: group.scale.x };
                tweenStartTime.current = t;
            }
            const elapsed = t - (tweenStartTime.current ?? t);
            const progress = Math.min(elapsed / TWEEN_DURATION, 1);
            const eased = easeInOutCubic(progress);

            const forward = new THREE.Vector3();
            camera.getWorldDirection(forward);
            const targetPos = camera.position.clone().add(forward.multiplyScalar(1.6));
            const dirToCamera = camera.position.clone().sub(targetPos).normalize();
            const targetQuat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), dirToCamera);

            group.position.lerpVectors(tweenStart.current.pos, targetPos, eased);
            group.quaternion.copy(tweenStart.current.quat).slerp(targetQuat, eased);
            group.scale.setScalar(THREE.MathUtils.lerp(tweenStart.current.scale, 1.6 * s, eased));

            if (progress >= 1 && !reported.current) {
                reported.current = true;
                dockedPose.current = { pos: group.position.clone(), quat: group.quaternion.clone(), scale: group.scale.x };
                onArrived();
            }
            return;
        }

        if (phase === 'docked') {
            if (dockedPose.current) {
                group.position.copy(dockedPose.current.pos);
                group.quaternion.copy(dockedPose.current.quat);
                group.scale.setScalar(dockedPose.current.scale);
            }
            return;
        }

        if (phase === 'closing') {
            if (!tweenStart.current) {
                tweenStart.current = dockedPose.current ?? {
                    pos: group.position.clone(),
                    quat: group.quaternion.clone(),
                    scale: group.scale.x,
                };
                tweenStartTime.current = t;
            }
            const elapsed = t - (tweenStartTime.current ?? t);
            const progress = Math.min(elapsed / TWEEN_DURATION, 1);
            const eased = easeInOutCubic(progress);
            const restPos = new THREE.Vector3(...reel.position);

            group.position.lerpVectors(tweenStart.current.pos, restPos, eased);
            group.quaternion.copy(tweenStart.current.quat).slerp(restQuat, eased);
            group.scale.setScalar(THREE.MathUtils.lerp(tweenStart.current.scale, s, eased));

            if (progress >= 1 && !reported.current) {
                reported.current = true;
                onClosed();
            }
        }
    });

    const glowColor = focused ? '#a9e3ff' : '#3d5a80';

    return (
        <group ref={groupRef} position={reel.position} rotation={reel.rotation ?? [0, 0, 0]}>
            {/* soft gallery spotlight cast from the piece itself */}
            <pointLight color={glowColor} intensity={focused ? 2.6 : 1.2} distance={7.5} decay={2} position={[0, 0, 0.7]} />

            {/* feathered ethereal halo — no hard edge, additive so it never occludes */}
            <mesh position={[0, 0, -0.12]}>
                <planeGeometry args={[OUTER_WIDTH, OUTER_HEIGHT]} />
                <meshBasicMaterial
                    map={glowTexture}
                    color={glowColor}
                    transparent
                    opacity={focused ? 0.55 : 0.28}
                    blending={THREE.AdditiveBlending}
                    depthWrite={false}
                    side={THREE.DoubleSide}
                />
            </mesh>

            {/* bulging, rounded, feathered, shader-driven CRT face — no bezel */}
            <mesh ref={faceRef} geometry={faceGeometry} userData={{ screenId: reel.id }}>
                <primitive object={crtMaterial} attach="material" />
            </mesh>
        </group>
    );
}

function Screens({
                     focusedId,
                     active,
                     onArrived,
                     onClosed,
                 }: {
    focusedId: string | null;
    active: ActiveReel;
    onArrived: () => void;
    onClosed: () => void;
}) {
    return (
        <>
            {ALL_SCREENS.map((reel) => (
                <Screen
                    key={reel.id}
                    reel={reel}
                    focused={focusedId === reel.id}
                    phase={active && active.id === reel.id ? active.phase : 'rest'}
                    scaleMultiplier={reel.id === 'hero-reel' ? HERO_SCALE : 1}
                    onArrived={onArrived}
                    onClosed={onClosed}
                />
            ))}
        </>
    );
}

function Interaction({
                         onFocusChange,
                         onStartOpen,
                         disabled,
                     }: {
    onFocusChange: (id: string | null) => void;
    onStartOpen: (id: string) => void;
    disabled: boolean;
}) {
    const { camera } = useThree();
    const raycaster = useMemo(() => new THREE.Raycaster(), []);
    const currentFocus = useRef<string | null>(null);

    useEffect(() => {
        const onClick = () => {
            if (disabled) return;
            if (!document.pointerLockElement) return; // ignore the initial "click to enter"
            if (currentFocus.current) onStartOpen(currentFocus.current);
        };
        window.addEventListener('click', onClick);
        return () => window.removeEventListener('click', onClick);
    }, [disabled, onStartOpen]);

    useFrame(() => {
        if (disabled) {
            if (currentFocus.current !== null) {
                currentFocus.current = null;
                onFocusChange(null);
            }
            return;
        }
        raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
        const meshes = Array.from(screenRegistry.values()).map((e) => e.mesh);
        const hits = raycaster.intersectObjects(meshes, false);
        const hit = hits.find((h) => h.distance <= INTERACT_RANGE);
        const id = hit ? (hit.object.userData.screenId as string) : null;

        if (id !== currentFocus.current) {
            currentFocus.current = id;
            onFocusChange(id);
        }
    });

    return null;
}

const TUNNEL_RING_COLORS = ['#5b7bff', '#8fd6ff', '#c58fff', '#33d1c9', '#ff5ba0'];

function TunnelIntro() {
    const rings = new Array(16).fill(0);
    return (
        <div
            style={{
                position: 'absolute',
                inset: 0,
                zIndex: 40,
                overflow: 'hidden',
                background: 'radial-gradient(circle at center, #161d3a 0%, #05060a 72%)',
                pointerEvents: 'none',
            }}
        >
            <style>{`
        @keyframes tunnelRing {
          0% { transform: scale(0.05); opacity: 0; }
          8% { opacity: 0.9; }
          100% { transform: scale(9); opacity: 0; }
        }
        @keyframes tunnelSpin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
            <div style={{ position: 'absolute', inset: 0, animation: 'tunnelSpin 6s linear infinite' }}>
                {rings.map((_, i) => (
                    <div
                        key={i}
                        style={{
                            position: 'absolute',
                            top: '50%',
                            left: '50%',
                            width: 50,
                            height: 50,
                            marginLeft: -25,
                            marginTop: -25,
                            borderRadius: '50%',
                            border: `2px solid ${TUNNEL_RING_COLORS[i % TUNNEL_RING_COLORS.length]}`,
                            boxShadow: `0 0 14px ${TUNNEL_RING_COLORS[i % TUNNEL_RING_COLORS.length]}`,
                            animation: 'tunnelRing 1.1s cubic-bezier(0.4, 0, 0.6, 1) infinite',
                            animationDelay: `${i * 0.09}s`,
                        }}
                    />
                ))}
            </div>
        </div>
    );
}

export default function Home() {
    const [locked, setLocked] = useState(false);
    const [focusedId, setFocusedId] = useState<string | null>(null);
    const [active, setActive] = useState<ActiveReel>(null);
    const [tunnelDone, setTunnelDone] = useState(false);
    const controlsRef = useRef<any>(null);

    useEffect(() => {
        const timer = setTimeout(() => setTunnelDone(true), 2100);
        return () => clearTimeout(timer);
    }, []);

    const focusedLabel = ALL_SCREENS.find((r) => r.id === focusedId)?.label ?? null;
    const activeReelData = active ? ALL_SCREENS.find((r) => r.id === active.id) ?? null : null;
    const activeVideoId = activeReelData ? getYouTubeId(activeReelData.youtubeUrl) : null;

    const startOpen = (id: string) => {
        if (active) return;
        setActive({ id, phase: 'opening' });
    };

    // pointer lock only needs to be *exited* here, which browsers allow at any time —
    // no user gesture required for that direction
    const handleArrived = () => {
        setActive((prev) => (prev ? { ...prev, phase: 'docked' } : prev));
        try {
            controlsRef.current?.unlock();
        } catch {}
    };

    // re-entering pointer lock DOES require a direct, synchronous user gesture, so this
    // must be called straight from the click/keydown handler — never from a tween callback
    const closeReel = () => {
        setActive((prev) => (prev && prev.phase === 'docked' ? { ...prev, phase: 'closing' } : prev));
        requestPointerLockSafely();
    };

    const handleClosed = () => {
        setActive(null);
    };

    useEffect(() => {
        if (active?.phase !== 'docked') return;
        const onKey = (e: KeyboardEvent) => {
            if (e.code === 'Escape') closeReel();
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [active]);

    const hideHud = active !== null;
    const showOverlay = active?.phase === 'docked';

    return (
        <div style={{ width: '100vw', height: '100vh', background: '#000', overflow: 'hidden' }}>
            <div
                style={{
                    position: 'absolute',
                    inset: 0,
                    zIndex: 10,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 18,
                    background: '#05060a',
                    pointerEvents: 'none',
                    opacity: locked || hideHud || !tunnelDone ? 0 : 1,
                    transition: 'opacity 0.5s ease',
                }}
            >
                <div style={{ fontFamily: 'monospace', fontSize: 15, letterSpacing: '0.35em', color: '#6f83ff' }}>
                    JOSHUA WHATMAN
                </div>
                <div
                    style={{
                        fontFamily: 'monospace',
                        fontSize: 34,
                        fontWeight: 700,
                        letterSpacing: '0.12em',
                        color: '#eaf4ff',
                        textShadow: '0 0 18px #5b7bff, 0 0 40px #5b7bff',
                    }}
                >
                    CLICK TO ENTER
                </div>
                <div style={{ fontFamily: 'monospace', fontSize: 13, letterSpacing: '0.08em', color: '#8a97b8' }}>
                    WASD to move · mouse to look · ESC to exit
                </div>
            </div>

            {!tunnelDone && <TunnelIntro />}

            {!hideHud && (
                <div
                    style={{
                        position: 'absolute',
                        top: '50%',
                        left: '50%',
                        width: 4,
                        height: 4,
                        marginLeft: -2,
                        marginTop: -2,
                        borderRadius: 4,
                        background: focusedId ? '#a9e3ff' : 'rgba(255,255,255,0.6)',
                        zIndex: 5,
                        pointerEvents: 'none',
                    }}
                />
            )}

            {!hideHud && focusedLabel && (
                <div
                    style={{
                        position: 'absolute',
                        top: '58%',
                        left: '50%',
                        transform: 'translateX(-50%)',
                        color: '#eee',
                        fontFamily: 'monospace',
                        fontSize: 13,
                        letterSpacing: '0.05em',
                        background: 'rgba(0,0,0,0.5)',
                        padding: '4px 10px',
                        borderRadius: 4,
                        zIndex: 5,
                        pointerEvents: 'none',
                    }}
                >
                    click to watch {focusedLabel}
                </div>
            )}

            <Canvas shadows camera={{ fov: 75, position: [0, 1.6, 5] }}>
                <color attach="background" args={['#07080d']} />
                <fog attach="fog" args={['#07080d', 5, 38]} />
                <ambientLight intensity={0.13} />
                <pointLight position={[0, 8, 2]} intensity={1.8} color="#4a5fff" distance={25} />

                <CategoryLights />
                <CategorySigns />

                <Physics gravity={[0, 0, 0]}>
                    <Level />
                    <CategoryIslands />
                    <HeroStairs />
                    <Player frozen={hideHud} />
                </Physics>

                <Screens focusedId={focusedId} active={active} onArrived={handleArrived} onClosed={handleClosed} />
                <Interaction onFocusChange={setFocusedId} onStartOpen={startOpen} disabled={hideHud} />

                <PointerLockControls ref={controlsRef} onLock={() => setLocked(true)} onUnlock={() => setLocked(false)} />
            </Canvas>

            {showOverlay && activeVideoId && (
                <div
                    style={{
                        position: 'absolute',
                        inset: 0,
                        zIndex: 20,
                        background: 'rgba(0,0,0,0.85)',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 16,
                    }}
                >
                    <div style={{ width: 'min(80vw, 1000px)', aspectRatio: '16 / 9' }}>
                        <iframe
                            key={activeVideoId}
                            src={`https://www.youtube.com/embed/${activeVideoId}?autoplay=1`}
                            title={activeReelData?.label ?? 'reel'}
                            allow="autoplay; encrypted-media; picture-in-picture"
                            allowFullScreen
                            style={{ width: '100%', height: '100%', border: 'none', borderRadius: 8 }}
                        />
                    </div>
                    <button
                        onClick={closeReel}
                        style={{
                            fontFamily: 'monospace',
                            fontSize: 13,
                            letterSpacing: '0.05em',
                            color: '#ddd',
                            background: 'rgba(255,255,255,0.08)',
                            border: '1px solid rgba(255,255,255,0.2)',
                            borderRadius: 4,
                            padding: '8px 16px',
                            cursor: 'pointer',
                        }}
                    >
                        back to gallery (esc)
                    </button>
                </div>
            )}
        </div>
    );
}