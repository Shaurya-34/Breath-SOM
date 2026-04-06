import { useRef, useEffect, useState } from "react";
import { SOMParams, SOMNode, remoteStep, remoteReset, remoteSetParams } from "@/lib/som";

interface SOMCanvasProps { params: SOMParams; resetKey: number; }

const DISP_LERP = 0.10;
const ROT_LERP  = 0.06;
const ZOOM_LERP = 0.10;

// ── BMU ripple event ─────────────────────────────────────────────────────────
// Each training step spawns a ripple centred on the REAL BMU grid position.
// The ripple expands outward and decays over time — creating "breathing" that
// is 100% driven by actual SOM dynamics:
//   • centre      = real BMU position (from argmin ‖wᵢ − x‖)
//   • peak        = real max ‖Δwᵢ‖ from that step
//   • spread rate = mirrors the Gaussian neighbourhood h(i, BMU, t)
interface Ripple {
  bmuRow: number;
  bmuCol: number;
  birth: number;      // frame counter when this ripple was born
  peak: number;       // max ‖Δwᵢ‖ from that training step
}

const RIPPLE_LIFETIME = 180;   // frames (~3s at 60fps) — long gentle fade
const RIPPLE_MAX      = 50;    // ring buffer capacity
const RIPPLE_SPREAD0  = 2.5;   // initial Gaussian sigma (grid units)
const RIPPLE_EXPAND   = 0.05;  // sigma grows slowly for wide gentle waves
const RIPPLE_WAVE_K   = 0.20;  // spatial wave number (wider ring spacing)
const RIPPLE_WAVE_W   = 0.035; // temporal frequency (slow gentle pulse)

// ── colour ───────────────────────────────────────────────────────────────────
function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const hue = (p: number, q: number, t: number) => {
    if (t < 0) t += 1; if (t > 1) t -= 1;
    return t < 1/6 ? p+(q-p)*6*t : t < 1/2 ? q : t < 2/3 ? p+(q-p)*(2/3-t)*6 : p;
  };
  const q = l < 0.5 ? l*(1+s) : l+s-l*s, p = 2*l-q;
  return [Math.round(hue(p,q,h+1/3)*255), Math.round(hue(p,q,h)*255), Math.round(hue(p,q,h-1/3)*255)];
}
function wColor(w: number[]): [number, number, number] {
  // Richer, vibrant sci-fi palette (Cyan to Magenta)
  return hslToRgb((180+w[0]*120)/360, (70+w[1]*30)/100, (40+w[2]*35)/100);
}

// ── display lerp ─────────────────────────────────────────────────────────────
function lerpNodes(d: SOMNode[], t: SOMNode[], f: number): SOMNode[] {
  if (d.length !== t.length) return t.map(n => ({ ...n, weights: [...n.weights], delta: n.delta }));
  return d.map((dn, i) => ({
    ...dn,
    weights: dn.weights.map((w, k) => w + (t[i].weights[k] - w) * f),
    delta: t[i].delta,   // raw delta, ripples handle the animation
  }));
}

// ── compute total ripple z-displacement for a single node ────────────────────
// For each active ripple, compute:
//   z += peak · exp(−age/lifetime) · exp(−d²/2σ²) · sin(2π(ω·age − k·d))
// where d = grid distance from this node to the ripple's BMU.
// The sin() creates an expanding ring wave; the Gaussians shape the envelope.
function rippleZ(
  col: number, row: number,
  ripples: Ripple[], fc: number,
  zScale: number,
  speedMul: number
): number {
  let total = 0;
  const TWO_PI = 2 * Math.PI;
  const waveW = RIPPLE_WAVE_W * speedMul;   // animation speed scales wave tempo
  for (let r = 0; r < ripples.length; r++) {
    const rip = ripples[r];
    const age = fc - rip.birth;
    if (age < 0 || age > RIPPLE_LIFETIME) continue;

    // grid distance from this node to the BMU
    const dr = row - rip.bmuRow;
    const dc = col - rip.bmuCol;
    const d = Math.sqrt(dr * dr + dc * dc);

    // temporal decay envelope — gentle exponential falloff
    const decay = Math.exp(-age / (RIPPLE_LIFETIME * 0.4));

    // expanding Gaussian spatial envelope
    const sigma = RIPPLE_SPREAD0 + age * RIPPLE_EXPAND;
    const spatial = Math.exp(-(d * d) / (2 * sigma * sigma));

    // travelling wave: sin(ω·age − k·d) creates expanding rings
    const wave = Math.sin(TWO_PI * (waveW * age - RIPPLE_WAVE_K * d));

    total += rip.peak * decay * spatial * wave * zScale;
  }
  return total;
}

