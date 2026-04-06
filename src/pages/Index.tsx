import { useState, useCallback } from "react";
import SOMCanvas from "@/components/SOMCanvas";
import ControlPanel from "@/components/ControlPanel";
import { SOMParams } from "@/lib/som";

const DEFAULT_PARAMS: SOMParams = {
  learningRate: 0.1,
  neighborhoodRadius: 3,
  animationSpeed: 1,
};

const Index = () => {
  const [params, setParams] = useState<SOMParams>(DEFAULT_PARAMS);
  const [resetKey, setResetKey] = useState(0);

  const handleReset = useCallback(() => {
    setResetKey((k) => k + 1);
    setParams(DEFAULT_PARAMS);
  }, []);

  return (
    <div className="relative w-screen h-screen overflow-hidden" style={{ background: "#0a0a0a" }}>
      <SOMCanvas params={params} resetKey={resetKey} />

      {/* Title watermark */}
      <div className="fixed top-6 left-6 z-40 pointer-events-none">
        <h1 className="text-sm font-medium tracking-[0.2em] uppercase text-foreground/20">
          Self-Organizing Map
        </h1>
        <p className="text-[10px] tracking-wider text-muted-foreground/30 mt-1">
          Generative Topology
        </p>
      </div>

      {/* Iteration counter */}
      <div className="fixed top-6 right-6 z-40 pointer-events-none">
        <p className="text-[10px] tracking-wider text-muted-foreground/25 tabular-nums">
          Real-time
        </p>
      </div>

      <ControlPanel params={params} onChange={setParams} onReset={handleReset} />
    </div>
  );
};

export default Index;
