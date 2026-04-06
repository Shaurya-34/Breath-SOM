import { useRef, useEffect, useCallback } from "react";
import { SelfOrganizingMap, SOMParams } from "@/lib/som";

interface SOMCanvasProps {
  params: SOMParams;
  resetKey: number;
}

const GRID = 28;

// Palette: map weights to a harmonious teal/blue/violet palette
function weightToColor(w: number[]): [number, number, number] {
  // Map [0,1]^3 weights through a curated palette
  const h = 170 + w[0] * 80; // hue 170-250 (teal to blue-violet)
  const s = 40 + w[1] * 40;  // saturation 40-80%
  const l = 25 + w[2] * 45;  // lightness 25-70%
  return hslToRgb(h / 360, s / 100, l / 100);
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  let r: number, g: number, b: number;
  if (s === 0) {
    r = g = b = l;
  } else {
    const hue2rgb = (p: number, q: number, t: number) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }
  return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}

const SOMCanvas = ({ params, resetKey }: SOMCanvasProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const somRef = useRef<SelfOrganizingMap | null>(null);
  const animRef = useRef<number>(0);
  const paramsRef = useRef(params);
  paramsRef.current = params;

  const initSOM = useCallback(() => {
    somRef.current = new SelfOrganizingMap(GRID, GRID, { ...paramsRef.current });
  }, []);

  useEffect(() => {
    initSOM();
  }, [resetKey, initSOM]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;

    const resize = () => {
      canvas.width = window.innerWidth * devicePixelRatio;
      canvas.height = window.innerHeight * devicePixelRatio;
      canvas.style.width = window.innerWidth + "px";
      canvas.style.height = window.innerHeight + "px";
    };
    resize();
    window.addEventListener("resize", resize);

    const render = () => {
      const som = somRef.current;
      if (!som) { animRef.current = requestAnimationFrame(render); return; }

      // Sync params
      som.params = { ...paramsRef.current };

      // Steps per frame based on animation speed
      const steps = Math.max(1, Math.round(paramsRef.current.animationSpeed * 5));
      som.stepN(steps);

      const w = canvas.width;
      const h = canvas.height;
      const dim = Math.min(w, h);
      const ox = (w - dim) / 2;
      const oy = (h - dim) / 2;
      const margin = dim * 0.08;
      const innerDim = dim - margin * 2;

      ctx.fillStyle = "#0a0a0a";
      ctx.fillRect(0, 0, w, h);

      const nodes = som.nodes;
      const gw = som.gridWidth;
      const gh = som.gridHeight;
      const cellW = innerDim / (gw - 1);
      const cellH = innerDim / (gh - 1);

      // Draw connections (subtle lines)
      ctx.lineWidth = 0.8 * devicePixelRatio;
      for (let y = 0; y < gh; y++) {
        for (let x = 0; x < gw; x++) {
          const idx = y * gw + x;
          const node = nodes[idx];
          const px = ox + margin + node.weights[0] * innerDim * 0.3 + x * cellW * 0.7;
          const py = oy + margin + node.weights[1] * innerDim * 0.3 + y * cellH * 0.7;

          if (x < gw - 1) {
            const ni = nodes[idx + 1];
            const npx = ox + margin + ni.weights[0] * innerDim * 0.3 + (x + 1) * cellW * 0.7;
            const npy = oy + margin + ni.weights[1] * innerDim * 0.3 + y * cellH * 0.7;
            const [r, g, b] = weightToColor(node.weights);
            ctx.strokeStyle = `rgba(${r},${g},${b},0.15)`;
            ctx.beginPath();
            ctx.moveTo(px, py);
            ctx.lineTo(npx, npy);
            ctx.stroke();
          }
          if (y < gh - 1) {
            const ni = nodes[idx + gw];
            const npx = ox + margin + ni.weights[0] * innerDim * 0.3 + x * cellW * 0.7;
            const npy = oy + margin + ni.weights[1] * innerDim * 0.3 + (y + 1) * cellH * 0.7;
            const [r, g, b] = weightToColor(node.weights);
            ctx.strokeStyle = `rgba(${r},${g},${b},0.15)`;
            ctx.beginPath();
            ctx.moveTo(px, py);
            ctx.lineTo(npx, npy);
            ctx.stroke();
          }
        }
      }

      // Draw nodes with glow
      for (let y = 0; y < gh; y++) {
        for (let x = 0; x < gw; x++) {
          const idx = y * gw + x;
          const node = nodes[idx];
          const px = ox + margin + node.weights[0] * innerDim * 0.3 + x * cellW * 0.7;
          const py = oy + margin + node.weights[1] * innerDim * 0.3 + y * cellH * 0.7;
          const [r, g, b] = weightToColor(node.weights);
          const radius = 2.5 * devicePixelRatio;

          // Soft glow
          const gradient = ctx.createRadialGradient(px, py, 0, px, py, radius * 4);
          gradient.addColorStop(0, `rgba(${r},${g},${b},0.3)`);
          gradient.addColorStop(1, `rgba(${r},${g},${b},0)`);
          ctx.fillStyle = gradient;
          ctx.fillRect(px - radius * 4, py - radius * 4, radius * 8, radius * 8);

          // Core dot
          ctx.fillStyle = `rgb(${r},${g},${b})`;
          ctx.beginPath();
          ctx.arc(px, py, radius, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      animRef.current = requestAnimationFrame(render);
    };

    animRef.current = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animRef.current);
      window.removeEventListener("resize", resize);
    };
  }, [resetKey]);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 w-full h-full"
      style={{ background: "#0a0a0a" }}
    />
  );
};

export default SOMCanvas;
