"""
FastAPI server for Breath SOM – serves training state to the nebula-hue frontend.

Endpoints
---------
GET  /api/params  → current training parameters
POST /api/params  → update parameters
POST /api/reset   → reset the SOM to a fresh state
GET  /api/state   → current weight snapshot (flat list of nodes)
POST /api/step    → advance N steps, return nodes + BMU + per-node ‖Δw‖
GET  /api/stats   → live training statistics for the Math Panel
"""

from __future__ import annotations

import threading
from typing import List

import numpy as np
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from som_core import SelfOrganizingMap

# ---------------------------------------------------------------------------
# App setup
# ---------------------------------------------------------------------------

app = FastAPI(title="Breath SOM API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],   # Vite dev server (localhost:*)
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Shared mutable state (protected by a simple lock)
# ---------------------------------------------------------------------------

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


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------


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
    """Advance N SOM steps and return nodes + last BMU position + per-node ‖Δw‖."""
    global _iteration
    with _lock:
        bmu = (0, 0)
        delta = None
        for _ in range(req.n):
            bmu, delta = _som.step(_iteration, max(_total_iterations, 1))
            _iteration += 1
        nodes = _som.get_weights_flat()
        iteration = _iteration
        # delta is (gH, gW) ndarray — flatten in row-major order to match nodes
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
    """Live training statistics for the Math Panel in the frontend."""
    with _lock:
        total = max(_total_iterations, 1)
        progress = min(1.0, _iteration / total)
        decay = float(np.exp(-_iteration / total))
        return {
            "iteration":       _iteration,
            "total_iterations": total,
            "progress":        round(progress * 100, 2),
            "decay":           round(decay, 6),
            # current (decayed) values
            "learning_rate":   round(_som.learning_rate, 6),
            "radius":          round(_som.radius, 4),
            # initial values (from params)
            "initial_lr":      _params.learning_rate,
            "initial_radius":  _params.neighborhood_radius,
            # grid info
            "grid_size":       _params.grid_size,
            "input_dim":       INPUT_DIM,
            "data_size":       DATA_SIZE,
        }
