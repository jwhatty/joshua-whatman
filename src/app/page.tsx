'use client';

import {useEffect, useMemo, useRef, useState} from 'react';
import {Canvas, useFrame, useThree} from '@react-three/fiber';
import {PointerLockControls} from '@react-three/drei';
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
const SPEED = 5; // m/s
const CAPSULE_HALF_HEIGHT = 0.6;
const CAPSULE_RADIUS = 0.4;
const EYE_HEIGHT = 1.6;
const GRAVITY = 9.81;
const MAX_FALL_SPEED = 20;
const SCREEN_Y = EYE_HEIGHT + 0.15; // screens sit just above eye height

// ---- interaction tuning ----
const INTERACT_RANGE = 6;
const ZOOM_DURATION = 0.65; // seconds, screen-to-camera tween before playback

// ---- screen sizing ----
const FACE_WIDTH = 3.6;
const FACE_HEIGHT = 2.05;
const BEZEL_WIDTH = 4.05;
const BEZEL_HEIGHT = 2.45;
const OUTER_WIDTH = 4.5;
const OUTER_HEIGHT = 2.85;

// module-level registry so raycasting can reach every screen's mesh
// without prop-drilling refs. Swap for context/zustand if this grows.
const screenRegistry = new Map<string, { mesh: THREE.Object3D }>();

type ReelData = {
    id: string;
    label: string;
    position: [number, number, number];
    rotation?: [number, number, number];
    youtubeUrl: string;
};

const REELS: ReelData[] = [
    {
        id: 'reel-1',
        label: 'Featured Reel',
        position: [-5, SCREEN_Y, -6.5],
        rotation: [0, 0.3, 0],
        youtubeUrl: 'https://www.youtube.com/watch?v=t-uK94HaxeM',
    },
    {
        id: 'reel-2',
        label: 'Mix Reel',
        position: [5, SCREEN_Y, -6.5],
        rotation: [0, -0.3, 0],
        youtubeUrl: 'https://www.youtube.com/watch?v=t-uK94HaxeM', // swap for the next reel
    },
];

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

// a flat rounded-rectangle shape, centered on origin, lying in the XY plane
function roundedRectShape(width: number, height: number, radius: number) {
    const shape = new THREE.Shape();
    const w = width / 2;
    const h = height / 2;
    const r = Math.min(radius, w, h);
    shape.moveTo(-w + r, -h);
    shape.lineTo(w - r, -h);
    shape.quadraticCurveTo(w, -h, w, -h + r);
    shape.lineTo(w, h - r);
    shape.quadraticCurveTo(w, h, w - r, h);
    shape.lineTo(-w + r, h);
    shape.quadraticCurveTo(-w, h, -w, h - r);
    shape.lineTo(-w, -h + r);
    shape.quadraticCurveTo(-w, -h, -w + r, -h);
    return shape;
}

// a grid plane with vertices pushed forward in a dome falloff — the CRT "bulge"
function useCRTBulgeGeometry(width: number, height: number, bulge: number, segments = 22) {
    return useMemo(() => {
        const geo = new THREE.PlaneGeometry(width, height, segments, segments);
        const pos = geo.attributes.position;
        for (let i = 0; i < pos.count; i++) {
            const x = pos.getX(i);
            const y = pos.getY(i);
            const nx = x / (width / 2);
            const ny = y / (height / 2);
            const d2 = nx * nx + ny * ny;
            const falloff = Math.max(0, 1 - d2);
            pos.setZ(i, bulge * falloff);
        }
        geo.computeVertexNormals();
        return geo;
    }, [width, height, bulge, segments]);
}