// ── 3-D scene renderer ───────────────────────────────────────────────────────
function drawScene(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  nodes: SOMNode[],
  rotX: number, rotY: number,
  p: SOMParams,
  zoom: number,
  ripples: Ripple[],
  fc: number
) {
  const W = canvas.width, H = canvas.height, dim = Math.min(W, H);
  const cx = W / 2, cy = H / 2;
  const gW = Math.max(2, Math.round(Math.sqrt(nodes.length)));
  const gH = gW;
  const gridSz = dim * 0.42 * zoom;
  const dispSz = dim * 0.07 * zoom;
  const zSz    = dim * 0.22;
  const fov    = dim * 1.1;
  const dpr    = devicePixelRatio;
  const zScale = (p.zScale ?? 1.0) * zSz * 4;   // gentle ripple amplifier

  // Clear canvas to transparent so the CSS radial gradient shows through
  ctx.clearRect(0, 0, W, H);

  const cosX = Math.cos(rotX), sinX = Math.sin(rotX);
  const cosY = Math.cos(rotY), sinY = Math.sin(rotY);

  // ── project all nodes ──
  const pts = nodes.map((n, i) => {
    const col = i % gW, row = Math.floor(i / gW);

    const gx = (col / (gW - 1) - 0.5) * gridSz + (n.weights[0] - 0.5) * dispSz;
    const gy = (row / (gH - 1) - 0.5) * gridSz + (n.weights[1] - 0.5) * dispSz;

    // Z = weight-depth + sum of all active BMU ripples
    const speedMul = p.animationSpeed ?? 1.0;
    const rZ = rippleZ(col, row, ripples, fc, zScale, speedMul);
    const gz = (n.weights[2] - 0.5) * zSz + rZ;

    // rotate Y then X
    const x1 =  gx * cosY + gz * sinY;
    const z1 = -gx * sinY + gz * cosY;
    const y2 =  gy * cosX - z1 * sinX;
    const z2 =  gy * sinX + z1 * cosX;

    const scale = fov / Math.max(8, fov + z2);
    const [r, g, b] = wColor(n.weights);
    // ripple intensity for glow effect
    const rIntensity = Math.min(1.0, Math.abs(rZ) / (zSz * 0.08));
    return { sx: cx + x1 * scale, sy: cy + y2 * scale, scale, depth: z2, r, g, b, i, rIntensity };
  });

  // ── connections ──
  ctx.lineWidth = 0.6 * dpr;
  for (let row = 0; row < gH; row++) {
    for (let col = 0; col < gW; col++) {
      const a = pts[row * gW + col];
      const alpha = Math.max(0.12, Math.min(0.45, 0.15 + a.scale * 0.30));
      ctx.strokeStyle = `rgba(${a.r},${a.g},${a.b},${alpha})`;
      if (col < gW - 1) {
        const b = pts[row * gW + col + 1];
        ctx.beginPath(); ctx.moveTo(a.sx, a.sy); ctx.lineTo(b.sx, b.sy); ctx.stroke();
      }
      if (row < gH - 1) {
        const b = pts[(row + 1) * gW + col];
        ctx.beginPath(); ctx.moveTo(a.sx, a.sy); ctx.lineTo(b.sx, b.sy); ctx.stroke();
      }
      const dAlpha = alpha * 0.45;
      ctx.strokeStyle = `rgba(${a.r},${a.g},${a.b},${dAlpha})`;
      if (col < gW - 1 && row < gH - 1) {
        const b = pts[(row + 1) * gW + col + 1];
        ctx.beginPath(); ctx.moveTo(a.sx, a.sy); ctx.lineTo(b.sx, b.sy); ctx.stroke();
      }
      if (col > 0 && row < gH - 1) {
        const b = pts[(row + 1) * gW + col - 1];
        ctx.beginPath(); ctx.moveTo(a.sx, a.sy); ctx.lineTo(b.sx, b.sy); ctx.stroke();
      }
    }
  }

  // ── particles: depth-sorted ──
  const order = Array.from({ length: nodes.length }, (_, i) => i)
    .sort((a, b) => pts[b].depth - pts[a].depth);

  ctx.shadowBlur = 10 * dpr;
  for (const i of order) {
    const pt = pts[i];
    // nodes being rippled glow brighter
    const boost = 1.0 + pt.rIntensity * 0.6;
    const radius = Math.max(0.5, 2.2 * pt.scale * Math.pow(zoom, 0.6) * boost) * dpr;
    const alpha  = Math.max(0.25, Math.min(1, pt.scale * 0.9 + 0.1));
    ctx.shadowColor = `rgba(${pt.r},${pt.g},${pt.b},${alpha * 0.55 * boost})`;
    ctx.fillStyle   = `rgba(${pt.r},${pt.g},${pt.b},${Math.min(1, alpha * boost)})`;
    ctx.beginPath();
    ctx.arc(pt.sx, pt.sy, radius, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.shadowBlur = 0;
  ctx.shadowColor = "transparent";
}

// ── component ─────────────────────────────────────────────────────────────────
const SOMCanvas = ({ params, resetKey }: SOMCanvasProps) => {
  const canvasRef  = useRef<HTMLCanvasElement>(null);
  const animRef    = useRef<number>(0);
  const paramsRef  = useRef(params); paramsRef.current = params;

  const dispRef    = useRef<SOMNode[]>([]);
  const remoteRef  = useRef<SOMNode[]>([]);
  const ripplesRef = useRef<Ripple[]>([]);   // ring buffer of BMU ripple events
  const fcRef      = useRef(0);              // frame counter for ripple timing

  const [status, setStatus] = useState<"loading" | "live" | "error">("loading");

  const rot  = useRef({ x: -0.25, y: 0.45, tx: -0.25, ty: 0.45 });
  const drag = useRef({ down: false, lx: 0, ly: 0, rx0: 0, ry0: 0 });
  const zoomRef = useRef(1.0);
  const zoomTgt = useRef(1.0);

  // ── sync params → backend ─────────────────────────────────────────────
  useEffect(() => {
    setStatus("loading");
    ripplesRef.current = [];   // clear ripples on reset
    remoteSetParams(params)
      .then(() => remoteReset())
      .then(() => { remoteRef.current = []; dispRef.current = []; setStatus("live"); })
      .catch(() => setStatus("error"));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey, params.learningRate, params.neighborhoodRadius, params.epochs, params.gridSize]);

  // ── polling loop — pushes BMU ripples on each step response ────────────
  useEffect(() => {
    let alive = true;
    (async () => {
      while (alive) {
        try {
          const n = Math.max(1, Math.round((paramsRef.current.animationSpeed ?? 1) * 3));
          const r = await remoteStep(n);
          remoteRef.current = r.nodes;

          // spawn a ripple from the real BMU
          const peakDelta = Math.max(...r.delta, 0);
          if (peakDelta > 0.0001) {
            const ripples = ripplesRef.current;
            ripples.push({
              bmuRow: r.bmu[0],
              bmuCol: r.bmu[1],
              birth: fcRef.current,
              peak: peakDelta,
            });
            // prune: keep only the most recent RIPPLE_MAX entries
            if (ripples.length > RIPPLE_MAX) {
              ripplesRef.current = ripples.slice(-RIPPLE_MAX);
            }
          }

          setStatus("live");
        } catch { setStatus("error"); }
        await new Promise(res => setTimeout(res, 100));
      }
    })();
    return () => { alive = false; };
  }, [resetKey]);

  // ── drag + zoom ───────────────────────────────────────────────────────
  useEffect(() => {
    const PI = Math.PI;
    const cx = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

    const onDown = (e: MouseEvent) => {
      drag.current = { down: true, lx: e.clientX, ly: e.clientY, rx0: rot.current.tx, ry0: rot.current.ty };
      document.body.style.cursor = "grabbing";
    };
    const onMove = (e: MouseEvent) => {
      if (!drag.current.down) return;
      rot.current.ty = cx(drag.current.ry0 + (e.clientX - drag.current.lx) * 0.006, -PI, PI);
      rot.current.tx = cx(drag.current.rx0 - (e.clientY - drag.current.ly) * 0.006, -PI * 0.55, PI * 0.55);
    };
    const onUp = () => { drag.current.down = false; document.body.style.cursor = ""; };

    const onTD = (e: TouchEvent) => {
      const t = e.touches[0];
      drag.current = { down: true, lx: t.clientX, ly: t.clientY, rx0: rot.current.tx, ry0: rot.current.ty };
    };
    const onTM = (e: TouchEvent) => {
      if (!drag.current.down) return;
      const t = e.touches[0];
      rot.current.ty = cx(drag.current.ry0 + (t.clientX - drag.current.lx) * 0.006, -PI, PI);
      rot.current.tx = cx(drag.current.rx0 - (t.clientY - drag.current.ly) * 0.006, -PI * 0.55, PI * 0.55);
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const factor = e.deltaY > 0 ? 0.91 : 1 / 0.91;
      zoomTgt.current = Math.max(0.2, Math.min(6.0, zoomTgt.current * factor));
    };

    window.addEventListener("mousedown", onDown);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    window.addEventListener("touchstart", onTD, { passive: true });
    window.addEventListener("touchmove",  onTM, { passive: true });
    window.addEventListener("touchend",   onUp);
    window.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      window.removeEventListener("touchstart", onTD);
      window.removeEventListener("touchmove",  onTM);
      window.removeEventListener("touchend",   onUp);
      window.removeEventListener("wheel", onWheel);
    };
  }, []);

  // ── RAF render loop ───────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;

    const resize = () => {
      canvas.width  = window.innerWidth  * devicePixelRatio;
      canvas.height = window.innerHeight * devicePixelRatio;
      canvas.style.width  = window.innerWidth  + "px";
      canvas.style.height = window.innerHeight + "px";
    };
    resize();
    window.addEventListener("resize", resize);

    const render = () => {
      const r = rot.current;
      r.x += (r.tx - r.x) * ROT_LERP;
      r.y += (r.ty - r.y) * ROT_LERP;
      zoomRef.current += (zoomTgt.current - zoomRef.current) * ZOOM_LERP;

      const tgt = remoteRef.current;
      if (tgt.length > 0) {
        dispRef.current = lerpNodes(dispRef.current, tgt, DISP_LERP);
        // prune expired ripples (older than RIPPLE_LIFETIME frames)
        const fc = fcRef.current;
        ripplesRef.current = ripplesRef.current.filter(rp => fc - rp.birth <= RIPPLE_LIFETIME);
        drawScene(ctx, canvas, dispRef.current, r.x, r.y, paramsRef.current, zoomRef.current, ripplesRef.current, fc);
      }
      fcRef.current++;
      animRef.current = requestAnimationFrame(render);
    };

    animRef.current = requestAnimationFrame(render);
    return () => {
      cancelAnimationFrame(animRef.current);
      window.removeEventListener("resize", resize);
    };
  }, [resetKey]);

  return (
    <div className="fixed inset-0 w-full h-full" style={{ cursor: "grab" }}>
      <canvas ref={canvasRef} className="fixed inset-0 w-full h-full" />

      <div className="fixed bottom-6 left-6 z-50 pointer-events-none">
        <p className="text-sm tracking-widest uppercase text-foreground/60 font-semibold">
          drag to rotate · scroll to zoom · C controls · M math
        </p>
      </div>
    </div>
  );
};

export default SOMCanvas;
