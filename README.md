# Controlling Robots with a Fly Brain — L@SSEN AI Open Source

An in-browser neuroscience & robotics simulation lab that runs the male fruit fly brain connectome (**MaleCNS v1.0**, 166,700 neurons) via a Leaky Integrate-and-Fire (LIF) model to control quadruped robots, soccer kits, microducks, humanoids, and 2D fruit flies.

All neural computations and physics simulations execute **entirely client-side in your browser**—no server setup or user account required. 

> 🌐 **Language / 언어:** [🇰🇷 **한국어 설명서 읽기 (Read in Korean)**](./README.ko.md)
> 💡 **Notice:** This repository is an enhanced web-hosting and physical AI library built by **L@SSEN AI**, based on the original open-source project by **CONNECT AI LAB (AI Mentor Jay)**.

---

## 🌐 Launch Live Simulators (Online Demo)

Run the simulators instantly in any modern web browser without installing additional dependencies:

👉 **[L@SSEN AI Fly Brain Simulator Main Launcher](https://lassenai.github.io/fly-brain-lab/)**

| Simulator | Description | Live Access Link |
|---|---|---|
| 🪰 **fly-walk** | **Fruit Fly Walk** — 2D Fruit Fly + Real-time 3D Brain Neural Spiking Simulation | [Launch Now](https://lassenai.github.io/fly-brain-lab/fly-walk/) |
| 🤖 **fly-bodies** | **One Brain, Multiple Bodies** — Unitree Go1 Quadruped, Soccer Kit, MicroDuck, Unitree G1 Humanoid (MuJoCo WASM + ONNX Web) | [Launch Now](https://lassenai.github.io/fly-brain-lab/fly-bodies/dist/) |
| 🦆 **fly-duck** | **FlyWire vs MaleCNS** — Connectome Comparative Analysis (2024 Female vs 2026 Male CNS) | [Launch Now](https://lassenai.github.io/fly-brain-lab/fly-duck/compare.html) |

---

## 📁 Repository Structure

```
fly_brain_lab/
├── index.html               # Main landing page & simulator portal
├── fly-walk/                # 3D Fruit fly + 3D real-time brain simulator (Pure HTML/JS)
├── fly-bodies/              # Multi-body 3D physics simulator (Vite / MuJoCo WebGL)
│   └── dist/                # Pre-built static distribution for web
├── fly-duck/                # MicroDuck lab & connectome comparison (compare.html)
├── scripts/
│   └── build_male.py        # MaleCNS connectome parser (feather → 12MB binary graph)
├── THIRD_PARTY_NOTICES.md   # Third-party notices & license disclosures
├── LICENSE                  # Apache 2.0 License
├── README.ko.md             # Korean Documentation
└── README.md                # Main English Documentation
```

---

## 💻 How to Run Locally

### 1. Run with Python HTTP Server (Easiest Method)
Open PowerShell or your terminal in the workspace root directory and run:

```bash
python -m http.server 8000
```
Then open **`http://localhost:8000`** in your browser to launch the portal.

### 2. Run with Node.js Dev Server (For modifying `fly-bodies` source)
```bash
cd fly-bodies
npm ci
npm run dev
```
Navigate to **`http://localhost:5173`** in your browser.

### 3. Rebuilding MaleCNS Brain Graph (`scripts/build_male.py`)
```bash
python3 -m venv env && env/bin/pip install pyarrow numpy scipy
# Download body-annotations, body-neurotransmitters, and connectome-weights feather files from https://male-cns.janelia.org/download/ into the scripts directory
env/bin/python scripts/build_male.py
```

---

## 💡 Key Features & Architecture

- **Real Connectome Map (CC-BY 4.0):** Built on MaleCNS v1.0 (166,700 neurons) released by Google Research and Janelia Research Campus, filtering strong synaptic connections (≥10 synapses).
- **LIF Dynamics:** Odor stimuli trigger neural signal propagation from Antennal Lobe Projection Neurons (ALPN) → Descending Neurons (DN) → Motor Neurons.
- **Reinforcement Learning Physics:** Locomotion gait and posture balance are driven by WebAssembly MuJoCo & ONNX RL policies, while the fly brain provides directional drive (forward/turn).
- **Optimized Performance:** Smooth execution via Web Workers, Transferable Objects, and optimized 3D WebGL renderers.

---

## 📄 License & Attribution

- Source code by **L@SSEN AI** is licensed under **Apache-2.0** ([`LICENSE`](./LICENSE)).
- Based on the foundational open-source project by **CONNECT AI LAB (AI Mentor Jay)**.
- Third-party credits include `microfly` (Apache-2.0), `Pollen Robotics MicroDuck` (Apache-2.0), `MuJoCo Menagerie` (BSD-3), `MuJoCo Playground` (Apache-2.0), and `MaleCNS Data` (CC-BY 4.0). See [`THIRD_PARTY_NOTICES.md`](./THIRD_PARTY_NOTICES.md) for details.

---

## 👤 Credits

- **L@SSEN AI** (Link, AI, Solution · Physical AI Laboratory)
- **Base Project:** CONNECT AI LAB