// canvas-generated rounded-rect alpha mask, so a rectangular grid mesh reads as rounded
function useRoundedMask(width: number, height: number, radiusRatio: number) {
    return useMemo(() => {
        const res = 256;
        const canvas = document.createElement('canvas');
        canvas.width = res;
        canvas.height = Math.round(res * (height / width));
        const ctx = canvas.getContext('2d')!;
        const w = canvas.width;
        const h = canvas.height;
        const r = Math.min(w, h) * radiusRatio;
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.moveTo(r, 0);
        ctx.lineTo(w - r, 0);
        ctx.quadraticCurveTo(w, 0, w, r);
        ctx.lineTo(w, h - r);
        ctx.quadraticCurveTo(w, h, w - r, h);
        ctx.lineTo(r, h);
        ctx.quadraticCurveTo(0, h, 0, h - r);
        ctx.lineTo(0, r);
        ctx.quadraticCurveTo(0, 0, r, 0);
        ctx.closePath();
        ctx.fill();
        return new THREE.CanvasTexture(canvas);
    }, [width, height, radiusRatio]);
}

// animated grayscale TV static, regenerated a few times a second for a chunky retro flicker
function useStaticTexture(size = 48) {
    const textureRef = useRef<THREE.CanvasTexture | null>(null);
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const frame = useRef(0);

    if (!textureRef.current) {
        const c = document.createElement('canvas');
        c.width = size;
        c.height = size;
        canvasRef.current = c;
        const tex = new THREE.CanvasTexture(c);
        tex.magFilter = THREE.NearestFilter;
        tex.minFilter = THREE.NearestFilter;
        textureRef.current = tex;
    }

    useFrame(() => {
        frame.current += 1;
        if (frame.current % 3 !== 0) return; // throttle for a chunkier flicker, not smooth noise
        const canvas = canvasRef.current!;
        const ctx = canvas.getContext('2d')!;
        const img = ctx.createImageData(size, size);
        for (let i = 0; i < img.data.length; i += 4) {
            const v = Math.random() * 255;
            img.data[i] = v;
            img.data[i + 1] = v;
            img.data[i + 2] = v;
            img.data[i + 3] = 255;
        }
        ctx.putImageData(img, 0, 0);
        textureRef.current!.needsUpdate = true;
    });

    return textureRef.current;
}

function Player({frozen}: { frozen: boolean }) {
    const {camera} = useThree();
    const {world} = useRapier();

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
        if (frozen) return; // hold position while a screen is zooming in / playing

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
        const next = {x: pos.x + corrected.x, y: pos.y + corrected.y, z: pos.z + corrected.z};
        body.setNextKinematicTranslation(next);
        camera.position.set(next.x, next.y + EYE_HEIGHT, next.z);
    });

    return (
        <RigidBody ref={rigidBodyRef} type="kinematicPosition" colliders={false} position={[0, 3, 0]}>
            <CapsuleCollider ref={colliderRef} args={[CAPSULE_HALF_HEIGHT, CAPSULE_RADIUS]}/>
        </RigidBody>
    );
}

function Level() {
    return (
        <RigidBody type="fixed" colliders={false}>
            <CuboidCollider args={[30, 0.05, 30]} position={[0, -0.05, 0]}/>
            <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
                <planeGeometry args={[60, 60]}/>
                <meshStandardMaterial color="#08090c" roughness={0.95}/>
            </mesh>
        </RigidBody>
    );
}

