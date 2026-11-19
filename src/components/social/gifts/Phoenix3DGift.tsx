'use client';

import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone as cloneSkeleton } from 'three/examples/jsm/utils/SkeletonUtils.js';

export interface Phoenix3DGiftProps {
  senderName?: string;
  senderAvatar?: string;
  combo?: number;
  muted?: boolean;
  onComplete?: () => void;
}

const TOTAL_DURATION = 8.2; // 8.2s continuous 4-scene shot

// Bone names inside /gifts/phoenix_bird.glb (98-node FengHuang skeletal rig)
const PHOENIX_BONES = Object.freeze({
  spine: 'B_Spine_02',
  head: 'b_Head_06',
  jaw: 'B_Jaw_07',
  leftFoot: 'b_Left_Foot_037',
  rightFoot: 'b_Right_Foot_039',
  tailBase: 'B_Tail_1_030',
  tailMid: 'B_Tail_3_032',
  tailTip: 'B_Tail_5_034',
  leftWingMid: 'B_Left_Wing_4_077',
  leftWingTip: 'B_Left_Wing_8_075',
  rightWingMid: 'B_Right_Wing_4_082',
  rightWingTip: 'B_Right_Wing_8_087',
});

interface CanonicalPhoenixRig {
  source: THREE.Group;
  clip: THREE.AnimationClip | null;
}

// Module-level cache so subsequent gift plays start in 0ms without re-fetching the 1.6MB GLB
let cachedPhoenixRigPromise: Promise<CanonicalPhoenixRig> | null = null;

function buildCanonicalPhoenixRig(gltf: GLTF, targetWingspan = 4.2): CanonicalPhoenixRig {
  const scene = gltf.scene;
  const clip = gltf.animations?.[0] ?? null;

  scene.updateMatrixWorld(true);

  const skinnedMeshes: THREE.SkinnedMesh[] = [];
  scene.traverse((node) => {
    if ((node as THREE.SkinnedMesh).isSkinnedMesh) {
      skinnedMeshes.push(node as THREE.SkinnedMesh);
    }
  });

  const box = new THREE.Box3();
  const meshBox = new THREE.Box3();
  for (const mesh of skinnedMeshes) {
    mesh.computeBoundingBox();
    if (mesh.boundingBox) {
      meshBox.copy(mesh.boundingBox).applyMatrix4(mesh.matrixWorld);
      box.union(meshBox);
    }
  }
  if (box.isEmpty()) {
    box.setFromObject(scene);
  }

  const spinePos = new THREE.Vector3();
  const headPos = new THREE.Vector3();
  const spineNode = scene.getObjectByName(PHOENIX_BONES.spine);
  const headNode = scene.getObjectByName(PHOENIX_BONES.head);

  if (spineNode) spineNode.getWorldPosition(spinePos);
  else box.getCenter(spinePos);

  if (headNode) headNode.getWorldPosition(headPos);
  else headPos.copy(spinePos).add(new THREE.Vector3(1, 0, 0));

  const fx = headPos.x - spinePos.x;
  const fz = headPos.z - spinePos.z;
  // Rotate so the beak points straight down local +Z
  const yaw = Math.atan2(-fx, fz);

  const cosY = Math.cos(yaw);
  const sinY = Math.sin(yaw);
  let minX = Infinity;
  let maxX = -Infinity;
  for (let i = 0; i < 8; i++) {
    const x = i & 1 ? box.max.x : box.min.x;
    const z = i & 2 ? box.max.z : box.min.z;
    const rx = x * cosY + z * sinY;
    minX = Math.min(minX, rx);
    maxX = Math.max(maxX, rx);
  }
  const measuredSpan = Math.max(1e-3, maxX - minX);
  const scale = targetWingspan / measuredSpan;

  const pivot = new THREE.Group();
  pivot.name = 'PhoenixPivot';
  pivot.position.set(-spinePos.x, -spinePos.y, -spinePos.z);
  pivot.add(scene);

  const source = new THREE.Group();
  source.name = 'PhoenixCanonicalRoot';
  source.scale.setScalar(scale);
  source.rotation.y = yaw;
  source.add(pivot);
  source.updateMatrixWorld(true);

  for (const mesh of skinnedMeshes) {
    mesh.frustumCulled = false;
  }

  return { source, clip };
}

function loadPhoenixRig(): Promise<CanonicalPhoenixRig> {
  if (!cachedPhoenixRigPromise) {
    const loader = new GLTFLoader();
    cachedPhoenixRigPromise = new Promise<CanonicalPhoenixRig>((resolve, reject) => {
      loader.load(
        '/gifts/phoenix_bird.glb',
        (gltf) => {
          resolve(buildCanonicalPhoenixRig(gltf, 4.2));
        },
        undefined,
        (err) => {
          cachedPhoenixRigPromise = null;
          reject(err);
        }
      );
    });
  }
  return cachedPhoenixRigPromise;
}

