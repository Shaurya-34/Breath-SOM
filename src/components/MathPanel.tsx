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
  dataset_type?: string;
  input_dim: number;
  data_size: number;
}

const Eq = ({ label, children, note }: { label: string; children: React.ReactNode; note: string }) => (
  <div className="space-y-1">
    <span className="text-[10px] font-semibold tracking-wider uppercase text-foreground/40">{label}</span>
    <div className="px-3.5 py-2.5 rounded-lg bg-white/[0.04] border border-white/10 font-mono text-xs text-foreground/90 leading-relaxed tracking-wide shadow-sm">
      {children}
    </div>
    <p className="text-[10px] text-foreground/45 leading-snug pl-0.5">{note}</p>
  </div>
);

const Live = ({ label, value, highlight = false }: { label: string; value: string; highlight?: boolean }) => (
  <div className="flex flex-col gap-0.5 px-3.5 py-2 rounded-lg bg-white/[0.03] border border-white/10 shadow-sm">
    <span className="text-[9px] font-medium tracking-wider uppercase text-foreground/40">{label}</span>
    <span className={`text-sm font-mono font-semibold tabular-nums ${highlight ? "text-emerald-400" : "text-foreground/80"}`}>
      {value}
    </span>
  </div>
);

const Section = ({ title }: { title: string }) => (
  <div className="flex items-center gap-3 pt-2">
    <span className="text-[10px] font-bold tracking-widest uppercase text-foreground/50 whitespace-nowrap">{title}</span>
    <div className="flex-1 h-px bg-white/10" />
  </div>
);

const MathPanel = () => {
  const panelRef  = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [stats,   setStats]   = useState<Stats | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "m" || e.key === "M") setVisible(v => !v);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!panelRef.current || !overlayRef.current) return;
    anime({
      targets: panelRef.current,
      translateX: visible ? 0 : -420,
      opacity: visible ? 1 : 0,
      duration: 400,
      easing: "easeOutQuart",
    });
    anime({
      targets: overlayRef.current,
      opacity: visible ? 1 : 0,
      duration: 350,
      easing: "easeOutCubic",
    });
  }, [visible]);

  useEffect(() => {
    if (!visible) return;
    let alive = true;
    (async () => {
      while (alive) {
        try {
          const r = await fetch("/api/stats");
          if (r.ok) setStats(await r.json());
        } catch { /* backend unreachable */ }
        await new Promise(res => setTimeout(res, 300));
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
      <div
        ref={overlayRef}
        className="fixed inset-0 z-30 opacity-0 pointer-events-none"
        style={{ background: "rgba(0,0,0,0.45)", pointerEvents: visible ? "auto" : "none" }}
        onClick={() => setVisible(false)}
      />

      <div
        ref={panelRef}
        className="fixed top-0 left-0 z-40 h-full w-[400px] opacity-0 overflow-hidden"
        style={{ transform: "translateX(-420px)", pointerEvents: visible ? "auto" : "none" }}
      >
        <div className="h-full w-full bg-[#070b14] border-r border-border/50 shadow-2xl overflow-y-auto">
          <div className="p-6 space-y-6">

            <div className="space-y-1 border-b border-white/10 pb-4">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold tracking-wider text-foreground">
                  SOM Mathematics & Live Analysis
                </h2>
                <button
                  onClick={() => setVisible(false)}
                  className="text-xs text-foreground/40 hover:text-foreground/80 transition-colors tracking-widest uppercase font-mono"
                >
                  ESC / M
                </button>
              </div>
              <p className="text-xs tracking-wider text-foreground/40">
                Self-Organizing Map calculus & real-time training telemetry
              </p>
            </div>

            <Section title="Live Training State" />

            {stats ? (
              <>
                <div className="space-y-2 p-3 rounded-lg bg-white/[0.02] border border-white/10">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-semibold tracking-wider uppercase text-foreground/60">Training Progress</span>
                    <span className="text-xs font-mono font-bold text-emerald-400">{pct}%</span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-white/10 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-emerald-400 transition-all duration-300"
                      style={{ width: `${Math.max(2, stats.progress)}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[10px] text-foreground/40 font-mono">
                    <span>{stats.iteration.toLocaleString()} steps</span>
                    <span>Target: {T.toLocaleString()} steps</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <Live label="Learning Rate (η)" value={stats.learning_rate.toFixed(6)} highlight />
                  <Live label="Radius (σ)"         value={stats.radius.toFixed(4)}        highlight />
                  <Live label="Decay Factor"        value={stats.decay.toFixed(6)} />
                  <Live label="Iteration Step"     value={stats.iteration.toLocaleString()} />
                  <Live label="Grid Dimension"     value={`${stats.grid_size} × ${stats.grid_size}`} />
                  <Live label="Dataset Topology"    value={stats.dataset_type ?? "uniform"} />
                </div>
              </>
            ) : (
              <p className="text-xs text-foreground/40 animate-pulse">Connecting to Python telemetry stream…</p>
            )}

            <Section title="Core Competitive Learning" />

            <Eq
              label="1. Best Matching Unit (BMU)"
              note="Locates the neuron vector closest to current input sample x in Euclidean metric space."
            >
              BMU(x) = argmin<sub>i</sub> ‖<b>w</b><sub>i</sub> − <b>x</b>‖₂
            </Eq>

            <Eq
              label="2. Neighborhood Weight Update"
              note="Applies Gaussian neighborhood influence to update surrounding node weight vectors toward input sample x."
            >
              <b>w</b><sub>i</sub>(t+1) = <b>w</b><sub>i</sub>(t) + η(t) · h(i, BMU, t) · [<b>x</b> − <b>w</b><sub>i</sub>(t)]
            </Eq>

            <Eq
              label="3. Gaussian Kernel Neighborhood Function h"
              note="Spatial decay curve defining neighborhood interaction magnitude."
            >
              h(i, j, t) = exp(−d²(i, j) / (2σ²(t)))
            </Eq>

            <Section title="Exponential Parameter Decay" />

            <Eq
              label="Learning Rate Decay η(t)"
              note={`Dynamic scaling factor starting at η₀ = ${eta0}.`}
            >
              η(t) = {eta0} · exp(−t / {T || "T"})
            </Eq>

            <Eq
              label="Neighborhood Radius Decay σ(t)"
              note={`Dynamic spatial influence radius starting at σ₀ = ${sig0}.`}
            >
              σ(t) = {sig0} · exp(−t / {T || "T"})
            </Eq>

            <div className="pt-4 pb-2 border-t border-white/10 text-center">
              <p className="text-xs text-foreground/30 font-mono">
                Press <kbd className="px-1.5 py-0.5 rounded bg-white/10 text-foreground/70">M</kbd> to toggle panel
              </p>
            </div>

          </div>
        </div>
      </div>
    </>
  );
};

export default MathPanel;
