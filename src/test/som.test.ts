import { describe, it, expect, vi, beforeEach } from 'vitest';
import { remoteStep, remoteReset, remoteSetParams, API_BASE, SOMParams } from '../lib/som';

describe('som lib', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('remoteStep should fetch step API and map node delta correctly', async () => {
    const mockResponse = {
      iteration: 5,
      nodes: [
        { x: 0, y: 0, weights: [0.1, 0.2, 0.3] },
        { x: 1, y: 1, weights: [0.4, 0.5, 0.6] }
      ],
      bmu: [0, 1],
      delta: [0.05, 0.02]
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockResponse,
    } as Response);

    const result = await remoteStep(3);

    expect(global.fetch).toHaveBeenCalledWith(`${API_BASE}/api/step`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ n: 3 }),
    });

    expect(result.iteration).toBe(5);
    expect(result.bmu).toEqual([0, 1]);
    expect(result.nodes).toHaveLength(2);
    expect(result.nodes[0].delta).toBe(0.05);
    expect(result.nodes[1].delta).toBe(0.02);
  });

  it('remoteStep should throw error on HTTP error', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
    } as Response);

    await expect(remoteStep(1)).rejects.toThrow('/api/step 500');
  });

  it('remoteReset should post to /api/reset', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
    } as Response);

    await remoteReset();

    expect(global.fetch).toHaveBeenCalledWith(`${API_BASE}/api/reset`, {
      method: 'POST',
    });
  });

  it('remoteSetParams should post parameters correctly', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
    } as Response);

    const params: SOMParams = {
      learningRate: 0.15,
      neighborhoodRadius: 2.5,
      animationSpeed: 1.5,
      epochs: 80,
      gridSize: 15,
    };

    await remoteSetParams(params);

    expect(global.fetch).toHaveBeenCalledWith(`${API_BASE}/api/params`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        learning_rate: 0.15,
        neighborhood_radius: 2.5,
        epochs: 80,
        grid_size: 15,
      }),
    });
  });
});
