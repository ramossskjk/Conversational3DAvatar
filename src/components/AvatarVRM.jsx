import { useEffect, useRef } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader";
import { VRMLoaderPlugin, VRMUtils } from "@pixiv/three-vrm";

const CANVAS_W = 720;
const CANVAS_H = 1080;

const lerp = (a, b, t) => a + (b - a) * t;

export function AvatarVRM({ modelUrl, mood, isTalking }) {
  const mountRef    = useRef(null);
  const mouseRef    = useRef({ x: 0, y: 0 });

  // ── Refs para isTalking e mood — evita stale closure no loop ─────────────
  const isTalkingRef = useRef(isTalking);
  const moodRef      = useRef(mood);
  useEffect(() => { isTalkingRef.current = isTalking; }, [isTalking]);
  useEffect(() => { moodRef.current = mood; },           [mood]);

  const stateRef = useRef({
    vrm:        null,
    clock:      new THREE.Clock(),   // será substituído por Timer abaixo
    talkPhase:  0,
    talkTimer:  0,
    blinkTimer: Math.random() * 3 + 1.5,
    lookX:      0,
    lookY:      0,
    moodTiltZ:  0,

    headDrift: {
      targetY:   0,
      currentY:  0,
      timer:     0,
      nextDrift: 3 + Math.random() * 4,
    },

    breathOffset: Math.random() * Math.PI * 2,
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

    // ── THREE.Timer substitui THREE.Clock (deprecated) ────────────────────
    const timer = new THREE.Timer();
    s.clock = timer; // mantém referência no state pra uso no loop

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, precision: "highp" });
    renderer.setPixelRatio(1);
    renderer.setSize(CANVAS_W, CANVAS_H, false);
    renderer.domElement.style.width   = "100%";
    renderer.domElement.style.height  = "100%";
    renderer.domElement.style.display = "block";
    renderer.outputColorSpace         = THREE.SRGBColorSpace;
    renderer.toneMapping              = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure      = 1.3;
    el.appendChild(renderer.domElement);

    const maxAniso = renderer.capabilities.getMaxAnisotropy();
    const scene    = new THREE.Scene();
    const camera   = new THREE.PerspectiveCamera(14, CANVAS_W / CANVAS_H, 0.1, 20);
    camera.position.set(0, 1.2, 3.0);
    camera.lookAt(0, 1.28, 0);

    scene.add(new THREE.AmbientLight(0xfff5ff, 1.4));
    const key  = new THREE.DirectionalLight(0xffffff, 2.2);
    key.position.set(1.5, 4, 3);   scene.add(key);
    const fill = new THREE.DirectionalLight(0xffd0ff, 0.8);
    fill.position.set(-3, 2, 2);   scene.add(fill);
    const rim  = new THREE.DirectionalLight(0xb060ff, 1.0);
    rim.position.set(0, 3, -4);    scene.add(rim);
    const btm  = new THREE.DirectionalLight(0xff80c8, 0.25);
    btm.position.set(0, -2, 2);    scene.add(btm);

    const loader = new GLTFLoader();
    loader.register(parser => new VRMLoaderPlugin(parser));
    loader.load(modelUrl, gltf => {
      const vrm = gltf.userData.vrm;

      // ── combineSkeletons substitui removeUnnecessaryJoints (deprecated) ──
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

      // Pose inicial dos braços
      const h       = vrm.humanoid;
      const init    = (name, x, z) => {
        const b = h?.getNormalizedBoneNode(name);
        if (!b) return;
        if (x != null) b.rotation.x = x;
        if (z != null) b.rotation.z = z;
      };
      init("leftUpperArm",  null,  1.1);
      init("rightUpperArm", null, -1.1);
      init("leftLowerArm",  0.15,  0.3);
      init("rightLowerArm", 0.15, -0.3);
      init("leftHand",      null,  0.1);
      init("rightHand",     null, -0.1);
      init("spine",         0.02,  null);
      init("chest",        -0.02,  null);

    }, undefined, err => console.error("VRM error:", err));

    let frameId;
    const animate = () => {
      frameId = requestAnimationFrame(animate);

      // THREE.Timer usa .update() e expõe getDelta / getElapsed
      timer.update();
      const delta = timer.getDelta();
      const t     = timer.getElapsed();

      const { headDrift } = s;
      const vrm = s.vrm;

      if (vrm) {
        const h  = vrm.humanoid;
        const em = vrm.expressionManager;
        const getBone = name => h?.getNormalizedBoneNode(name);

        const SMOOTH = 1 - Math.pow(0.01,  delta);
        const DRIFT  = 1 - Math.pow(0.004, delta);

        // ── Respiração ────────────────────────────────────────────────
        const breathCycle = Math.sin((t + s.breathOffset) * (Math.PI * 2 / 4));
        const chest = getBone("chest");
        const spine = getBone("spine");
        const hips  = getBone("hips");
        if (chest) chest.rotation.x = lerp(chest.rotation.x, -0.02 + breathCycle * 0.022, SMOOTH);
        if (spine) spine.rotation.x = lerp(spine.rotation.x,  0.02 - breathCycle * 0.012, SMOOTH);
        if (hips) {
          hips.rotation.z = lerp(hips.rotation.z, Math.sin(t * 0.7) * 0.01, SMOOTH);
          hips.rotation.x = lerp(hips.rotation.x, breathCycle * 0.008,       SMOOTH);
        }

        // ── Head drift autônomo ───────────────────────────────────────
        headDrift.timer += delta;
        if (headDrift.timer >= headDrift.nextDrift) {
          headDrift.timer     = 0;
          headDrift.nextDrift = 2.5 + Math.random() * 4.5;
          const roll = Math.random();
          if      (roll < 0.35) headDrift.targetY =  0;
          else if (roll < 0.67) headDrift.targetY = -(0.12 + Math.random() * 0.12);
          else                  headDrift.targetY =  (0.12 + Math.random() * 0.12);
        }
        headDrift.currentY = lerp(headDrift.currentY, headDrift.targetY, DRIFT);

        // ── Mouse look + drift ────────────────────────────────────────
        s.lookX = lerp(s.lookX, mouseRef.current.x * 0.22, SMOOTH);
        s.lookY = lerp(s.lookY, mouseRef.current.y * 0.13, SMOOTH);

        const head = getBone("head");
        const neck = getBone("neck");
        if (head) {
          head.rotation.y = lerp(head.rotation.y, s.lookX * 0.7 + headDrift.currentY, SMOOTH);
          head.rotation.x = lerp(head.rotation.x, s.lookY * 0.7 - 0.02,               SMOOTH);
          head.rotation.z = lerp(head.rotation.z, s.moodTiltZ ?? 0,                    SMOOTH);
        }
        if (neck) {
          neck.rotation.y = lerp(neck.rotation.y, s.lookX * 0.3 + headDrift.currentY * 0.4, SMOOTH);
          neck.rotation.x = lerp(neck.rotation.x, s.lookY * 0.3, SMOOTH);
        }
        if (vrm.lookAt) {
          vrm.lookAt.yaw   = lerp(vrm.lookAt.yaw   ?? 0, -s.lookX * 14, SMOOTH);
          vrm.lookAt.pitch = lerp(vrm.lookAt.pitch ?? 0, -s.lookY * 9,  SMOOTH);
        }

        // ── Ombros ────────────────────────────────────────────────────
        const lShoulder = getBone("leftShoulder");
        const rShoulder = getBone("rightShoulder");
        const sf = Math.sin(t * 0.6) * 0.012 + breathCycle * 0.008;
        if (lShoulder) lShoulder.rotation.z = lerp(lShoulder.rotation.z,  sf, SMOOTH);
        if (rShoulder) rShoulder.rotation.z = lerp(rShoulder.rotation.z, -sf, SMOOTH);

        // ── Braços ────────────────────────────────────────────────────
        const rArm  = getBone("rightUpperArm");
        const rFore = getBone("rightLowerArm");
        const rHand = getBone("rightHand");
        const lArm  = getBone("leftUpperArm");
        const lFore = getBone("leftLowerArm");
        const lHand = getBone("leftHand");
        if (rArm)  rArm.rotation.z  = lerp(rArm.rotation.z,  -1.1, SMOOTH);
        if (rFore) rFore.rotation.z = lerp(rFore.rotation.z,  -0.3, SMOOTH);
        if (rHand) rHand.rotation.z = lerp(rHand.rotation.z,  -0.1, SMOOTH);
        if (lArm)  lArm.rotation.z  = lerp(lArm.rotation.z,   1.1, SMOOTH);
        if (lFore) lFore.rotation.z = lerp(lFore.rotation.z,   0.3, SMOOTH);
        if (lHand) lHand.rotation.z = lerp(lHand.rotation.z,   0.1, SMOOTH);

        // ── Blink ─────────────────────────────────────────────────────
        s.blinkTimer -= delta;
        if (s.blinkTimer <= 0) {
          s.blinkTimer = Math.random() * 3 + 2;
          em?.setValue("blink", 1);
          setTimeout(() => em?.setValue("blink", 0), 120);
        }

        // ── Talking — lê do ref, nunca fica stale ─────────────────────
        if (isTalkingRef.current) {
          s.talkTimer -= delta;
          if (s.talkTimer <= 0) {
            s.talkTimer = 0.1;
            s.talkPhase = (s.talkPhase + 1) % 4;
            const target = [0, 0.5, 0.95, 0.3][s.talkPhase];
            const curr   = em?.getValue("aa") ?? 0;
            em?.setValue("aa", lerp(curr, target, 0.4));
          }
        } else {
          const curr = em?.getValue("aa") ?? 0;
          if (curr > 0.01) em?.setValue("aa", lerp(curr, 0, 0.15));
          else             em?.setValue("aa", 0);
        }

        vrm.update(delta);
      }
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      cancelAnimationFrame(frameId);
      timer.dispose?.();
      renderer.dispose();
      if (el.contains(renderer.domElement)) el.removeChild(renderer.domElement);
    };
  }, [modelUrl]);

  // ── Expressões por mood ───────────────────────────────────────────────────
  useEffect(() => {
    const em = stateRef.current.vrm?.expressionManager;
    if (!em) return;

    ["surprised", "sad", "angry", "relaxed"].forEach(e => em.setValue(e, 0));
    em.setValue("blinkLeft",  0);
    em.setValue("blinkRight", 0);

    stateRef.current.moodTiltZ = 0;
    const s = stateRef.current;

    const moods = {
      happy:       () => em.setValue("surprised", 0.9),
      talking:     () => em.setValue("surprised", 0.5),
      idle:        () => em.setValue("relaxed",   0.6),

      thinking: () => {
        em.setValue("sad", 0.35);
        s.moodTiltZ = -0.08;
      },

      surprised:   () => em.setValue("surprised", 1.0),
      excited:     () => em.setValue("surprised", 1.0),

      embarrassed: () => {
        em.setValue("surprised", 0.3);
        em.setValue("relaxed",   0.3);
        s.moodTiltZ = 0.10;
        if (s.vrm?.lookAt) s.vrm.lookAt.pitch = lerp(s.vrm.lookAt.pitch ?? 0, 8, 0.3);
      },

      confused: () => {
        em.setValue("sad",       0.3);
        em.setValue("surprised", 0.2);
        s.moodTiltZ = -0.13;
      },

      wink: () => {
        em.setValue("relaxed", 0.5);
        s.moodTiltZ = 0.08;
        em.setValue("blinkLeft", 1);
        setTimeout(() => {
          em.setValue("blinkLeft", 0);
          setTimeout(() => {
            em.setValue("blinkLeft", 1);
            setTimeout(() => em.setValue("blinkLeft", 0), 120);
          }, 200);
        }, 400);
      },
    };

    moods[mood]?.();
  }, [mood]);

  return (
    <div
      ref={mountRef}
      style={{ width: "100%", height: "100%", borderRadius: "16px", overflow: "hidden" }}
    />
  );
}