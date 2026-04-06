import { useState, useCallback } from "react";
import SOMCanvas from "@/components/SOMCanvas";
import ControlPanel from "@/components/ControlPanel";
import MathPanel from "@/components/MathPanel";
import { SOMParams } from "@/lib/som";

const DEFAULT_PARAMS: SOMParams = {
  learningRate: 0.1,
  neighborhoodRadius: 3,
  animationSpeed: 1,
  epochs: 100,
  gridSize: 20,
  zScale: 1.0,
};

const Index = () => {
  const [params, setParams] = useState<SOMParams>(DEFAULT_PARAMS);
  const [resetKey, setResetKey] = useState(0);

  const handleReset = useCallback(() => {
    setResetKey((k) => k + 1);
    setParams(DEFAULT_PARAMS);
  }, []);

  return (
    <div className="relative w-screen h-screen overflow-hidden" style={{ background: "radial-gradient(circle at 50% 50%, #0d1222 0%, #020205 100%)" }}>
      <SOMCanvas params={params} resetKey={resetKey} />

      {/* Title watermark */}
      <div className="fixed top-6 left-6 z-40 pointer-events-none">
        <h1 className="text-lg font-bold tracking-[0.2em] uppercase text-foreground/80">
          Self-Organizing Map
        </h1>
        <p className="text-sm tracking-wider text-muted-foreground/60 mt-1">
          Generative Topology
        </p>
      </div>

      <MathPanel />
      <ControlPanel params={params} onChange={setParams} onReset={handleReset} />
    </div>
  );
};

export default Index;
