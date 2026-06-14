import { useEffect, useRef, useState } from "react";
import * as THREE from "three";

/**
 * The hero scene shows EXACTLY what walkback does:
 * an agent core fires off real-world actions (file writes, a charge, an email,
 * a DB drop, a cloud bucket) which scatter into space — then `walkback rollback`
 * pulses out and rewinds every action back into the core, most-recent-first.
 * Loops forever. Raw Three.js (no postprocessing) so it runs everywhere.
 */

type Card = {
  label: string;
  sub: string;
  color: string;
  target: [number, number, number];
  emit: number; // seconds into the loop when it flies out
};

const CARDS: Card[] = [
  { label: "wrote", sub: "src/auth.ts", color: "#818cf8", target: [-2.8, 1.35, 0.2], emit: 0.5 },
  { label: "wrote", sub: "config.ts", color: "#818cf8", target: [2.7, 1.55, -0.4], emit: 1.0 },
  { label: "POST $4,200", sub: "/v1/charges", color: "#fb7185", target: [3.2, -0.15, 0.35], emit: 1.6 },
  { label: "sent email", sub: "1,240 users", color: "#22d3ee", target: [-3.1, -0.25, -0.3], emit: 2.2 },
  { label: "DROP TABLE", sub: "users", color: "#fb7185", target: [-2.0, -1.65, 0.4], emit: 2.8 },
  { label: "created", sub: "s3://assets-prod", color: "#22d3ee", target: [2.1, -1.7, -0.2], emit: 3.4 },
];

const LOOP = 10.5;
const FLY = 0.95;
const REWIND_START = 5.6;
const REWIND_GAP = 0.34;
const REWIND_DUR = 0.72;

const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const clamp01 = (t: number) => Math.max(0, Math.min(1, t));

