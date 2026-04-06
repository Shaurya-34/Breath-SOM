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

  // Show panel on mouse move near bottom-right or on key press
  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout>;
    const handleMove = (e: MouseEvent) => {
      const nearCorner = e.clientX > window.innerWidth - 400 && e.clientY > window.innerHeight - 350;
      if (nearCorner) {
        setVisible(true);
        clearTimeout(timeout);
      } else if (!hovered) {
        clearTimeout(timeout);
        timeout = setTimeout(() => setVisible(false), 2000);
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "c" || e.key === "C") setVisible((v) => !v);
    };
    window.addEventListener("mousemove", handleMove);
    window.addEventListener("keydown", handleKey);
    // Show initially then fade
    setVisible(true);
    timeout = setTimeout(() => setVisible(false), 3000);
    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("keydown", handleKey);
      clearTimeout(timeout);
    };
  }, [hovered]);

  // Animate panel in/out with anime.js
  useEffect(() => {
    if (!panelRef.current) return;
    anime({
      targets: panelRef.current,
      opacity: visible ? 1 : 0,
      translateY: visible ? 0 : 20,
      scale: visible ? 1 : 0.97,
      duration: 400,
      easing: "easeOutCubic",
    });
  }, [visible]);

  const update = useCallback(
    (key: keyof SOMParams, value: number) => {
      onChange({ ...params, [key]: value });
    },
    [params, onChange]
  );

  return (
    <div
      ref={panelRef}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="fixed bottom-6 right-6 z-50 p-5 w-72 opacity-0 bg-card/90 border border-border/50 rounded-xl"
      style={{ pointerEvents: visible ? "auto" : "none" }}
    >
      <div className="flex items-center justify-between mb-5">
        <span className="text-xs font-medium tracking-wider text-foreground/70 uppercase">
          Parameters
        </span>
        <span className="control-label animate-breathe">Press C to toggle</span>
      </div>

      <div className="space-y-5">
        <div className="space-y-2">
          <div className="flex justify-between">
            <span className="control-label">Learning Rate</span>
            <span className="text-xs text-foreground/50 tabular-nums">
              {params.learningRate.toFixed(3)}
            </span>
          </div>
          <Slider
            value={[params.learningRate]}
            onValueChange={([v]) => update("learningRate", v)}
            min={0.001}
            max={0.5}
            step={0.001}
            className="w-full"
          />
        </div>

        <div className="space-y-2">
          <div className="flex justify-between">
            <span className="control-label">Neighborhood Radius</span>
            <span className="text-xs text-foreground/50 tabular-nums">
              {params.neighborhoodRadius.toFixed(1)}
            </span>
          </div>
          <Slider
            value={[params.neighborhoodRadius]}
            onValueChange={([v]) => update("neighborhoodRadius", v)}
            min={0.5}
            max={10}
            step={0.1}
            className="w-full"
          />
        </div>

        <div className="space-y-2">
          <div className="flex justify-between">
            <span className="control-label">Animation Speed</span>
            <span className="text-xs text-foreground/50 tabular-nums">
              {params.animationSpeed.toFixed(1)}
            </span>
          </div>
          <Slider
            value={[params.animationSpeed]}
            onValueChange={([v]) => update("animationSpeed", v)}
            min={0.1}
            max={5}
            step={0.1}
            className="w-full"
          />
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={onReset}
          className="w-full mt-2 text-xs border-border/50 hover:border-primary/30 hover:bg-primary/5 transition-all duration-300"
        >
          <RotateCcw className="w-3 h-3 mr-2" />
          Reset
        </Button>
      </div>
    </div>
  );
};

export default ControlPanel;