function Screen({
                    reel,
                    focused,
                    opening,
                    onZoomComplete,
                }: {
    reel: ReelData;
    focused: boolean;
    opening: boolean;
    onZoomComplete: () => void;
}) {
    const {camera} = useThree();
    const groupRef = useRef<THREE.Group>(null);
    const faceRef = useRef<THREE.Mesh>(null);

    const zoomStart = useRef<{ pos: THREE.Vector3; quat: THREE.Quaternion } | null>(null);
    const zoomStartTime = useRef<number | null>(null);
    const zoomReported = useRef(false);

    useEffect(() => {
        if (!opening) {
            zoomStart.current = null;
            zoomStartTime.current = null;
            zoomReported.current = false;
        }
    }, [opening]);

    const restQuat = useMemo(
        () => new THREE.Quaternion().setFromEuler(new THREE.Euler(...(reel.rotation ?? [0, 0, 0]))),
        [reel.rotation]
    );

    const faceGeometry = useCRTBulgeGeometry(FACE_WIDTH, FACE_HEIGHT, 0.18, 22);
    const roundMask = useRoundedMask(FACE_WIDTH, FACE_HEIGHT, 0.22);
    const staticTexture = useStaticTexture();

    const outerShape = useMemo(() => roundedRectShape(OUTER_WIDTH, OUTER_HEIGHT, 0.55), []);
    const bezelShape = useMemo(() => roundedRectShape(BEZEL_WIDTH, BEZEL_HEIGHT, 0.48), []);

    useEffect(() => {
        if (faceRef.current) screenRegistry.set(reel.id, {mesh: faceRef.current});
        return () => {
            screenRegistry.delete(reel.id);
        };
    }, [reel.id]);

    useFrame(({clock}) => {
        const group = groupRef.current;
        if (!group) return;
        const t = clock.elapsedTime;
        const phase = reel.position[0];

        if (opening) {
            if (!zoomStart.current) {
                zoomStart.current = {pos: group.position.clone(), quat: group.quaternion.clone()};
                zoomStartTime.current = t;
            }
            const elapsed = t - (zoomStartTime.current ?? t);
            const progress = Math.min(elapsed / ZOOM_DURATION, 1);
            const eased = easeInOutCubic(progress);

            const forward = new THREE.Vector3();
            camera.getWorldDirection(forward);
            const targetPos = camera.position.clone().add(forward.multiplyScalar(1.6));
            const dirToCamera = camera.position.clone().sub(targetPos).normalize();
            const targetQuat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), dirToCamera);

            group.position.lerpVectors(zoomStart.current.pos, targetPos, eased);
            group.quaternion.copy(zoomStart.current.quat).slerp(targetQuat, eased);
            group.scale.setScalar(1 + eased * 0.6);

            if (progress >= 1 && !zoomReported.current) {
                zoomReported.current = true;
                onZoomComplete();
            }
        } else {
            group.position.set(reel.position[0], reel.position[1] + Math.sin(t * 0.45 + phase) * 0.12, reel.position[2]);
            group.quaternion.copy(restQuat);
            group.rotateZ(Math.sin(t * 0.3 + phase) * 0.015);
            group.rotateX(Math.sin(t * 0.22 + phase) * 0.01);
            group.scale.setScalar(1);
        }
    });

    const glowColor = focused ? '#a9e3ff' : '#3d5a80';

    return (
        <group ref={groupRef} position={reel.position} rotation={reel.rotation ?? [0, 0, 0]}>
            {/* soft gallery spotlight cast from the piece itself */}
            <pointLight color={glowColor} intensity={focused ? 2.4 : 1} distance={7.5} decay={2}
                        position={[0, 0, 0.7]}/>

            {/* outer ethereal glow — additive, no depth write so it never occludes */}
            <mesh position={[0, 0, -0.08]}>
                <shapeGeometry args={[outerShape]}/>
                <meshBasicMaterial
                    color={glowColor}
                    transparent
                    opacity={focused ? 0.42 : 0.18}
                    blending={THREE.AdditiveBlending}
                    depthWrite={false}
                />
            </mesh>

            {/* dark glassy bezel — the CRT housing */}
            <mesh position={[0, 0, -0.04]}>
                <shapeGeometry args={[bezelShape]}/>
                <meshStandardMaterial color="#0c0e13" roughness={0.25} metalness={0.7}/>
            </mesh>

            {/* bulging, rounded, static-filled screen face */}
            <mesh ref={faceRef} geometry={faceGeometry} userData={{screenId: reel.id}}>
                <meshBasicMaterial
                    map={staticTexture ?? undefined}
                    alphaMap={roundMask}
                    transparent
                    color={focused ? '#cfeaff' : '#7f92ab'}
                    toneMapped={false}
                />
            </mesh>
        </group>
    );
}