function makeCardTexture(card: Card): THREE.CanvasTexture {
  const w = 420;
  const h = 132;
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const x = c.getContext("2d")!;
  const r = 26;
  // panel
  x.beginPath();
  x.roundRect(6, 6, w - 12, h - 12, r);
  x.fillStyle = "rgba(13,15,21,0.94)";
  x.fill();
  x.lineWidth = 2.5;
  x.strokeStyle = card.color;
  x.globalAlpha = 0.55;
  x.stroke();
  x.globalAlpha = 1;
  // color chip
  x.beginPath();
  x.roundRect(26, 34, 64, 64, 16);
  x.fillStyle = card.color;
  x.globalAlpha = 0.16;
  x.fill();
  x.globalAlpha = 1;
  x.fillStyle = card.color;
  x.beginPath();
  x.arc(58, 66, 9, 0, Math.PI * 2);
  x.fill();
  // text
  x.fillStyle = "#eef0f6";
  x.font = "600 38px 'Geist Mono', ui-monospace, monospace";
  x.fillText(card.label, 112, 60);
  x.fillStyle = "#8b93a7";
  x.font = "400 28px 'Geist Mono', ui-monospace, monospace";
  x.fillText(card.sub, 112, 98);
  const tex = new THREE.CanvasTexture(c);
  tex.anisotropy = 4;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function radialSprite(color: string, size = 256): THREE.Texture {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const x = c.getContext("2d")!;
  const g = x.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, color);
  g.addColorStop(0.4, color.replace(")", ",0.5)").replace("rgb", "rgba"));
  g.addColorStop(1, "rgba(0,0,0,0)");
  x.fillStyle = g;
  x.fillRect(0, 0, size, size);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const TERMINAL_FRAMES: { t: number; line: string; kind: "cmd" | "fx" | "ok" }[] = [
  { t: 0.0, line: "$ agent run --auto", kind: "cmd" },
  ...CARDS.map((card, i) => ({
    t: card.emit + 0.15,
    line: `  ${card.label} ${card.sub}`.replace("POST $4,200 /v1/charges", "POST /v1/charges  $4,200"),
    kind: "fx" as const,
  })),
  { t: REWIND_START - 0.2, line: "$ walkback rollback", kind: "cmd" },
  { t: REWIND_START + REWIND_GAP * CARDS.length + REWIND_DUR + 0.3, line: "  ✓ rewound 6 actions · clean", kind: "ok" },
];

export default function Hero() {
  const mount = useRef<HTMLDivElement>(null);
  const [lines, setLines] = useState<{ line: string; kind: string }[]>([]);

  useEffect(() => {
    const el = mount.current;
    if (!el) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(52, el.clientWidth / el.clientHeight, 0.1, 100);
    camera.position.set(0, 0, 6.2);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(el.clientWidth, el.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    el.appendChild(renderer.domElement);

    // starfield
    const starGeo = new THREE.BufferGeometry();
    const starN = 560;
    const pos = new Float32Array(starN * 3);
    for (let i = 0; i < starN; i++) {
      const r = 9 + Math.random() * 14;
      const th = Math.random() * Math.PI * 2;
      const ph = Math.acos(2 * Math.random() - 1);
      pos[i * 3] = r * Math.sin(ph) * Math.cos(th);
      pos[i * 3 + 1] = r * Math.sin(ph) * Math.sin(th);
      pos[i * 3 + 2] = r * Math.cos(ph) - 6;
    }
    starGeo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    const stars = new THREE.Points(
      starGeo,
      new THREE.PointsMaterial({ size: 0.035, color: 0x9aa3c0, transparent: true, opacity: 0.55 })
    );
    scene.add(stars);

    // core: wireframe icosahedron + inner glow
    const coreGroup = new THREE.Group();
    const ico = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.IcosahedronGeometry(0.85, 1)),
      new THREE.LineBasicMaterial({ color: 0x8b93f8, transparent: true, opacity: 0.85 })
    );
    coreGroup.add(ico);
    const innerCore = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.42, 1),
      new THREE.MeshBasicMaterial({ color: 0x6366f1 })
    );
    coreGroup.add(innerCore);
    const glow = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: radialSprite("rgb(99,102,241)"),
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    glow.scale.set(4.2, 4.2, 1);
    coreGroup.add(glow);
    scene.add(coreGroup);

    // pulse ring (rewind shockwave)
    const pulse = new THREE.Mesh(
      new THREE.RingGeometry(0.7, 0.86, 64),
      new THREE.MeshBasicMaterial({
        color: 0x22d3ee,
        transparent: true,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    scene.add(pulse);

    // cards
    const cards = CARDS.map((card) => {
      const mat = new THREE.MeshBasicMaterial({ map: makeCardTexture(card), transparent: true, depthWrite: false });
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.47), mat);
      mesh.renderOrder = 2;
      scene.add(mesh);
      // connector line core -> card
      const lineGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
      const line = new THREE.Line(
        lineGeo,
        new THREE.LineBasicMaterial({ color: new THREE.Color(card.color), transparent: true, opacity: 0.0 })
      );
      scene.add(line);
      return { card, mesh, line, lineGeo };
    });

    // interaction
    const mouse = { x: 0, y: 0 };
    const onMove = (e: MouseEvent) => {
      mouse.x = (e.clientX / window.innerWidth - 0.5) * 2;
      mouse.y = (e.clientY / window.innerHeight - 0.5) * 2;
    };
    window.addEventListener("mousemove", onMove);

    const onResize = () => {
      if (!el) return;
      camera.aspect = el.clientWidth / el.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(el.clientWidth, el.clientHeight);
    };
    window.addEventListener("resize", onResize);

    const clock = new THREE.Clock();
    let raf = 0;
    let lastCount = -1;

    const tmp = new THREE.Vector3();
    const frame = () => {
      raf = requestAnimationFrame(frame);
      const dt = clock.getDelta();
      const elapsed = clock.getElapsedTime();
      const t = reduce ? 4.5 : elapsed % LOOP;

      coreGroup.rotation.y += dt * 0.25;
      coreGroup.rotation.x += dt * 0.12;
      ico.rotation.y -= dt * 0.1;
      stars.rotation.y += dt * 0.012;

      // camera parallax
      camera.position.x += (mouse.x * 0.45 - camera.position.x) * 0.04;
      camera.position.y += (-mouse.y * 0.32 - camera.position.y) * 0.04;
      camera.lookAt(0, 0, 0);

      // core pulse on rewind
      const corePulse = 1 + 0.06 * Math.sin(elapsed * 2.2);
      innerCore.scale.setScalar(corePulse);

      // pulse ring
      const pr = clamp01((t - REWIND_START) / 1.3);
      if (pr > 0 && pr < 1) {
        const s = 0.7 + easeOut(pr) * 7;
        pulse.scale.set(s, s, s);
        pulse.lookAt(camera.position);
        (pulse.material as THREE.MeshBasicMaterial).opacity = (1 - pr) * 0.5;
      } else {
        (pulse.material as THREE.MeshBasicMaterial).opacity = 0;
      }

      cards.forEach(({ card, mesh, line, lineGeo }, i) => {
        const tx = card.target[0], ty = card.target[1], tz = card.target[2];
        // emission progress
        const out = clamp01((t - card.emit) / FLY);
        // rewind progress (reverse order: last emitted retracts first)
        const rwStart = REWIND_START + (CARDS.length - 1 - i) * REWIND_GAP;
        const rw = clamp01((t - rwStart) / REWIND_DUR);

        let p = easeOut(out) * (1 - easeInOut(rw)); // 0 at core, 1 fully out
        const visible = out > 0;
        mesh.position.set(tx * p, ty * p, tz * p);
        const sc = 0.15 + 0.85 * p;
        mesh.scale.set(sc, sc, 1);
        mesh.quaternion.copy(camera.quaternion); // billboard
        const mat = mesh.material as THREE.MeshBasicMaterial;
        mat.opacity = visible ? Math.min(1, p * 1.6) : 0;

        // connector
        const lm = line.material as THREE.LineBasicMaterial;
        lm.opacity = mat.opacity * 0.35;
        const arr = lineGeo.attributes.position as THREE.BufferAttribute;
        arr.setXYZ(0, 0, 0, 0);
        arr.setXYZ(1, mesh.position.x, mesh.position.y, mesh.position.z);
        arr.needsUpdate = true;
      });

      // terminal sync
      const count = TERMINAL_FRAMES.filter((f) => t >= f.t).length;
      if (count !== lastCount) {
        lastCount = count;
        setLines(TERMINAL_FRAMES.slice(0, count).map((f) => ({ line: f.line, kind: f.kind })));
      }

      tmp; // keep ref
      renderer.render(scene, camera);
    };
    frame();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("resize", onResize);
      renderer.dispose();
      scene.traverse((o) => {
        const any = o as any;
        any.geometry?.dispose?.();
        if (any.material) {
          const m = any.material;
          (Array.isArray(m) ? m : [m]).forEach((mm: any) => {
            mm.map?.dispose?.();
            mm.dispose?.();
          });
        }
      });
      el.removeChild(renderer.domElement);
    };
  }, []);

  return (
    <div className="absolute inset-0 z-0">
      <div ref={mount} className="absolute inset-0" />
      {/* legibility vignette */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 60% 50% at 50% 42%, rgba(8,9,13,0.72) 0%, rgba(8,9,13,0.2) 45%, transparent 70%), linear-gradient(to bottom, transparent 60%, #08090d 98%)",
        }}
      />
      {/* live terminal */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 w-[min(92vw,560px)] z-10 pointer-events-none">
        <div className="glass rounded-xl px-4 py-3 font-mono text-[12.5px] leading-relaxed shadow-2xl">
          <div className="flex gap-1.5 mb-2 opacity-60">
            <span className="w-2.5 h-2.5 rounded-full bg-[#fb7185]" />
            <span className="w-2.5 h-2.5 rounded-full bg-[#fbbf24]" />
            <span className="w-2.5 h-2.5 rounded-full bg-[#34d399]" />
          </div>
          {lines.map((l, i) => (
            <div
              key={i}
              className={
                l.kind === "cmd"
                  ? "text-[#e9ebf1]"
                  : l.kind === "ok"
                    ? "text-[#34d399]"
                    : "text-[#8b93a7]"
              }
            >
              {l.line}
              {i === lines.length - 1 && <span className="caret text-[#22d3ee]">▋</span>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
