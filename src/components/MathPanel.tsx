import { useRef, useEffect, useState } from "react";
import anime from "animejs";

interface Stats {
  iteration: number;
  total_iterations: number;
  progress: number;
  decay: number;
  learning_rate: number;
  radius: number;
  initial_lr: number;
  initial_radius: number;
  grid_size: number;
  input_dim: number;
  data_size: number;
}

// ── sub-components ────────────────────────────────────────────────────────────

const Eq = ({ label, children, note }: { label: string; children: React.ReactNode; note: string }) => (
  <div className="space-y-1.5">
    <span className="text-[9px] tracking-widest uppercase text-foreground/25">{label}</span>
    <div className="px-3 py-2.5 rounded-lg bg-white/[0.02] border border-white/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] font-mono text-[11px] text-foreground/80 leading-relaxed tracking-wide">
      {children}
    </div>
    <p className="text-[9px] text-foreground/30 leading-snug pl-0.5">{note}</p>
  </div>
);

const Live = ({ label, value, highlight = false }: { label: string; value: string; highlight?: boolean }) => (
  <div className="flex flex-col gap-0.5 px-3 py-2 rounded-lg bg-white/[0.02] border border-white/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
    <span className="text-[8px] tracking-widest uppercase text-foreground/25">{label}</span>
    <span className={`text-sm font-mono tabular-nums ${highlight ? "text-emerald-400/80" : "text-foreground/70"}`}>
      {value}
    </span>
  </div>
);

const Section = ({ title }: { title: string }) => (
  <div className="flex items-center gap-3 pt-1">
    <span className="text-[9px] tracking-widest uppercase text-foreground/30 whitespace-nowrap">{title}</span>
    <div className="flex-1 h-px bg-white/5" />
  </div>
);

// ── main panel ────────────────────────────────────────────────────────────────

