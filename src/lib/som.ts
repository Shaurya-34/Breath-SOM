export interface SOMParams {
  learningRate: number;
  neighborhoodRadius: number;
  animationSpeed: number;
}

export interface SOMNode {
  x: number;
  y: number;
  weights: number[]; // [r, g, b] mapped to 2D position
}

export class SelfOrganizingMap {
  nodes: SOMNode[];
  gridWidth: number;
  gridHeight: number;
  params: SOMParams;
  iteration: number;

  constructor(gridWidth: number, gridHeight: number, params: SOMParams) {
    this.gridWidth = gridWidth;
    this.gridHeight = gridHeight;
    this.params = params;
    this.iteration = 0;
    this.nodes = [];
    this.initialize();
  }

  initialize() {
    this.nodes = [];
    this.iteration = 0;
    for (let y = 0; y < this.gridHeight; y++) {
      for (let x = 0; x < this.gridWidth; x++) {
        this.nodes.push({
          x: x / (this.gridWidth - 1),
          y: y / (this.gridHeight - 1),
          weights: [Math.random(), Math.random(), Math.random()],
        });
      }
    }
  }

  private findBMU(input: number[]): number {
    let bestIdx = 0;
    let bestDist = Infinity;
    for (let i = 0; i < this.nodes.length; i++) {
      const w = this.nodes[i].weights;
      const dist = (w[0] - input[0]) ** 2 + (w[1] - input[1]) ** 2 + (w[2] - input[2]) ** 2;
      if (dist < bestDist) {
        bestDist = dist;
        bestIdx = i;
      }
    }
    return bestIdx;
  }

  private gridDistance(i: number, j: number): number {
    const ix = i % this.gridWidth, iy = Math.floor(i / this.gridWidth);
    const jx = j % this.gridWidth, jy = Math.floor(j / this.gridWidth);
    return Math.sqrt((ix - jx) ** 2 + (iy - jy) ** 2);
  }

  step() {
    const input = [Math.random(), Math.random(), Math.random()];
    const bmuIdx = this.findBMU(input);
    const lr = this.params.learningRate;
    const radius = this.params.neighborhoodRadius;

    for (let i = 0; i < this.nodes.length; i++) {
      const dist = this.gridDistance(i, bmuIdx);
      const influence = Math.exp(-(dist * dist) / (2 * radius * radius));
      if (influence < 0.001) continue;
      const node = this.nodes[i];
      for (let d = 0; d < 3; d++) {
        node.weights[d] += lr * influence * (input[d] - node.weights[d]);
      }
    }
    this.iteration++;
  }

  stepN(n: number) {
    for (let i = 0; i < n; i++) this.step();
  }
}
