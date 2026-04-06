import { useRef, useEffect, useState, useCallback } from "react";
import anime from "animejs";
import { SOMParams } from "@/lib/som";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { RotateCcw } from "lucide-react";

interface ControlPanelProps {
  params: SOMParams;
  onChange: (params: SOMParams) => void;
  onReset: () => void;
}

const ControlPanel = ({ params, onChange, onReset }: ControlPanelProps) => {
  const panelRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [hovered, setHovered] = useState(false);

  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout>;
    const handleMove = (e: MouseEvent) => {
      const near = e.clientX > window.innerWidth - 420 && e.clientY > window.innerHeight - 500;
      if (near) { setVisible(true); clearTimeout(timeout); }
      else if (!hovered) { clearTimeout(timeout); timeout = setTimeout(() => setVisible(false), 2000); }
    };
    const handleKey = (e: KeyboardEvent) => { if (e.key === "c" || e.key === "C") setVisible(v => !v); };
    window.addEventListener("mousemove", handleMove);
    window.addEventListener("keydown", handleKey);
    setVisible(true);
    timeout = setTimeout(() => setVisible(false), 3000);
    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("keydown", handleKey);
      clearTimeout(timeout);
    };
  }, [hovered]);

  useEffect(() => {
    if (!panelRef.current) return;
    anime({ targets: panelRef.current, opacity: visible ? 1 : 0, translateY: visible ? 0 : 20,
      scale: visible ? 1 : 0.97, duration: 400, easing: "easeOutCubic" });
  }, [visible]);

  const update = useCallback(
    (key: keyof SOMParams, value: number) => onChange({ ...params, [key]: value }),
    [params, onChange]
  );

  return (
    <div
      ref={panelRef}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="fixed bottom-6 right-6 z-50 p-6 w-80 opacity-0 glass-panel flex flex-col transition-all duration-400 ease-out"
      style={{ pointerEvents: visible ? "auto" : "none" }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <span className="text-xs font-medium tracking-wider text-foreground/90 uppercase">Parameters</span>
        <span className="control-label animate-breathe">Press C to toggle</span>
      </div>
      <div className="space-y-5">
        {/* Grid Size — resizes + resets the SOM */}
        <div className="space-y-2">
          <div className="flex justify-between items-baseline">
            <span className="control-label">Grid Size</span>
            <span className="text-xs text-foreground/50 tabular-nums">
              {params.gridSize ?? 20} × {params.gridSize ?? 20}
              <span className="text-foreground/30 ml-1">
                ({((params.gridSize ?? 20) ** 2).toLocaleString()} nodes)
              </span>
            </span>
          </div>
          <Slider value={[params.gridSize ?? 20]} onValueChange={([v]) => update("gridSize", v)}
            min={5} max={40} step={1} className="w-full"/>
          <p className="text-xs text-foreground/50 pl-0.5">Changing grid size resets training</p>
        </div>

        {/* Learning Rate */}
        <div className="space-y-2">
          <div className="flex justify-between">
            <span className="control-label">Learning Rate</span>
            <span className="text-xs text-foreground/50 tabular-nums">{params.learningRate.toFixed(3)}</span>
          </div>
          <Slider value={[params.learningRate]} onValueChange={([v]) => update("learningRate", v)}
            min={0.001} max={0.5} step={0.001} className="w-full"/>
        </div>

        {/* Neighborhood Radius */}
        <div className="space-y-2">
          <div className="flex justify-between">
            <span className="control-label">Neighborhood Radius</span>
            <span className="text-xs text-foreground/50 tabular-nums">{params.neighborhoodRadius.toFixed(1)}</span>
          </div>
          <Slider value={[params.neighborhoodRadius]} onValueChange={([v]) => update("neighborhoodRadius", v)}
            min={0.5} max={10} step={0.1} className="w-full"/>
        </div>

        {/* Animation Speed */}
        <div className="space-y-2">
          <div className="flex justify-between">
            <span className="control-label">Animation Speed</span>
            <span className="text-xs text-foreground/50 tabular-nums">{params.animationSpeed.toFixed(1)}</span>
          </div>
          <Slider value={[params.animationSpeed]} onValueChange={([v]) => update("animationSpeed", v)}
            min={0.1} max={5} step={0.1} className="w-full"/>
        </div>

        {/* BMU Dynamics — controls visual amplification of real training signal */}
        <div className="pt-2 border-t border-border/20 space-y-4">
          <span className="text-[10px] tracking-widest uppercase text-foreground/50">BMU Dynamics</span>

          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="control-label">Z Scale</span>
              <span className="text-xs text-foreground/50 tabular-nums">{(params.zScale ?? 1.0).toFixed(1)}×</span>
            </div>
            <Slider value={[params.zScale ?? 1.0]} onValueChange={([v]) => update("zScale", v)}
              min={0} max={5} step={0.1} className="w-full"/>
            <p className="text-xs text-foreground/50 pl-0.5">Amplifies real ‖Δwᵢ‖ from neighbourhood updates</p>
          </div>
        </div>

        <Button variant="outline" size="sm" onClick={onReset}
          className="w-full mt-2 text-xs border-border/50 hover:border-primary/30 hover:bg-primary/5 transition-all duration-300">
          <RotateCcw className="w-3 h-3 mr-2"/>Reset
        </Button>
      </div>
    </div>
  );
};

export default ControlPanel;
