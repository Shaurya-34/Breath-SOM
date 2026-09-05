import pytest
from fastapi.testclient import TestClient
from api.index import app, SelfOrganizingMap

client = TestClient(app)

def test_som_logic():
    som = SelfOrganizingMap(input_dim=3, grid_size=(10, 10), learning_rate=0.1, radius=5.0)
    assert som.weights.shape == (10, 10, 3)

    bmu, delta = som.step(iteration=0, total_iterations=100)
    assert len(bmu) == 2
    assert delta.shape == (10, 10)

    flat = som.get_weights_flat()
    assert len(flat) == 100
    assert "x" in flat[0] and "y" in flat[0] and "weights" in flat[0]

def test_api_params_endpoint():
    res = client.get("/api/params")
    assert res.status_code == 200
    data = res.json()
    assert "learning_rate" in data
    assert "grid_size" in data

    new_params = {
        "learning_rate": 0.2,
        "neighborhood_radius": 4.0,
        "epochs": 50,
        "grid_size": 15
    }
    res_post = client.post("/api/params", json=new_params)
    assert res_post.status_code == 200
    assert res_post.json()["learning_rate"] == 0.2
    assert res_post.json()["grid_size"] == 15

def test_api_step_and_stats():
    res_step = client.post("/api/step", json={"n": 2})
    assert res_step.status_code == 200
    step_data = res_step.json()
    assert "iteration" in step_data
    assert "nodes" in step_data
    assert "bmu" in step_data
    assert "delta" in step_data

    res_stats = client.get("/api/stats")
    assert res_stats.status_code == 200
    stats_data = res_stats.json()
    assert stats_data["iteration"] >= 2
    assert "progress" in stats_data
    assert "learning_rate" in stats_data

def test_api_reset():
    res_reset = client.post("/api/reset")
    assert res_reset.status_code == 200
    assert res_reset.json() == {"status": "reset"}

    res_state = client.get("/api/state")
    assert res_state.status_code == 200
    assert res_state.json()["iteration"] == 0