// Create a soft radial glow texture for fire particles, embers, and eye halos
function createRadialFireTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0.0, 'rgba(255, 255, 240, 1.0)');
  grad.addColorStop(0.22, 'rgba(255, 220, 90, 0.92)');
  grad.addColorStop(0.55, 'rgba(255, 105, 15, 0.55)');
  grad.addColorStop(0.82, 'rgba(210, 25, 5, 0.18)');
  grad.addColorStop(1.0, 'rgba(0, 0, 0, 0.0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}

// ============================================================================
// SYNCHRONIZED 4-SCENE HOLLYWOOD CINEMA SOUND ENGINE (WEB AUDIO API)
// ============================================================================
function startPhoenixCinemaAudio(muted?: boolean): () => void {
  if (muted || typeof window === 'undefined') return () => {};
  const AudioCtx =
    window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioCtx) return () => {};

  let ctx: AudioContext | null = null;
  const timeouts: number[] = [];

  try {
    ctx = new AudioCtx();
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
    const master = ctx.createGain();
    master.gain.setValueAtTime(0.82, ctx.currentTime);
    master.connect(ctx.destination);

    const playTone = (
      freq: number,
      endFreq: number,
      startOffset: number,
      dur: number,
      type: OscillatorType,
      vol: number
    ) => {
      if (!ctx) return;
      const t0 = ctx.currentTime + startOffset;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(Math.max(20, freq), t0);
      if (endFreq !== freq) {
        osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), t0 + dur);
      }
      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.linearRampToValueAtTime(vol, t0 + Math.min(0.06, dur * 0.25));
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      osc.connect(gain);
      gain.connect(master);
      osc.start(t0);
      osc.stop(t0 + dur + 0.04);
    };

    const playNoise = (
      startOffset: number,
      dur: number,
      filterFreq: number,
      endFilterFreq: number,
      q: number,
      vol: number,
      filterType: BiquadFilterType = 'bandpass'
    ) => {
      if (!ctx) return;
      const t0 = ctx.currentTime + startOffset;
      const len = Math.floor(ctx.sampleRate * dur);
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) {
        data[i] = Math.random() * 2 - 1;
      }
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const filter = ctx.createBiquadFilter();
      filter.type = filterType;
      filter.frequency.setValueAtTime(filterFreq, t0);
      if (endFilterFreq !== filterFreq) {
        filter.frequency.exponentialRampToValueAtTime(Math.max(40, endFilterFreq), t0 + dur);
      }
      filter.Q.value = q;

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.linearRampToValueAtTime(vol, t0 + Math.min(0.12, dur * 0.25));
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);

      src.connect(filter);
      filter.connect(gain);
      gain.connect(master);
      src.start(t0);
      src.stop(t0 + dur + 0.04);
    };

    const playPhoenixCry = (startOffset: number, dur: number, peakFreq: number, vol: number) => {
      playTone(peakFreq * 0.58, peakFreq, startOffset, dur * 0.45, 'sawtooth', vol);
      playTone(peakFreq, peakFreq * 0.48, startOffset + dur * 0.4, dur * 0.6, 'sawtooth', vol * 0.9);
      playTone(peakFreq * 1.16, peakFreq * 1.98, startOffset, dur * 0.45, 'triangle', vol * 0.7);
      playTone(peakFreq * 1.98, peakFreq * 0.96, startOffset + dur * 0.4, dur * 0.6, 'sine', vol * 0.65);
    };

    // SCENE 1 (0.0s - 1.5s): Golden Flame Eruption & Rising Wing Launch
    playNoise(0.02, 1.5, 180, 920, 1.2, 0.34, 'bandpass'); // Rising golden pyre ignition
    playTone(55, 110, 0.02, 1.4, 'sawtooth', 0.26); // Deep sub-bass launch lift
    playPhoenixCry(0.32, 1.15, 1480, 0.16); // Initial awakening Phoenix cry

    // SCENE 2 (1.5s - 4.0s): Powerful Aerial Wing Beats & Soaring Fire Whooshes
    const wingBeatTimes = [0.55, 1.05, 1.58, 2.12, 2.68, 3.25, 3.82];
    wingBeatTimes.forEach((wt) => {
      playNoise(wt, 0.36, 340, 140, 1.8, 0.22, 'lowpass');
      playTone(82, 44, wt, 0.28, 'sine', 0.16);
    });
    // Aerial turn shimmer pad (1.8s - 3.9s)
    [261.63, 329.63, 392.0, 523.25].forEach((f) => {
      playTone(f, f * 1.02, 1.6, 2.3, 'triangle', 0.06);
    });

    // SCENE 3 (4.0s - 6.0s): Climax Close-Up, Circular Golden Flame Burst & Halo
    playNoise(4.25, 1.65, 1100, 260, 0.9, 0.42, 'bandpass'); // Circular golden fire burst
    playTone(135, 34, 4.28, 1.6, 'sine', 0.44); // Massive solar halo sub-bass drop
    playPhoenixCry(4.32, 1.45, 1680, 0.22); // Legendary sovereign Phoenix cry
    // Royal Golden Halo Brass/Choir Chord (C4 - E4 - G4 - B4 - D5 - G5)
    [261.63, 329.63, 392.0, 493.88, 587.33, 783.99].forEach((f, idx) => {
      playTone(f, f, 4.35 + idx * 0.04, 1.85, idx < 3 ? 'sawtooth' : 'triangle', 0.085);
    });

    // SCENE 4 (6.0s - 8.2s): Graceful Descent, Landing & Golden Ember Dissolution Chimes
    playNoise(6.1, 1.1, 280, 110, 1.4, 0.16, 'lowpass'); // Gentle landing wing settle
    const emberChimes = [523.25, 659.25, 783.99, 987.77, 1174.66, 1567.98, 2093.0];
    emberChimes.forEach((f, i) => {
      playTone(f, f * 1.004, 6.65 + i * 0.16, 0.95, 'sine', 0.09);
    });
  } catch {
    // Ignore audio context autoplay restrictions
  }

  return () => {
    timeouts.forEach((id) => window.clearTimeout(id));
    if (ctx && ctx.state !== 'closed') {
      ctx.close().catch(() => {});
    }
  };
}

