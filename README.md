# Breath-SOM

> **What does pure maths breathing look like?**

**Breath-SOM** is a topological representation of a Self-Organizing Map (Kohonen network) designed to behave less like a static data grid, and more like a living organism.

Usually, Machine Learning is treated as a rigid pipeline: *train, freeze, display.*  
Breath-SOM changes the formula to: *train, perturb, evolve, flow forever.* 

In this system, colors aren't randomly assigned; they emerge naturally from the high-dimensional weight space. Motion isn't a UI animation; the physical ripples you see are the raw neighborhood update calculations executing and decaying in real-time. The network never fully converges—it stays in a continuous state of graceful, flowing adaptation.

**Experience the living organism:** [breath-som.vercel.app](https://breath-som.vercel.app)

---

## Key Features

- **Generative Topology:** A continuous, highly-saturated color field mathematically derived from the distances between neurons in a 3D weight space.
- **Physical Ripples:** True real-time particle displacement. Every time the network updates, the physical Best Matching Unit (BMU) drives a traveling wave equation rippling across the grid based on the actual $L2$-norm magnitude of the weight changes ($||\Delta w||$).
- **Live Math Panel:** Press `M` to open a frosted-glass panel that allows you to inspect the live calculus, decay factors, and training variables as the neural network updates.
- **Dynamic 3D Integration:** Fully interactive scene built on React Three Fiber allowing you to rotate, zoom, and explore the mathematical topology from any angle.

---

## Technology Stack

**Frontend:**
- **React.js** + **Vite**
- **Three.js** & **React Three Fiber** for hardware-accelerated 3D rendering.
- **Tailwind CSS** for premium, glassmorphism-based UI styling.
- **Anime.js** for smooth UI transitions and easing.

**Backend:**
- **Python** & **FastAPI** for serving ultra-low latency mathematical updates.
- **NumPy** for vector computation and competitive learning neighborhood equations.

**Deployment:**
- Full-stack unified deployment on **Vercel** exploiting auto-discovery of Serverless Python functions within the `/api` directory.

---

## Running Locally

Because we consolidated the Python backend directly into the frontend repository, setting it up for local development is exceptionally easy. 

### Prerequisites
- [Node.js](https://nodejs.org/en/) installed 
- [Python 3.9+](https://www.python.org/) installed

### Setup

1. **Clone the repository:**
   ```bash
   git clone https://github.com/Shaurya-34/Breath-SOM.git
   cd Breath-SOM
   ```

2. **Install frontend dependencies:**
   ```bash
   npm install
   ```

3. **Install backend dependencies:**
   ```bash
   pip install -r api/requirements.txt
   ```

### Running the App

To run the application locally, you just need to spin up the backend and the frontend parallelly:

**Terminal 1 (Backend):**
```bash
python -m uvicorn api.index:app --reload --port 8000
```

**Terminal 2 (Frontend):**
```bash
npm run dev
```

Visit `http://localhost:8080/` in your browser. The Vite proxy will automatically forward API requests to the Python server.

---
*Created as an exploration of bringing Machine Learning maths to life.*
