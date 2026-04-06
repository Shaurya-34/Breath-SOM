// som.ts – remote-only helpers (Python backend)
export interface SOMParams {
  learningRate: number;
  neighborhoodRadius: number;
  animationSpeed: number;
  epochs?: number;
  gridSize?: number;
  zScale?: number;        // visual amplification of real ‖Δw‖ z-displacement
}

export interface SOMNode {
  x: number;
  y: number;
  weights: number[];
  delta: number;          // ‖Δw‖ from the last training step (real, not cosmetic)
}

export const API_BASE = "";   // empty → uses Vite proxy (/api/*)

export interface RemoteStepResult {
  iteration: number;
  nodes: SOMNode[];
  bmu: [number, number];   // [row, col] of the last BMU
  delta: number[];         // per-node ‖Δw‖ flat array
}

export async function remoteStep(n: number): Promise<RemoteStepResult> {
  const res = await fetch(`${API_BASE}/api/step`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ n }),
  });
  if (!res.ok) throw new Error(`/api/step ${res.status}`);
  const data = await res.json();
  // merge delta into each node so downstream code has it on the node object
  const nodes: SOMNode[] = (data.nodes as Array<{ x: number; y: number; weights: number[] }>).map((nd, i) => ({
    ...nd,
    delta: data.delta?.[i] ?? 0,
  }));
  return { iteration: data.iteration, nodes, bmu: data.bmu ?? [0, 0], delta: data.delta ?? [] };
}

export async function remoteReset(): Promise<void> {
  await fetch(`${API_BASE}/api/reset`, { method: "POST" });
}

export async function remoteSetParams(p: SOMParams): Promise<void> {
  await fetch(`${API_BASE}/api/params`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      learning_rate:        p.learningRate,
      neighborhood_radius:  p.neighborhoodRadius,
      epochs:               p.epochs ?? 100,
      grid_size:            p.gridSize ?? 20,
    }),
  });
}
