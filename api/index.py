"""
FastAPI server for Breath SOM – serves training state to the nebula-hue frontend.
"""

from __future__ import annotations

import threading
from typing import List

import numpy as np
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

# ---------------------------------------------------------------------------
# Self Organizing Map implementation
# ---------------------------------------------------------------------------

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
        sample = np.random.rand(self.input_dim)
        decay = np.exp(-iteration / total_iterations)
        self.learning_rate = self.initial_lr * decay
        self.radius = self.initial_radius * decay
        bmu = self.find_bmu(sample)
        prev = self.weights.copy()
        self.update_weights(sample, bmu)
        delta = np.linalg.norm(self.weights - prev, axis=2)
        return bmu, delta

    def train(self, data, epochs=None):
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

# ---------------------------------------------------------------------------
# App setup
# ---------------------------------------------------------------------------

app = FastAPI(title="Breath SOM API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

GRID_SIZE = 20
INPUT_DIM = 3
DATA_SIZE = 100

_lock = threading.Lock()

class TrainParams(BaseModel):
    learning_rate: float = Field(0.1, ge=0.001, le=1.0)
    neighborhood_radius: float = Field(5.0, ge=0.5, le=15.0)
    epochs: int = Field(100, ge=1, le=500)
    grid_size: int = Field(20, ge=5, le=40)

_params = TrainParams()
_som = SelfOrganizingMap(
    input_dim=INPUT_DIM,
    grid_size=(GRID_SIZE, GRID_SIZE),
    learning_rate=_params.learning_rate,
    radius=_params.neighborhood_radius,
    epochs=_params.epochs,
)
_iteration = 0
_total_iterations = _params.epochs * DATA_SIZE

def _make_som():
    gs = _params.grid_size
    return SelfOrganizingMap(
        input_dim=INPUT_DIM,
        grid_size=(gs, gs),
        learning_rate=_params.learning_rate,
        radius=_params.neighborhood_radius,
        epochs=_params.epochs,
    )

@app.get("/api/params", response_model=TrainParams)
def get_params():
    with _lock:
        return _params

@app.post("/api/params", response_model=TrainParams)
def set_params(new_params: TrainParams):
    global _params, _som, _iteration, _total_iterations
    with _lock:
        _params = new_params
        _som = _make_som()
        _iteration = 0
        _total_iterations = new_params.epochs * DATA_SIZE
    return _params

@app.post("/api/reset")
def reset():
    global _som, _iteration, _total_iterations
    with _lock:
        _som = _make_som()
        _iteration = 0
        _total_iterations = _params.epochs * DATA_SIZE
    return {"status": "reset"}

class StepRequest(BaseModel):
    n: int = Field(5, ge=1, le=200)

@app.post("/api/step")
def step(req: StepRequest):
    global _iteration
    with _lock:
        bmu = (0, 0)
        delta = None
        for _ in range(req.n):
            bmu, delta = _som.step(_iteration, max(_total_iterations, 1))
            _iteration += 1
        nodes = _som.get_weights_flat()
        iteration = _iteration
        delta_flat = delta.ravel().tolist() if delta is not None else []
    return {
        "iteration": iteration,
        "nodes": nodes,
        "bmu": [int(bmu[0]), int(bmu[1])],
        "delta": delta_flat,
    }

@app.get("/api/state")
def get_state():
    with _lock:
        nodes = _som.get_weights_flat()
        iteration = _iteration
    return {"iteration": iteration, "nodes": nodes}

@app.get("/api/stats")
def get_stats():
    with _lock:
        total = max(_total_iterations, 1)
        progress = min(1.0, _iteration / total)
        decay = float(np.exp(-_iteration / total))
        return {
            "iteration":       _iteration,
            "total_iterations": total,
            "progress":        round(progress * 100, 2),
            "decay":           round(decay, 6),
            "learning_rate":   round(_som.learning_rate, 6),
            "radius":          round(_som.radius, 4),
            "initial_lr":      _params.learning_rate,
            "initial_radius":  _params.neighborhood_radius,
            "grid_size":       _params.grid_size,
            "input_dim":       INPUT_DIM,
            "data_size":       DATA_SIZE,
        }
