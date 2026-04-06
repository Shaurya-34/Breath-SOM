import numpy as np


class SelfOrganizingMap:
    def __init__(self, input_dim, grid_size, learning_rate=0.1, radius=None, epochs=100):
        self.input_dim = input_dim
        self.grid_size = grid_size
        self.initial_lr = learning_rate
        self.learning_rate = learning_rate
        self.epochs = epochs
        self.initial_radius = radius if radius else max(grid_size) / 2
        self.radius = self.initial_radius

        self.grid_i, self.grid_j = np.indices((grid_size[0], grid_size[1]))
        self.weights = np.random.rand(grid_size[0], grid_size[1], input_dim)

    def find_bmu(self, sample):
        distances = np.linalg.norm(self.weights - sample, axis=2)
        return np.unravel_index(np.argmin(distances), distances.shape)

    def update_weights(self, sample, bmu):
        dist_sq = (self.grid_i - bmu[0]) ** 2 + (self.grid_j - bmu[1]) ** 2
        influence = np.exp(-dist_sq / (2 * (self.radius ** 2)))
        influence = influence[:, :, np.newaxis]
        self.weights += self.learning_rate * influence * (sample - self.weights)

    def step(self, iteration: int, total_iterations: int):
        """Perform a single training step with exponential decay.
        Returns (bmu, delta) where:
          bmu   = (row, col) grid index of the Best Matching Unit
          delta = (gH, gW) array of per-node weight-change norms ‖Δwᵢ‖₂
                  This is the neighbourhood update magnitude — highest at BMU,
                  decaying with the Gaussian h(i,BMU,t). NOT cosmetic.
        """
        sample = np.random.rand(self.input_dim)
        decay = np.exp(-iteration / total_iterations)
        self.learning_rate = self.initial_lr * decay
        self.radius = self.initial_radius * decay
        bmu = self.find_bmu(sample)
        prev = self.weights.copy()           # snapshot before update
        self.update_weights(sample, bmu)
        delta = np.linalg.norm(self.weights - prev, axis=2)   # (gH, gW)
        return bmu, delta

    def train(self, data, epochs=None):
        """Train the SOM on data, returning a list of weight snapshots per epoch."""
        if epochs is None:
            epochs = self.epochs
        total_iterations = epochs * len(data)
        iteration = 0
        frames = []

        for epoch in range(epochs):
            np.random.shuffle(data)
            for sample in data:
                decay = np.exp(-iteration / total_iterations)
                self.learning_rate = self.initial_lr * decay
                self.radius = self.initial_radius * decay
                bmu = self.find_bmu(sample)
                self.update_weights(sample, bmu)
                iteration += 1
            frames.append(self.weights.copy())

        return frames

    def get_weights_flat(self):
        """Return weights as a flat list of [r, g, b] for JSON serialisation."""
        h, w, _ = self.weights.shape
        result = []
        for j in range(h):
            for i in range(w):
                result.append({
                    "x": i / (w - 1) if w > 1 else 0,
                    "y": j / (h - 1) if h > 1 else 0,
                    "weights": self.weights[j, i].tolist(),
                })
        return result