const MathPanel = () => {
  const panelRef  = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [stats,   setStats]   = useState<Stats | null>(null);

  // toggle on 'M'
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "m" || e.key === "M") setVisible(v => !v);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // animate panel slide
  useEffect(() => {
    if (!panelRef.current || !overlayRef.current) return;
    anime({
      targets: panelRef.current,
      translateX: visible ? 0 : -420,
      opacity: visible ? 1 : 0,
      duration: 480,
      easing: "easeOutQuart",
    });
    anime({
      targets: overlayRef.current,
      opacity: visible ? 1 : 0,
      duration: 400,
      easing: "easeOutCubic",
    });
  }, [visible]);

  // poll /api/stats when visible
  useEffect(() => {
    if (!visible) return;
    let alive = true;
    (async () => {
      while (alive) {
        try {
          const r = await fetch("/api/stats");
          if (r.ok) setStats(await r.json());
        } catch { /* backend unreachable */ }
        await new Promise(res => setTimeout(res, 900));
      }
    })();
    return () => { alive = false; };
  }, [visible]);

  const pct = stats ? stats.progress.toFixed(1) : "—";
  const T   = stats?.total_iterations ?? 0;
  const eta0 = stats ? stats.initial_lr.toFixed(3) : "η₀";
  const sig0 = stats ? stats.initial_radius.toFixed(1) : "σ₀";

  return (
    <>
      {/* dim overlay — click to close */}
      <div
        ref={overlayRef}
        className="fixed inset-0 z-30 opacity-0 pointer-events-none"
        style={{ background: "rgba(0,0,0,0.35)", pointerEvents: visible ? "auto" : "none" }}
        onClick={() => setVisible(false)}
      />

      {/* panel */}
      <div
        ref={panelRef}
        className="fixed top-0 left-0 z-40 h-full w-[380px] opacity-0 overflow-hidden"
        style={{ transform: "translateX(-420px)", pointerEvents: visible ? "auto" : "none" }}
      >
        <div className="h-full w-full bg-[#050810] border-r border-border/40 shadow-2xl overflow-y-auto">
          <div className="p-6 space-y-6">

            {/* header */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-medium tracking-wider text-foreground/80">
                  SOM Mathematics
                </h2>
                <button
                  onClick={() => setVisible(false)}
                  className="text-[10px] text-foreground/30 hover:text-foreground/60 transition-colors tracking-widest uppercase"
                >
                  close
                </button>
              </div>
              <p className="text-[9px] tracking-wider text-foreground/25">
                Self-Organizing Map · equations &amp; live state
              </p>
            </div>

            {/* ── Live State ─────────────────────────────────────────── */}
            <Section title="Live State" />

            {stats ? (
              <>
                {/* progress bar */}
                <div className="space-y-1.5">
                  <div className="flex justify-between">
                    <span className="text-[9px] tracking-widest uppercase text-foreground/25">Training Progress</span>
                    <span className="text-[9px] text-emerald-400/60 tabular-nums">{pct}%</span>
                  </div>
                  <div className="h-1 w-full rounded-full bg-white/5 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-emerald-500/50 transition-all duration-700"
                      style={{ width: `${stats.progress}%` }}
                    />
                  </div>
                  <p className="text-[8px] text-foreground/20 tabular-nums">
                    {stats.iteration.toLocaleString()} / {T.toLocaleString()} steps
                  </p>
                </div>

                {/* stat grid */}
                <div className="grid grid-cols-2 gap-2">
                  <Live label="η (learning rate)" value={stats.learning_rate.toFixed(6)} highlight />
                  <Live label="σ (radius)"         value={stats.radius.toFixed(4)}        highlight />
                  <Live label="decay factor"        value={stats.decay.toFixed(6)} />
                  <Live label="iteration"           value={stats.iteration.toLocaleString()} />
                  <Live label="grid"  value={`${stats.grid_size} × ${stats.grid_size}`} />
                  <Live label="dim"   value={`${stats.input_dim}D weight space`} />
                </div>
              </>
            ) : (
              <p className="text-[9px] text-foreground/25 animate-pulse">Waiting for backend…</p>
            )}

            {/* ── Core Algorithm ─────────────────────────────────────── */}
            <Section title="Core Algorithm" />

            <Eq
              label="Best Matching Unit (BMU)"
              note="For each input x, find the grid node whose weight vector is closest in Euclidean space."
            >
              BMU(x) = argmin<sub>i</sub> ‖<b>w</b><sub>i</sub> − <b>x</b>‖₂
            </Eq>

            <Eq
              label="Weight Update Rule"
              note="Every node moves toward the current input x, scaled by how close it is to the BMU."
            >
              <b>w</b><sub>i</sub>(t+1) = <b>w</b><sub>i</sub>(t)<br />
              {"   "}+ η(t) · h(i, BMU, t) · [<b>x</b> − <b>w</b><sub>i</sub>(t)]
            </Eq>

            <Eq
              label="Neighbourhood Function h"
              note="Gaussian kernel: nodes near the BMU update more strongly than distant neighbours."
            >
              h(i, j, t) = exp(−d²(i,j) / 2σ²(t))
            </Eq>

            {/* ── Decay ─────────────────────────────────────────────── */}
            <Section title="Exponential Decay" />

            <Eq
              label="Learning Rate Decay  η(t)"
              note={`Starts at η₀ = ${eta0} and shrinks toward 0 over ${T.toLocaleString()} iterations.`}
            >
              η(t) = {eta0} · exp(−t / {T || "T"})
              <br />
              <span className="text-foreground/40">
                {"     "}= {stats ? stats.learning_rate.toFixed(6) : "…"}{" "}
                {stats ? `(at t = ${stats.iteration})` : ""}
              </span>
            </Eq>

            <Eq
              label="Neighbourhood Radius Decay  σ(t)"
              note={`Starts at σ₀ = ${sig0}. Shrinking radius forces fine topological ordering late in training.`}
            >
              σ(t) = {sig0} · exp(−t / {T || "T"})
              <br />
              <span className="text-foreground/40">
                {"     "}= {stats ? stats.radius.toFixed(4) : "…"}{" "}
                {stats ? `(at t = ${stats.iteration})` : ""}
              </span>
            </Eq>

            {/* ── BMU Dynamics ─────────────────────────────────────── */}
            <Section title="BMU Ripple Propagation" />

            <Eq
              label="Per-node weight change"
              note="Each training step produces a weight delta at every node. ‖Δwᵢ‖ is highest at the BMU and decays via the Gaussian neighbourhood."
            >
              Δwᵢ = η(t) · h(i, BMU, t) · [x − wᵢ(t)]<br />
              peak = max<sub>i</sub> ‖Δwᵢ‖₂
            </Eq>

            <Eq
              label="Ripple wave (per BMU event)"
              note="Each BMU firing spawns a ring wave at the real BMU grid position. It expands outward and decays — multiple overlapping ripples create breathing."
            >
              z<sub>i</sub> = Σ<sub>r</sub> peak<sub>r</sub> · e<sup>−age/τ</sup> · e<sup>−d²/2σ²</sup> · sin(2π(ω·age − k·d))
            </Eq>

            <Eq
              label="Ripple parameters"
              note="σ = σ₀ + age·ε (expanding Gaussian). d = grid distance from node to BMU. τ = lifetime. All centres are real BMU positions."
            >
              σ₀ = 2.5 {"  "}ε = 0.05 {"  "}(expand rate)<br />
              τ = 180 frames {"  "}(~3s lifetime)<br />
              ω = 0.035 {"  "}k = 0.20 {"  "}(wave speed/density)
            </Eq>

            {/* ── 3D Projection ─────────────────────────────────────── */}
            <Section title="3D Perspective Projection" />

            <Eq
              label="Rotation  (Y then X axis)"
              note="Applied every frame using rotation angles from mouse drag. No CSS transform — pure canvas math."
            >
              x′ = x·cos θ<sub>Y</sub> + z·sin θ<sub>Y</sub><br />
              z′ = −x·sin θ<sub>Y</sub> + z·cos θ<sub>Y</sub><br />
              y′ = y·cos θ<sub>X</sub> − z′·sin θ<sub>X</sub>
            </Eq>

            <Eq
              label="Perspective Divide"
              note="Nodes closer to the camera (smaller z″) appear larger and brighter."
            >
              scale = fov / (fov + z″)<br />
              sx = cx + x′ · scale<br />
              sy = cy + y′ · scale
            </Eq>

            {/* footer */}
            <div className="pt-4 pb-2 border-t border-white/5">
              <p className="text-[8px] text-foreground/15 leading-relaxed">
                Press <kbd className="px-1 py-0.5 rounded bg-white/5 text-foreground/30">M</kbd> to close ·
                Stats update every ~900 ms
              </p>
            </div>

          </div>
        </div>
      </div>
    </>
  );
};

export default MathPanel;