// Smooth cubic Hermite interpolation helper
function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - edge0) / Math.max(1e-5, edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

export const Phoenix3DGift: React.FC<Phoenix3DGiftProps> = ({
  senderName = 'Lonkind',
  senderAvatar,
  combo = 1,
  muted = false,
  onComplete,
}) => {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const completedRef = useRef(false);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  const [scenePhaseLabel, setScenePhaseLabel] = useState<string>('Rises From Golden Flames');
  const [bannerOpacity, setBannerOpacity] = useState<number>(1);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    completedRef.current = false;
    let disposed = false;
    let rafId = 0;

    const finishOnce = () => {
      if (completedRef.current) return;
      completedRef.current = true;
      onCompleteRef.current?.();
    };

    // Start synchronized 4-scene Web Audio soundtrack
    const stopAudio = startPhoenixCinemaAudio(muted);

    // ------------------------------------------------------------------------
    // 1. THREE.JS SCENE, CAMERA & MOBILE-OPTIMIZED TRANSPARENT WEBGL RENDERER
    // ------------------------------------------------------------------------
    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(46, width / Math.max(1, height), 0.1, 100);
    camera.position.set(0, 0.15, 7.6);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    });
    // Cap pixelRatio at 2.0 to avoid excessive GPU/memory usage on high-DPI Android devices
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(width, height);
    renderer.setClearColor(0x000000, 0); // 100% transparent background for live-stream overlay
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.45;
    container.appendChild(renderer.domElement);

    // ------------------------------------------------------------------------
    // 2. CINEMATIC LIGHTING RIG (GOLDEN CORE + SOLAR RIM + CRIMSON FILL)
    // ------------------------------------------------------------------------
    const hemiLight = new THREE.HemisphereLight(0xffe599, 0x3b0a00, 1.5);
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(0xffd27d, 3.2);
    keyLight.position.set(2.5, 5.0, 6.0);
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0xff4500, 2.8);
    rimLight.position.set(-3.0, 3.5, -4.5);
    scene.add(rimLight);

    // Dynamic point light that travels with the Phoenix's fiery heart
    const phoenixCoreLight = new THREE.PointLight(0xff9900, 5.5, 14, 1.4);
    scene.add(phoenixCoreLight);

    // Shared radial fire texture
    const fireTexture = createRadialFireTexture();

    // ------------------------------------------------------------------------
    // 3. SCENE 1 ARRIVAL PYRE & SCENE 3 LEGENDARY CIRCULAR GOLDEN HALO
    // ------------------------------------------------------------------------
    // 3A. Scene 1 Arrival Golden Flame Core at bottom of screen
    const pyreGeo = new THREE.PlaneGeometry(3.6, 3.6);
    const pyreMat = new THREE.MeshBasicMaterial({
      map: fireTexture,
      color: new THREE.Color(0xffb700),
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const pyreMesh = new THREE.Mesh(pyreGeo, pyreMat);
    pyreMesh.position.set(0, -2.35, 0.1);
    scene.add(pyreMesh);

    // 3B. Scene 3 Circular Golden Flame Halo behind the Phoenix (4.0s - 6.0s)
    const haloGroup = new THREE.Group();
    scene.add(haloGroup);

    const haloTorusGeo = new THREE.TorusGeometry(1.75, 0.11, 20, 96);
    const haloTorusMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(0xffd700),
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const haloTorusMesh = new THREE.Mesh(haloTorusGeo, haloTorusMat);
    haloGroup.add(haloTorusMesh);

    const haloOuterTorusGeo = new THREE.TorusGeometry(2.05, 0.22, 16, 96);
    const haloOuterTorusMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(0xff5500),
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const haloOuterTorusMesh = new THREE.Mesh(haloOuterTorusGeo, haloOuterTorusMat);
    haloGroup.add(haloOuterTorusMesh);

    const haloCoronaGeo = new THREE.PlaneGeometry(5.6, 5.6);
    const haloCoronaMat = new THREE.MeshBasicMaterial({
      map: fireTexture,
      color: new THREE.Color(0xffae00),
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const haloCoronaMesh = new THREE.Mesh(haloCoronaGeo, haloCoronaMat);
    haloGroup.add(haloCoronaMesh);

    // ------------------------------------------------------------------------
    // 4. VOLUMETRIC FIRE TRAILS, SPARKS & GOLDEN EMBER PARTICLE ENGINE
    // ------------------------------------------------------------------------
    const MAX_PARTICLES = 780;
    const pPositions = new Float32Array(MAX_PARTICLES * 3);
    const pVelocities = new Float32Array(MAX_PARTICLES * 3);
    const pColors = new Float32Array(MAX_PARTICLES * 3);
    const pSizes = new Float32Array(MAX_PARTICLES);
    const pAges = new Float32Array(MAX_PARTICLES);
    const pLifetimes = new Float32Array(MAX_PARTICLES);

    for (let i = 0; i < MAX_PARTICLES; i++) {
      pAges[i] = 999;
      pLifetimes[i] = 1;
      pSizes[i] = 0;
    }

    const particleGeo = new THREE.BufferGeometry();
    particleGeo.setAttribute('position', new THREE.BufferAttribute(pPositions, 3));
    particleGeo.setAttribute('color', new THREE.BufferAttribute(pColors, 3));
    particleGeo.setAttribute('size', new THREE.BufferAttribute(pSizes, 1));

    const particleMat = new THREE.ShaderMaterial({
      uniforms: {
        uTex: { value: fireTexture },
        uPixelRatio: { value: Math.min(window.devicePixelRatio || 1, 2) },
      },
      vertexShader: /* glsl */ `
        attribute float size;
        varying vec3 vColor;
        uniform float uPixelRatio;
        void main() {
          vColor = color;
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = size * uPixelRatio * (180.0 / max(0.5, -mvPosition.z));
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform sampler2D uTex;
        varying vec3 vColor;
        void main() {
          vec4 texColor = texture2D(uTex, gl_PointCoord);
          if (texColor.a < 0.02) discard;
          gl_FragColor = vec4(vColor * texColor.rgb, texColor.a);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexColors: true,
    });

    const particlePoints = new THREE.Points(particleGeo, particleMat);
    particlePoints.frustumCulled = false;
    scene.add(particlePoints);

    let nextParticleIdx = 0;
    const spawnParticle = (
      x: number,
      y: number,
      z: number,
      vx: number,
      vy: number,
      vz: number,
      size: number,
      life: number,
      temp: number // 0 = deep crimson, 0.5 = orange-gold, 1.0 = incandescent white-gold
    ) => {
      const i = nextParticleIdx;
      nextParticleIdx = (nextParticleIdx + 1) % MAX_PARTICLES;
      const i3 = i * 3;
      pPositions[i3] = x;
      pPositions[i3 + 1] = y;
      pPositions[i3 + 2] = z;
      pVelocities[i3] = vx;
      pVelocities[i3 + 1] = vy;
      pVelocities[i3 + 2] = vz;
      pSizes[i] = size;
      pAges[i] = 0;
      pLifetimes[i] = life;

      // Planckian-inspired golden-orange-crimson fire gradient
      if (temp > 0.75) {
        pColors[i3] = 1.0;
        pColors[i3 + 1] = 0.94;
        pColors[i3 + 2] = 0.68;
      } else if (temp > 0.35) {
        pColors[i3] = 1.0;
        pColors[i3 + 1] = 0.62;
        pColors[i3 + 2] = 0.12;
      } else {
        pColors[i3] = 0.95;
        pColors[i3 + 1] = 0.22;
        pColors[i3 + 2] = 0.04;
      }
    };

    // ------------------------------------------------------------------------
    // 5. LOAD REAL 3D RIGGED & SKINNED PHOENIX MODEL (/gifts/phoenix_bird.glb)
    // ------------------------------------------------------------------------
    const phoenixAnchor = new THREE.Group();
    scene.add(phoenixAnchor);

    let mixer: THREE.AnimationMixer | null = null;
    let flapAction: THREE.AnimationAction | null = null;
    const customMaterials: THREE.MeshStandardMaterial[] = [];
    const trackedBones: {
      spine?: THREE.Object3D;
      head?: THREE.Object3D;
      tailTip?: THREE.Object3D;
      tailMid?: THREE.Object3D;
      leftWingTip?: THREE.Object3D;
      rightWingTip?: THREE.Object3D;
      leftWingMid?: THREE.Object3D;
      rightWingMid?: THREE.Object3D;
    } = {};
    const eyeSprites: THREE.Sprite[] = [];

    loadPhoenixRig()
      .then((rig) => {
        if (disposed) return;
        const birdRoot = cloneSkeleton(rig.source) as THREE.Group;
        phoenixAnchor.add(birdRoot);

        // Upgrade SkinnedMesh materials for photorealistic golden-red flaming plumage & reflections
        birdRoot.traverse((node) => {
          const skinned = node as THREE.SkinnedMesh;
          if (skinned.isSkinnedMesh) {
            skinned.frustumCulled = false;
            const origMat = Array.isArray(skinned.material) ? skinned.material[0] : skinned.material;
            const stdOrigin = origMat as THREE.MeshStandardMaterial;

            const flameMat = new THREE.MeshStandardMaterial({
              map: stdOrigin?.map || null,
              emissiveMap: stdOrigin?.emissiveMap || stdOrigin?.map || null,
              color: new THREE.Color(0xfff1d0),
              emissive: new THREE.Color(0xff5e00),
              emissiveIntensity: 1.85,
              roughness: 0.28,
              metalness: 0.35,
              side: THREE.DoubleSide,
              transparent: true,
              opacity: 1,
              alphaTest: 0.05,
            });

            skinned.material = flameMat;
            customMaterials.push(flameMat);
          }
        });

        // Cache skeletal bones for volumetric fire trails and glowing amber eyes
        trackedBones.spine = birdRoot.getObjectByName(PHOENIX_BONES.spine);
        trackedBones.head = birdRoot.getObjectByName(PHOENIX_BONES.head);
        trackedBones.tailTip = birdRoot.getObjectByName(PHOENIX_BONES.tailTip);
        trackedBones.tailMid = birdRoot.getObjectByName(PHOENIX_BONES.tailMid);
        trackedBones.leftWingTip = birdRoot.getObjectByName(PHOENIX_BONES.leftWingTip);
        trackedBones.rightWingTip = birdRoot.getObjectByName(PHOENIX_BONES.rightWingTip);
        trackedBones.leftWingMid = birdRoot.getObjectByName(PHOENIX_BONES.leftWingMid);
        trackedBones.rightWingMid = birdRoot.getObjectByName(PHOENIX_BONES.rightWingMid);

        // Attach bright glowing amber eyes directly to the head bone
        if (trackedBones.head) {
          for (const side of [-1, 1]) {
            const eyeMat = new THREE.SpriteMaterial({
              map: fireTexture,
              color: new THREE.Color(0xffea70),
              blending: THREE.AdditiveBlending,
              depthTest: false,
              transparent: true,
              opacity: 0.95,
            });
            const eyeSprite = new THREE.Sprite(eyeMat);
            eyeSprite.position.set(side * 6.5, 4.2, 11.5);
            eyeSprite.scale.set(22, 22, 1);
            trackedBones.head.add(eyeSprite);
            eyeSprites.push(eyeSprite);
          }
        }

        // Start skeletal wing & feather physics mixer
        if (rig.clip) {
          mixer = new THREE.AnimationMixer(birdRoot);
          flapAction = mixer.clipAction(rig.clip);
          flapAction.setLoop(THREE.LoopRepeat, Infinity);
          flapAction.play();
        }
      })
      .catch((err) => {
        console.error('[Phoenix3DGift] Failed to load /gifts/phoenix_bird.glb:', err);
      });

    // ------------------------------------------------------------------------
    // 6. CONTINUOUS 4-SCENE 1-SHOT TRAJECTORY & CAMERA CHOREOGRAPHY (0 - 8.2s)
    // ------------------------------------------------------------------------
    const tempBoneWorld = new THREE.Vector3();
    const targetCamPos = new THREE.Vector3(0, 0.15, 7.6);
    const targetLookAt = new THREE.Vector3(0, 0, 0);
    const currentLookAt = new THREE.Vector3(0, -1.2, 0);
    let haloBurstTriggered = false;

    const startTime = performance.now();
    let prevTime = startTime;

    const animate = (now: number) => {
      if (disposed) return;
      const dt = Math.min(0.05, (now - prevTime) / 1000);
      prevTime = now;
      const elapsed = (now - startTime) / 1000;

      if (elapsed >= TOTAL_DURATION) {
        finishOnce();
        return;
      }

      // Update UI phase subtitle & fade out smoothly at end
      if (elapsed < 1.5) {
        setScenePhaseLabel('Rises From Golden Flames');
      } else if (elapsed < 4.0) {
        setScenePhaseLabel('Celestial Aerial Flight');
      } else if (elapsed < 6.0) {
        setScenePhaseLabel('Solar Halo Sovereign Display');
      } else {
        setScenePhaseLabel('Majestic Landing & Golden Embers');
      }
      if (elapsed > TOTAL_DURATION - 1.0) {
        setBannerOpacity(Math.max(0, 1 - (elapsed - (TOTAL_DURATION - 1.0)) / 0.9));
      }

      // ======================================================================
      // COMPUTE CONTINUOUS 4-SCENE PHOENIX POSITION, ROTATION, SCALE & WING SPEED
      // ======================================================================
      let px = 0;
      let py = -2.2;
      let pz = 0;
      let yaw = 0;
      let pitch = 0;
      let roll = 0;
      let birdScale = 1.0;
      let wingTimeScale = 1.15;
      let emissiveIntensity = 1.85;
      let meshOpacity = 1.0;

      if (elapsed < 1.5) {
        // --------------------------------------------------------------------
        // SCENE 1 — ARRIVAL (0.0s - 1.5s)
        // Small golden flame appears near bottom, expands rapidly as Phoenix rises
        // --------------------------------------------------------------------
        const p1 = smoothstep(0.0, 1.5, elapsed);
        const riseEase = smoothstep(0.18, 1.5, elapsed);

        px = Math.sin(p1 * Math.PI * 0.5) * 0.25;
        py = -2.35 + riseEase * 2.15; // Rises from -2.35 up to -0.20
        pz = -0.4 + riseEase * 0.6;

        // Emerges from flame core and spreads enormous wings
        birdScale = smoothstep(0.08, 0.85, elapsed) * 0.96;
        yaw = (1 - riseEase) * 0.35;
        pitch = -0.32 * (1 - riseEase * 0.5); // Pitched upward as it climbs
        roll = 0.08 * Math.sin(elapsed * 4);
        wingTimeScale = 1.38; // Powerful launch wing strokes
        emissiveIntensity = 2.4;

        // Golden arrival flame core expansion & fade
        const pyreBurst =
          elapsed < 0.45
            ? smoothstep(0.0, 0.45, elapsed)
            : Math.max(0, 1 - smoothstep(0.45, 1.45, elapsed));
        pyreMat.opacity = pyreBurst * 0.95;
        const pyreScale = 0.25 + smoothstep(0.0, 1.25, elapsed) * 2.1;
        pyreMesh.scale.set(pyreScale, pyreScale, 1);

        // Spawn intense golden launch flames from bottom pyre
        for (let k = 0; k < 8; k++) {
          const angle = Math.random() * Math.PI * 2;
          const rad = Math.random() * 0.9 * pyreScale * 0.45;
          spawnParticle(
            Math.cos(angle) * rad,
            -2.25 + Math.random() * 0.35,
            Math.sin(angle) * rad,
            (Math.random() - 0.5) * 1.4,
            2.2 + Math.random() * 2.8,
            (Math.random() - 0.5) * 1.4,
            0.35 + Math.random() * 0.35,
            0.55 + Math.random() * 0.45,
            0.45 + Math.random() * 0.55
          );
        }

        // Camera tracks upward arrival
        targetCamPos.set(0, -0.35 + riseEase * 0.5, 7.2 - riseEase * 0.4);
        targetLookAt.set(px, py + 0.15, pz);
      } else if (elapsed < 4.0) {
        // --------------------------------------------------------------------
        // SCENE 2 — FLYING SHOWCASE (1.5s - 4.0s)
        // Flies upward with powerful wing movements, circles gracefully across
        // the scene, and performs a spectacular banked aerial turn.
        // --------------------------------------------------------------------
        pyreMat.opacity = 0;
        const u = (elapsed - 1.5) / 2.5; // 0..1 across Scene 2
        const theta = u * Math.PI * 2.0; // Full graceful aerial loop/circle

        // Smooth 3D figure-arc that connects seamlessly from (0.25, -0.20, 0.20) at u=0
        // and exits toward center-front at u=1 for Scene 3
        const envelope = Math.sin(u * Math.PI);
        px = 0.25 * (1 - u) + Math.sin(theta) * 1.85 * envelope;
        py = -0.2 + Math.sin(u * Math.PI * 0.85) * 1.45 + Math.cos(theta * 0.5) * 0.25 * envelope;
        pz = 0.2 + (1 - Math.cos(theta)) * 0.85 * envelope;

        // Compute tangent for natural banking & heading
        const du = 0.02;
        const u2 = Math.min(1, u + du);
        const theta2 = u2 * Math.PI * 2.0;
        const env2 = Math.sin(u2 * Math.PI);
        const nx = 0.25 * (1 - u2) + Math.sin(theta2) * 1.85 * env2;
        const ny = -0.2 + Math.sin(u2 * Math.PI * 0.85) * 1.45 + Math.cos(theta2 * 0.5) * 0.25 * env2;
        const dx = nx - px;
        const dy = ny - py;

        // Smoothly blend from banking flight orientation back toward camera-facing at end of Scene 2
        const faceCamBlend = smoothstep(0.72, 1.0, u);
        const flightYaw = Math.atan2(dx, 0.45) * 0.75;
        yaw = flightYaw * (1 - faceCamBlend);
        pitch = THREE.MathUtils.clamp(-dy * 1.8, -0.35, 0.35) * (1 - faceCamBlend);
        roll = THREE.MathUtils.clamp(-dx * 2.4, -0.52, 0.52) * (1 - faceCamBlend);

        birdScale = 0.96 + 0.08 * faceCamBlend;
        wingTimeScale = 1.18 - 0.25 * Math.sin(u * Math.PI); // Natural climb/glide modulation
        emissiveIntensity = 2.05;

        // Dynamic camera tracking following the aerial circle
        targetCamPos.set(px * 0.38, py * 0.45 + 0.25, 6.85 - 0.55 * envelope);
        targetLookAt.set(px * 0.85, py, pz);
      } else if (elapsed < 6.0) {
        // --------------------------------------------------------------------
        // SCENE 3 — LEGENDARY DISPLAY (4.0s - 6.0s)
        // Flies toward camera revealing detailed face & feathers, spreads both
        // wings, and releases a magnificent circular burst of golden flames
        // forming a glowing circular halo behind the bird.
        // --------------------------------------------------------------------
        const u = (elapsed - 4.0) / 2.0; // 0..1
        const approach = smoothstep(0.0, 0.45, u);
        const holdAndRetreat = smoothstep(0.72, 1.0, u);

        px = Math.sin(u * Math.PI * 2) * 0.08;
        py = 0.32 + Math.sin(u * Math.PI) * 0.22 - holdAndRetreat * 0.35;
        pz = 0.2 + approach * 1.95 - holdAndRetreat * 0.85; // Swoops close to camera!

        yaw = Math.sin(u * Math.PI * 2) * 0.1;
        pitch = -0.14 * Math.sin(u * Math.PI); // Proud chest-up sovereign posture
        roll = 0;
        birdScale = 1.04 + approach * 0.14 - holdAndRetreat * 0.08;

        // Slow wing beat at climax so the enormous spread wings hold majestically
        wingTimeScale = 0.48 + 0.35 * Math.abs(Math.cos(u * Math.PI));
        emissiveIntensity = 2.75 + Math.sin(u * Math.PI) * 0.65;

        // Position & animate the Circular Golden Flame Halo directly behind the Phoenix
        const haloProgress = smoothstep(0.12, 0.42, u);
        const haloFade = 1 - smoothstep(0.68, 1.0, u);
        const haloAlpha = haloProgress * haloFade;

        haloGroup.position.set(px, py + 0.12, pz - 0.55);
        const hScale = 0.45 + smoothstep(0.1, 0.85, u) * 0.92;
        haloTorusMesh.scale.setScalar(hScale);
        haloOuterTorusMesh.scale.setScalar(hScale * 1.08);
        haloCoronaMesh.scale.setScalar(hScale * 1.15);
        haloTorusMat.opacity = haloAlpha * 0.92;
        haloOuterTorusMat.opacity = haloAlpha * 0.58;
        haloCoronaMat.opacity = haloAlpha * 0.65;

        // Trigger the circular radial burst of golden fire particles once at climax
        if (!haloBurstTriggered && elapsed >= 4.32) {
          haloBurstTriggered = true;
          for (let k = 0; k < 220; k++) {
            const ang = (k / 220) * Math.PI * 2 + (Math.random() - 0.5) * 0.08;
            const spd = 2.4 + Math.random() * 2.6;
            const ringR = 0.5 + Math.random() * 0.35;
            spawnParticle(
              px + Math.cos(ang) * ringR,
              py + 0.12 + Math.sin(ang) * ringR,
              pz - 0.35,
              Math.cos(ang) * spd,
              Math.sin(ang) * spd,
              (Math.random() - 0.5) * 0.9,
              0.38 + Math.random() * 0.34,
              0.85 + Math.random() * 0.65,
              0.65 + Math.random() * 0.35
            );
          }
        }

        // Continuous golden halo rim sparks while halo is active
        if (haloAlpha > 0.15) {
          for (let k = 0; k < 6; k++) {
            const ang = Math.random() * Math.PI * 2;
            const ringR = 1.75 * hScale;
            spawnParticle(
              px + Math.cos(ang) * ringR,
              py + 0.12 + Math.sin(ang) * ringR,
              pz - 0.5,
              Math.cos(ang) * 0.65,
              Math.sin(ang) * 0.65 + 0.4,
              (Math.random() - 0.5) * 0.3,
              0.26 + Math.random() * 0.22,
              0.5 + Math.random() * 0.4,
              0.8
            );
          }
        }

        // Elegant close-up camera framing
        targetCamPos.set(0, 0.32, 6.15 - approach * 0.55 + holdAndRetreat * 0.65);
        targetLookAt.set(px, py + 0.08, pz);
      } else {
        // --------------------------------------------------------------------
        // SCENE 4 — RETURN, LANDING & GOLDEN EMBER DISSOLUTION (6.0s - 8.2s)
        // Gracefully descends from the sky, slows down, lands majestically near
        // center-bottom, folds/softens wings, looks toward camera, and transforms
        // into golden embers that fade away smoothly.
        // --------------------------------------------------------------------
        haloTorusMat.opacity = 0;
        haloOuterTorusMat.opacity = 0;
        haloCoronaMat.opacity = 0;

        const u = (elapsed - 6.0) / (TOTAL_DURATION - 6.0); // 0..1
        const descendEase = smoothstep(0.0, 0.52, u);
        const dissolveEase = smoothstep(0.45, 0.96, u);

        px = 0;
        py = -0.03 - descendEase * 0.95; // Descends gently to center-bottom landing perch (-0.98)
        pz = 1.3 - descendEase * 0.35;

        // Looks directly toward camera on landing
        yaw = 0;
        pitch = 0.12 * descendEase; // Slight noble head-up landing posture
        roll = 0;

        // Slows wing movement as it lands and settles
        wingTimeScale = Math.max(0.12, 0.82 * (1 - descendEase * 0.85));
        birdScale = (1.1 - descendEase * 0.12) * (1 - dissolveEase * 0.08);
        emissiveIntensity = 2.2 * (1 - dissolveEase * 0.4) + Math.sin(u * Math.PI) * 0.5;
        meshOpacity = Math.max(0, 1 - smoothstep(0.48, 0.94, u));

        // Transform body into rising golden embers during dissolution
        if (u > 0.32 && u < 0.92) {
          const emberCount = Math.floor(14 * (1 - Math.abs(u - 0.62) * 2));
          for (let k = 0; k < Math.max(4, emberCount); k++) {
            const spreadX = (Math.random() - 0.5) * 2.2 * (1 - dissolveEase * 0.4);
            const spreadY = (Math.random() - 0.5) * 1.1;
            const spreadZ = (Math.random() - 0.5) * 1.2;
            spawnParticle(
              px + spreadX,
              py + spreadY,
              pz + spreadZ,
              (Math.random() - 0.5) * 0.65,
              0.95 + Math.random() * 1.65,
              (Math.random() - 0.5) * 0.65,
              0.22 + Math.random() * 0.28,
              0.75 + Math.random() * 0.65,
              0.7 + Math.random() * 0.3
            );
          }
        }

        targetCamPos.set(0, -0.35 * descendEase, 6.45 + descendEase * 0.35);
        targetLookAt.set(0, py + 0.05, pz);
      }

      // Apply transform to Phoenix 3D anchor
      phoenixAnchor.position.set(px, py, pz);
      phoenixAnchor.rotation.set(pitch, yaw, roll);
      phoenixAnchor.scale.setScalar(Math.max(0.001, birdScale));

      // Move dynamic core light with the Phoenix
      phoenixCoreLight.position.set(px, py + 0.3, pz + 0.6);
      phoenixCoreLight.intensity = 5.2 * meshOpacity;

      // Update skeletal animation mixer
      if (mixer && flapAction) {
        flapAction.timeScale = wingTimeScale;
        mixer.update(dt);
      }

      // Update custom material emissive glow and ember dissolution opacity
      for (const mat of customMaterials) {
        mat.emissiveIntensity = emissiveIntensity;
        mat.opacity = meshOpacity;
      }
      for (const sprite of eyeSprites) {
        sprite.material.opacity = meshOpacity * 0.95;
      }

      // ======================================================================
      // SPAWN CONTINUOUS BONE-ATTACHED FIRE TRAILS & GOLDEN EMBERS
      // ======================================================================
      if (meshOpacity > 0.15) {
        const emitters = [
          trackedBones.leftWingTip,
          trackedBones.rightWingTip,
          trackedBones.leftWingMid,
          trackedBones.rightWingMid,
          trackedBones.tailTip,
          trackedBones.tailMid,
          trackedBones.spine,
        ];
        for (const bone of emitters) {
          if (!bone) continue;
          bone.getWorldPosition(tempBoneWorld);
          for (let s = 0; s < 2; s++) {
            spawnParticle(
              tempBoneWorld.x + (Math.random() - 0.5) * 0.14,
              tempBoneWorld.y + (Math.random() - 0.5) * 0.14,
              tempBoneWorld.z + (Math.random() - 0.5) * 0.14,
              (Math.random() - 0.5) * 0.7,
              0.45 + Math.random() * 1.15,
              (Math.random() - 0.5) * 0.7,
              0.24 + Math.random() * 0.28,
              0.42 + Math.random() * 0.48,
              0.35 + Math.random() * 0.65
            );
          }
        }
      }

      // ======================================================================
      // STEP GPU PARTICLE PHYSICS (RISING BUOYANCY, TURBULENCE & COOLING)
      // ======================================================================
      const posAttr = particleGeo.getAttribute('position') as THREE.BufferAttribute;
      const colAttr = particleGeo.getAttribute('color') as THREE.BufferAttribute;
      const sizeAttr = particleGeo.getAttribute('size') as THREE.BufferAttribute;

      for (let i = 0; i < MAX_PARTICLES; i++) {
        const age = pAges[i];
        const life = pLifetimes[i];
        if (age >= life) {
          pSizes[i] = 0;
          continue;
        }
        const nextAge = age + dt;
        pAges[i] = nextAge;
        const norm = nextAge / life;
        const i3 = i * 3;

        // Add subtle organic curl/turbulence as fire rises
        pVelocities[i3] += Math.sin(elapsed * 6 + i) * 0.35 * dt;
        pVelocities[i3 + 1] += 0.45 * dt; // Thermal upward lift

        pPositions[i3] += pVelocities[i3] * dt;
        pPositions[i3 + 1] += pVelocities[i3 + 1] * dt;
        pPositions[i3 + 2] += pVelocities[i3 + 2] * dt;

        // Smooth bell-curve size envelope
        const fade = 1 - norm;
        pSizes[i] *= 0.992;
        if (norm > 0.65) {
          pSizes[i] *= fade * 1.35;
        }

        // Cool color from white-gold -> orange -> deep crimson ember
        pColors[i3] = Math.max(0, pColors[i3] * (0.996 - norm * 0.01));
        pColors[i3 + 1] = Math.max(0, pColors[i3 + 1] * (0.985 - norm * 0.02));
        pColors[i3 + 2] = Math.max(0, pColors[i3 + 2] * 0.95);
      }

      posAttr.needsUpdate = true;
      colAttr.needsUpdate = true;
      sizeAttr.needsUpdate = true;

      // ======================================================================
      // SMOOTH CINEMATIC CAMERA TRACKING
      // ======================================================================
      const camLerp = 1 - Math.exp(-5.5 * dt);
      camera.position.lerp(targetCamPos, camLerp);
      currentLookAt.lerp(targetLookAt, camLerp);
      camera.lookAt(currentLookAt);

      renderer.render(scene, camera);
      rafId = requestAnimationFrame(animate);
    };

    rafId = requestAnimationFrame(animate);

    // Handle responsive resize
    const handleResize = () => {
      if (!container || disposed) return;
      const w = container.clientWidth || window.innerWidth;
      const h = container.clientHeight || window.innerHeight;
      camera.aspect = w / Math.max(1, h);
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    // Safety fallback timer so the gift overlay never hangs if backgrounded
    const safetyTimer = window.setTimeout(finishOnce, (TOTAL_DURATION + 0.6) * 1000);

    return () => {
      disposed = true;
      cancelAnimationFrame(rafId);
      window.clearTimeout(safetyTimer);
      window.removeEventListener('resize', handleResize);
      stopAudio();

      // Free WebGL memory for Android/iOS mobile stability
      particleGeo.dispose();
      particleMat.dispose();
      pyreGeo.dispose();
      pyreMat.dispose();
      haloTorusGeo.dispose();
      haloTorusMat.dispose();
      haloOuterTorusGeo.dispose();
      haloOuterTorusMat.dispose();
      haloCoronaGeo.dispose();
      haloCoronaMat.dispose();
      fireTexture.dispose();
      for (const mat of customMaterials) {
        mat.dispose();
      }
      for (const sp of eyeSprites) {
        sp.material.dispose();
      }
      renderer.dispose();
      if (renderer.domElement && renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [muted]);

  return (
    <div
      className="fixed inset-0 z-[9999] pointer-events-none overflow-hidden select-none flex flex-col justify-between"
      style={{
        opacity: bannerOpacity,
        transition: 'opacity 300ms ease-out',
        background:
          'radial-gradient(circle at 50% 52%, rgba(20, 6, 0, 0.62) 0%, rgba(8, 2, 0, 0.45) 55%, rgba(0, 0, 0, 0) 100%)',
      }}
    >
      {/* 3D WebGL Stage Mount (Full-Screen Transparent Overlay, No Rectangular Borders) */}
      <div ref={mountRef} className="absolute inset-0 w-full h-full pointer-events-none" />

      {/* Top Gifter Prestigious Floating HUD Pill */}
      <div className="relative z-10 pt-12 px-4 flex justify-center">
        <div
          className="flex items-center gap-3 px-4 py-2 rounded-full border border-amber-400/50 backdrop-blur-md shadow-[0_0_35px_rgba(251,146,60,0.55)]"
          style={{
            background:
              'linear-gradient(135deg, rgba(45, 10, 2, 0.88) 0%, rgba(124, 45, 18, 0.82) 55%, rgba(245, 158, 11, 0.35) 100%)',
          }}
        >
          {senderAvatar ? (
            <img
              src={senderAvatar}
              alt={senderName}
              className="w-9 h-9 rounded-full object-cover border-2 border-amber-300 shadow-md"
            />
          ) : (
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-amber-400 to-red-600 flex items-center justify-center text-black font-black text-sm border-2 border-amber-200">
              {senderName.charAt(0).toUpperCase()}
            </div>
          )}

          <div className="flex flex-col">
            <div className="flex items-center gap-1.5">
              <span className="text-xs sm:text-sm font-black text-amber-200 tracking-wide">
                {senderName}
              </span>
              <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-amber-400/25 text-amber-200 border border-amber-300/40">
                Legendary Phoenix
              </span>
            </div>
            <span className="text-[11px] text-amber-100/90 font-semibold">
              🦅 {scenePhaseLabel}
            </span>
          </div>

          {combo > 1 && (
            <div className="ml-1 px-2.5 py-0.5 rounded-full bg-gradient-to-r from-amber-300 to-orange-500 text-black font-black text-xs sm:text-sm shadow-lg">
              x{combo}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Phoenix3DGift;