function Screens({focusedId, openingId, onZoomComplete}: {
    focusedId: string | null;
    openingId: string | null;
    onZoomComplete: (id: string) => void
}) {
    return (
        <>
            {REELS.map((reel) => (
                <Screen
                    key={reel.id}
                    reel={reel}
                    focused={focusedId === reel.id}
                    opening={openingId === reel.id}
                    onZoomComplete={() => onZoomComplete(reel.id)}
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
    const {camera} = useThree();
    const raycaster = useMemo(() => new THREE.Raycaster(), []);
    const currentFocus = useRef<string | null>(null);

    useEffect(() => {
        const onKeyDown = (e: KeyboardEvent) => {
            if (disabled || e.code !== 'KeyE') return;
            if (currentFocus.current) onStartOpen(currentFocus.current);
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
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

export default function Home() {
    const [locked, setLocked] = useState(false);
    const [focusedId, setFocusedId] = useState<string | null>(null);
    const [openingId, setOpeningId] = useState<string | null>(null);
    const [viewingId, setViewingId] = useState<string | null>(null);
    const controlsRef = useRef<any>(null);

    const focusedLabel = REELS.find((r) => r.id === focusedId)?.label ?? null;
    const viewingReel = REELS.find((r) => r.id === viewingId) ?? null;
    const viewingVideoId = viewingReel ? getYouTubeId(viewingReel.youtubeUrl) : null;

    const startOpen = (id: string) => {
        if (openingId || viewingId) return;
        setOpeningId(id);
    };

    const handleZoomComplete = (id: string) => {
        setViewingId(id);
        setOpeningId(null);
        controlsRef.current?.unlock();
    };

    const closeReel = () => {
        setViewingId(null);
        setOpeningId(null);
        controlsRef.current?.lock();
    };

    useEffect(() => {
        if (!viewingId) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.code === 'Escape') closeReel();
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [viewingId]);

    const hideHud = !!viewingId || !!openingId;

    return (
        <div style={{width: '100vw', height: '100vh', background: '#000', overflow: 'hidden'}}>
            <div
                style={{
                    position: 'absolute',
                    inset: 0,
                    zIndex: 10,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#ddd',
                    fontFamily: 'monospace',
                    letterSpacing: '0.1em',
                    textTransform: 'uppercase',
                    fontSize: 14,
                    background: 'rgba(0,0,0,0.55)',
                    pointerEvents: 'none',
                    opacity: locked || hideHud ? 0 : 1,
                    transition: 'opacity 0.3s ease',
                }}
            >
                click to enter — wasd to move, mouse to look, esc to exit
            </div>

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
                    [E] watch {focusedLabel}
                </div>
            )}

            <Canvas shadows camera={{fov: 75, position: [0, 1.6, 5]}}>
                <fog attach="fog" args={['#050508', 4, 35]}/>
                <ambientLight intensity={0.05}/>
                <pointLight position={[0, 8, 2]} intensity={1.5} color="#4a5fff" distance={25}/>

                <Physics gravity={[0, 0, 0]}>
                    <Level/>
                    <Player frozen={hideHud}/>
                </Physics>

                <Screens focusedId={focusedId} openingId={openingId} onZoomComplete={handleZoomComplete}/>
                <Interaction onFocusChange={setFocusedId} onStartOpen={startOpen} disabled={hideHud}/>

                <PointerLockControls ref={controlsRef} onLock={() => setLocked(true)}
                                     onUnlock={() => setLocked(false)}/>
            </Canvas>

            {viewingId && viewingVideoId && (
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
                    <div style={{width: 'min(80vw, 1000px)', aspectRatio: '16 / 9'}}>
                        <iframe
                            key={viewingVideoId}
                            src={`https://www.youtube.com/embed/${viewingVideoId}?autoplay=1`}
                            title={viewingReel?.label ?? 'reel'}
                            allow="autoplay; encrypted-media; picture-in-picture"
                            allowFullScreen
                            style={{width: '100%', height: '100%', border: 'none', borderRadius: 8}}
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