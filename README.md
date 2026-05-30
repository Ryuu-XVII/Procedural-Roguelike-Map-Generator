# Procedural Roguelike Map Generator & Visualizer 🗺️

Hey there! This is a cool web-based visualizer I built to show how dungeon and world map generation algorythms work. I've always loved top-down roguelikes and retro RPGs, so I wanted to see exactly how the math carves out rooms, corridoors, and cave systems step-by-step.

Instead of just drawing the final map, this project lets you scrub frame-by-frame through the generation timeline so you can watch exactly how the walls are partitioned, corridors are routed, or cave islands are smoothed out.

👉 **Live demo here:** (http://localhost:3000) *(Just host it locally or run `npx serve .`!)*

---

## 🚀 Cool Features
* **Scrubbing Timeline Slider:** Slide back and forth to see the algorythm run in slow motion! You can also click Play/Pause to auto-animate it at different FPS speeds.
* **Ambient radial lighting:** Dynamic orange torchlight glows on dungeon walls, and red magma halos heat up the cave chambers.
* **Vector Pan & Scroll Zoom:** Drag to pan around the map and scroll with your wheel to zoom in on specific structures. The HUD scales cooridinates in real-time.
* **Execution Logs:** A scrolling retro terminal outputs the exact operations the algorythm is executing at the active step.
* **Walkthrough & Code Codebase:** Swappable panel displaying walkthrough notes and clean, syntax-highlighted code blocks for each algorythm.

---

## 🛠️ The Algorythms Inside

### 1. BSP Dungeon Generator (Binary Space Partitioning)
Standard recursive partitioning algorythm that slices the map horizontally or vertically to build balanced, non-overlapping rooms.
* **Partitioning:** Slices node branches recursively down to a target min-size.
* **Carving:** Places rooms inside leaf nodes with some padding for spacing.
* **Hallway Routing:** Traverses back up the tree, carving L-shaped horizontal/vertical channels to connect siblings.
* **Prop Deco:** Places structural pillars in large rooms, mounts torches on walls, scatters gold piles, skeletons, broken clay pots, and web strands.

### 2. Cellular Automata Cave (CA)
Organic cave structures developed using density grid smoothing rules (similar to Conway's Game of Life).
* **Random Seeding:** Initalizes a grid with 45% solid wall cells.
* **Smoothing:** Runs 5 passes of a 5-neighbor density threshold rule to smooth out jagged stone.
* **Connectivity sweep:** Executes BFS flood-fill sweeps to locate separate chambers. To guarantee full navigation, all isolated chambers are sealed off back into solid stone.
* **Details:** Expands pools of deep-water and lava chambers organically, and drops stone stalagmites in narrow zones.

### 3. Fractal Terrain (FBM)
Creates detailed world landscape maps using stacked continuous Value Noise.
* **Octave Accumulation:** Adds waves of noise together (low-frequency outlines grand landmasses, while high-frequency adds coastal dunes and cliff edges).
* **Normalization:** Linearly stretches elevations to a [0.0, 1.0] range.
* **Biome Mapping:** Translates heights into distinct geographical bands: Deep Oceans, Shallow Water, Sand Beach, Grass Plains, Pine Forests, Stone Mountains, and Snowy Peaks.
* **Details:** Places medieval keeps and water trade galleons.

---

## 🎮 How to Run
Since it is written in pure vanilla HTML, CSS, and modular ES6 JavaScript, you don't need any complex builders (Vite/Webpack) or massive `node_modules`. 

Just clone the project and spin up a lightweight local server:
```bash
# Clone the repository
git clone https://github.com/Ryuu-XVII/Procedural-Roguelike-Map-Generator.git

# Enter project directory
cd Procedural-Roguelike-Map-Generator

# Spin up a fast server (needed due to ES6 module CORS security rules)
npx serve .
```

Then open `http://localhost:3000` (or whatever port serve runs on) in your browser!

---

## 🎨 Aesthetics & Layout
* **Color Palette:** HSL dark theme with cyberpunk cyan, neon emerald, amber gold, and crimson rose highlights.
* **Glassmorphism:** Frosted panel overlays with light-reflective glass borders.
* **Micro-animations:** Glow pulses on buttons, rotational morphs, and smooth scrolling console lines.
