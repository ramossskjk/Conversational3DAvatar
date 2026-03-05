import { useEffect, useRef } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader";
import { VRMLoaderPlugin, VRMUtils } from "@pixiv/three-vrm";

const CANVAS_W = 720;
const CANVAS_H = 1080;

// Lerp suave entre dois valores
const lerp = (a, b, t) => a + (b - a) * t;

// Easing suave (ease in-out)
const easeInOut = (t) => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;

export function AvatarVRM({ modelUrl, mood, isTalking }) {
  const mountRef = useRef(null);
  const mouseRef = useRef({ x: 0, y: 0 });
  const stateRef = useRef({
    vrm: null,
    clock: new THREE.Clock(),
    talkPhase: 0,
    talkTimer: 0,
    blinkTimer: Math.random() * 3 + 1.5,
    lookX: 0,
    lookY: 0,

    // Pose atual de cada osso (lerp target)
    bones: {},

    // Wave state machine
    wave: {
      active: false,
      phase: 0,       // 0=idle, 1=raise, 2=wave, 3=lower
      timer: 0,
      nextWave: 4 + Math.random() * 6,
    },
  });

  useEffect(() => {
    const onMove = (e) => {
      mouseRef.current.x =  (e.clientX / window.innerWidth  - 0.5) * 2;
      mouseRef.current.y = -(e.clientY / window.innerHeight - 0.5) * 2;
    };
    window.addEventListener("mousemove", onMove);
    return () => window.removeEventListener("mousemove", onMove);
  }, []);

  useEffect(() => {
    const el = mountRef.current;
    if (!el) return;
    const s = stateRef.current;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, precision: "highp" });
    renderer.setPixelRatio(1);
    renderer.setSize(CANVAS_W, CANVAS_H, false);
    renderer.domElement.style.width   = "100%";
    renderer.domElement.style.height  = "100%";
    renderer.domElement.style.display = "block";
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.3;
    el.appendChild(renderer.domElement);

    const maxAniso = renderer.capabilities.getMaxAnisotropy();
    const scene    = new THREE.Scene();
    const camera   = new THREE.PerspectiveCamera(14, CANVAS_W / CANVAS_H, 0.1, 20);
    camera.position.set(0, 1.2, 2.9);
    camera.lookAt(0, 1.30, 0);

    scene.add(new THREE.AmbientLight(0xfff5ff, 1.4));
    const key = new THREE.DirectionalLight(0xffffff, 2.2);
    key.position.set(1.5, 4, 3); scene.add(key);
    const fill = new THREE.DirectionalLight(0xffd0ff, 0.8);
    fill.position.set(-3, 2, 2); scene.add(fill);
    const rim = new THREE.DirectionalLight(0xb060ff, 1.0);
    rim.position.set(0, 3, -4); scene.add(rim);
    const btm = new THREE.DirectionalLight(0xff80c8, 0.25);
    btm.position.set(0, -2, 2); scene.add(btm);

    const loader = new GLTFLoader();
    loader.register(parser => new VRMLoaderPlugin(parser));
    loader.load(modelUrl, gltf => {
      const vrm = gltf.userData.vrm;
      VRMUtils.combineSkeletons(gltf.scene);
      VRMUtils.rotateVRM0(vrm);

      vrm.scene.traverse(obj => {
        if (!obj.isMesh) return;
        const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
        mats.forEach(mat => {
          if (!mat) return;
          Object.values(mat).forEach(val => {
            if (val?.isTexture) {
              val.anisotropy  = maxAniso;
              val.minFilter   = THREE.LinearMipmapLinearFilter;
              val.magFilter   = THREE.LinearFilter;
              val.needsUpdate = true;
            }
          });
        });
      });

      scene.add(vrm.scene);
      s.vrm = vrm;

      // Inicializa pose de descanso suavemente
      const h = vrm.humanoid;
      const restPose = {
        leftUpperArm:  { z:  1.1  },
        rightUpperArm: { z: -1.1  },
        leftLowerArm:  { x:  0.15, z:  0.3 },
        rightLowerArm: { x:  0.15, z: -0.3 },
        leftHand:      { z:  0.1  },
        rightHand:     { z: -0.1  },
        spine:         { x:  0.02 },
        chest:         { x: -0.02 },
      };

      // Guarda pose alvo para cada osso
      Object.entries(restPose).forEach(([name, rot]) => {
        s.bones[name] = { ...rot };
        const bone = h?.getNormalizedBoneNode(name);
        if (!bone) return;
        if (rot.x != null) bone.rotation.x = rot.x;
        if (rot.z != null) bone.rotation.z = rot.z;
      });

    }, undefined, err => console.error("VRM error:", err));

    let frameId;
    const animate = () => {
      frameId = requestAnimationFrame(animate);
      const delta = s.clock.getDelta();
      const t     = s.clock.elapsedTime;
      const { vrm, wave } = s;

      if (vrm) {
        const h  = vrm.humanoid;
        const em = vrm.expressionManager;
        const getBone = name => h?.getNormalizedBoneNode(name);

        // Velocidade de lerp — mais baixo = mais fluido/lento
        const SMOOTH = 1 - Math.pow(0.01, delta);  // ~suave
        const FAST   = 1 - Math.pow(0.05, delta);  // ~rápido

        // ── Mouse look ─────────────────────────────────────────────────
        s.lookX = lerp(s.lookX, mouseRef.current.x * 0.22, SMOOTH);
        s.lookY = lerp(s.lookY, mouseRef.current.y * 0.13, SMOOTH);

        const head = getBone("head");
        const neck = getBone("neck");
        const tgtHY = s.lookX * 0.7 + Math.sin(t * 0.3) * 0.03;
        const tgtHX = s.lookY * 0.7 + Math.sin(t * 0.2) * 0.02 - 0.02;
        if (head) {
          head.rotation.y = lerp(head.rotation.y, tgtHY, SMOOTH);
          head.rotation.x = lerp(head.rotation.x, tgtHX, SMOOTH);
        }
        if (neck) {
          neck.rotation.y = lerp(neck.rotation.y, s.lookX * 0.3, SMOOTH);
          neck.rotation.x = lerp(neck.rotation.x, s.lookY * 0.3, SMOOTH);
        }
        if (vrm.lookAt) {
          vrm.lookAt.yaw   = lerp(vrm.lookAt.yaw   ?? 0, -s.lookX * 14, SMOOTH);
          vrm.lookAt.pitch = lerp(vrm.lookAt.pitch ?? 0, -s.lookY * 9,  SMOOTH);
        }

        // ── Breathing ──────────────────────────────────────────────────
        const breath = Math.sin(t * 1.4) * 0.012;
        const chest = getBone("chest");
        const spine = getBone("spine");
        if (chest) chest.rotation.x = lerp(chest.rotation.x, -0.02 + breath, SMOOTH);
        if (spine) spine.rotation.x = lerp(spine.rotation.x,  0.02 - breath * 0.5, SMOOTH);

        // ── Body sway ──────────────────────────────────────────────────
        const hips = getBone("hips");
        if (hips) {
          hips.rotation.z = lerp(hips.rotation.z, Math.sin(t * 0.7) * 0.01, SMOOTH);
          hips.rotation.x = lerp(hips.rotation.x, Math.sin(t * 0.4) * 0.004, SMOOTH);
        }

        // ── Shoulder subtle ────────────────────────────────────────────
        const lShoulder = getBone("leftShoulder");
        const rShoulder = getBone("rightShoulder");
        const sf = Math.sin(t * 0.6) * 0.012;
        if (lShoulder) lShoulder.rotation.z = lerp(lShoulder.rotation.z,  sf, SMOOTH);
        if (rShoulder) rShoulder.rotation.z = lerp(rShoulder.rotation.z, -sf, SMOOTH);

        // ── Braços em pose de descanso fixa ───────────────────────────
        const rArm  = getBone("rightUpperArm");
        const rFore = getBone("rightLowerArm");
        const rHand = getBone("rightHand");
        const lArm  = getBone("leftUpperArm");
        const lFore = getBone("leftLowerArm");
        const lHand = getBone("leftHand");

        if (rArm)  rArm.rotation.z  = lerp(rArm.rotation.z,  -1.1, SMOOTH);
        if (rArm)  rArm.rotation.x  = lerp(rArm.rotation.x,   0.0, SMOOTH);
        if (rFore) rFore.rotation.z = lerp(rFore.rotation.z,  -0.3, SMOOTH);
        if (rHand) rHand.rotation.z = lerp(rHand.rotation.z,  -0.1, SMOOTH);
        if (lArm)  lArm.rotation.z  = lerp(lArm.rotation.z,   1.1, SMOOTH);
        if (lFore) lFore.rotation.z = lerp(lFore.rotation.z,   0.3, SMOOTH);
        if (lHand) lHand.rotation.z = lerp(lHand.rotation.z,   0.1, SMOOTH);

        // ── Blink ──────────────────────────────────────────────────────
        s.blinkTimer -= delta;
        if (s.blinkTimer <= 0) {
          s.blinkTimer = Math.random() * 3 + 2;
          em?.setValue("blink", 1);
          setTimeout(() => em?.setValue("blink", 0), 120);
        }

        // ── Talking ────────────────────────────────────────────────────
        if (isTalking) {
          s.talkTimer -= delta;
          if (s.talkTimer <= 0) {
            s.talkTimer = 0.1;
            s.talkPhase = (s.talkPhase + 1) % 4;
            const target = [0, 0.5, 0.95, 0.3][s.talkPhase];
            const curr = em?.getValue("aa") ?? 0;
            em?.setValue("aa", lerp(curr, target, 0.4));
          }
        } else {
          const curr = em?.getValue("aa") ?? 0;
          if (curr > 0.01) em?.setValue("aa", lerp(curr, 0, 0.15));
          else em?.setValue("aa", 0);
        }

        vrm.update(delta);
      }
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      cancelAnimationFrame(frameId);
      renderer.dispose();
      if (el.contains(renderer.domElement)) el.removeChild(renderer.domElement);
    };
  }, [modelUrl]);

  useEffect(() => {
    const em = stateRef.current.vrm?.expressionManager;
    if (!em) return;
    ["happy","sad","surprised","angry","relaxed"].forEach(e => em.setValue(e, 0));
    ({
      happy:     () => em.setValue("happy",     0.9),
      thinking:  () => em.setValue("sad",       0.4),
      surprised: () => em.setValue("surprised", 1.0),
      talking:   () => em.setValue("happy",     0.5),
      idle:      () => em.setValue("relaxed",   0.6),
    })[mood]?.();
  }, [mood]);

  return (
    <div ref={mountRef} style={{ width: "100%", height: "100%", borderRadius: "16px", overflow: "hidden" }} />
  );
}