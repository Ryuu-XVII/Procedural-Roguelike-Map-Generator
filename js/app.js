import { BSPDungeonGenerator } from './algorithms/bsp-dungeon.js';
import { CellularCaveGenerator } from './algorithms/cellular-cave.js';
import { FractalTerrainGenerator } from './algorithms/fractal-terrain.js';
import { CanvasRenderer } from './canvas-renderer.js';

// code text database
const pseudoCodeDb = {
  bsp: `// recursive bsp partitioning
<span class="keyword">function</span> <span class="function">GenerateBSPDungeon</span>(width, height) {
  <span class="keyword">let</span> root = <span class="keyword">new</span> <span class="function">BSPNode</span>(<span class="number">0</span>, <span class="number">0</span>, width, height);
  <span class="keyword">let</span> queue = [root];
  
  <span class="comment">// 1. split boxes recursivly</span>
  <span class="keyword">while</span> (queue.length > <span class="number">0</span>) {
    <span class="keyword">let</span> node = queue.shift();
    <span class="keyword">if</span> (node.w > max || node.h > max) {
      <span class="keyword">let</span> [left, right] = node.splitRandom();
      queue.push(left, right);
    }
  }
  
  <span class="comment">// 2. carve rooms inside leaf nodes</span>
  <span class="keyword">for</span> (<span class="keyword">let</span> leaf <span class="keyword">of</span> root.getLeaves()) {
    leaf.carveRoom();
  }
  
  <span class="comment">// 3. route corridoors traversing up the tree</span>
  root.connectChildren();
}`,
  ca: `// cellular automata cave generation
<span class="keyword">function</span> <span class="function">GenerateCellularCave</span>(width, height) {
  <span class="comment">// 1. random seeding (wall prob = 45%)</span>
  <span class="keyword">let</span> grid = RandomNoiseGrid(width, height, <span class="number">0.45</span>);
  
  <span class="comment">// 2. smooth map using life-like cellular rules</span>
  <span class="keyword">for</span> (<span class="keyword">let</span> i = <span class="number">0</span>; i &lt; iterations; i++) {
    <span class="keyword">let</span> nextGrid = clone(grid);
    <span class="keyword">for</span> (<span class="keyword">let</span> cell <span class="keyword">of</span> grid) {
      <span class="keyword">let</span> walls = countWallNeighbors(cell);
      <span class="keyword">if</span> (walls >= <span class="number">5</span>) nextGrid[cell] = WALL;
      <span class="keyword">else if</span> (walls &lt;= <span class="number">3</span>) nextGrid[cell] = FLOOR;
    }
    grid = nextGrid;
  }
  
  <span class="comment">// 3. flood-fill connectivity prune</span>
  <span class="keyword">let</span> chambers = findChambers(grid);
  pruneDisconnectedChambers(chambers);
}`,
  terrain: `// multi-octave fractal terrain (fbm)
<span class="keyword">function</span> <span class="function">GenerateFractalTerrain</span>(width, height) {
  <span class="keyword">let</span> heightMap = FloatGrid(width, height);
  
  <span class="comment">// 1. accumulate octaves (fbm)</span>
  <span class="keyword">for</span> (<span class="keyword">let</span> oct = <span class="number">0</span>; oct &lt; octaves; oct++) {
    <span class="keyword">let</span> freq = Math.pow(<span class="number">2.0</span>, oct) * scale;
    <span class="keyword">let</span> amp = Math.pow(<span class="number">0.5</span>, oct);
    <span class="keyword">for</span> (<span class="keyword">let</span> c <span class="keyword">of</span> heightMap) {
      heightMap[c] += valueNoise2D(c * freq) * amp;
    }
  }
  
  <span class="comment">// 2. normalize and colorize bands</span>
  normalize(heightMap); <span class="comment">// bounds in [0, 1]</span>
  <span class="keyword">for</span> (<span class="keyword">let</span> c <span class="keyword">of</span> heightMap) {
    grid[c] = mapToBiome(heightMap[c]);
  }
}`
};

// explanations for panels
const explanationDb = {
  bsp: `
    <h4>Binary Space Partitioning (BSP)</h4>
    <p>BSP is a classic, highly structured game design algorithm used to build balanced, branching dungeon structures that prevent rooms from overlapping.</p>
    <ul>
      <li><strong>Partitioning:</strong> The algorithm recursively splits rectangular spaces horizontally or vertically down to a minimum boundary size. This builds a hierarchical BSP tree.</li>
      <li><strong>Carving:</strong> Inside each leaf box, a room of randomized size is carved out. Some room padding ensures hallways separate distinct chambers.</li>
      <li><strong>Routing:</strong> The generator climbs back up the BSP tree, connecting sibling nodes at each junction. Hallways are carved as L-shaped horizontal/vertical channels.</li>
      <li><strong>Deco & Doors:</strong> Places the player in the starting leaf, chests in the most distant room, and doors at corridor-room thresholds.</li>
    </ul>
  `,
  ca: `
    <h4>Cellular Automata (CA) Cave</h4>
    <p>Cellular Automata maps morph standard chaotic grid configurations into smooth, organic, life-like cave structures using neighborhood threshold calculations.</p>
    <ul>
      <li><strong>Random Seeding:</strong> Seeds a white noise grid with 45% walls (solid obsidian) and 55% open channels.</li>
      <li><strong>Cave Smoothing:</strong> Scans active cells in a 3x3 window. A cell solidifies if >= 5 neighbors are walls, and dissolves into floor if <= 3 neighbors are walls. This acts as a spatial low-pass filter.</li>
      <li><strong>Connectivity Sweep:</strong> Runs BFS flood-fills to locate separate cave pockets. To guarantee navigation, smaller chambers are filled with rock.</li>
    </ul>
  `,
  terrain: `
    <h4>Fractal Terrain (FBM)</h4>
    <p>Fractal Brownian Motion overlays multiple frequencies of continuous value noise to simulate geographical features with organic erosion patterns.</p>
    <ul>
      <li><strong>Octave Stacking:</strong> Adds details wave-by-wave. Low frequency noise dictates major continents, while high frequencies form coastal cliffs and sand dunes.</li>
      <li><strong>Normalization:</strong> Linearly maps elevations to a tight [0.0, 1.0] float bounds.</li>
      <li><strong>Biome Bands:</strong> Translates heights to physical zones. Elevations correspond to Deep Ocean, Sand, Grass, Forests, Rocky hills, and Snowy summits.</li>
    </ul>
  `
};

class AppController {
  constructor() {
    this.canvas = document.getElementById('map-canvas');
    this.renderer = new CanvasRenderer(this.canvas);
    
    // state vars
    this.activeAlgo = 'bsp';
    this.seed = 'rogue-quest';
    this.width = 60;
    this.height = 40;
    this.snapshots = [];
    this.currentStep = 0;
    this.isAnimating = false;
    this.fps = 2;
    this.lastFrameTime = 0;

    // instances of algorythms
    this.bspGenerator = new BSPDungeonGenerator();
    this.caGenerator = new CellularCaveGenerator();
    this.terrainGenerator = new FractalTerrainGenerator();

    this.initDPI();
    this.initUI();
    this.bindEvents();
    
    // startup run
    this.generateNewMap();
  }

  // retina screen support
  initDPI() {
    const dpr = window.devicePixelRatio || 1;
    const rect = this.canvas.getBoundingClientRect();
    
    // safety check if canvas size is zero
    let width = rect.width;
    let height = rect.height;
    if (width <= 0 || height <= 0) {
      width = this.canvas.clientWidth || 800;
      height = this.canvas.clientHeight || 500;
    }
    
    this.canvas.width = width * dpr;
    this.canvas.height = height * dpr;
    this.renderer.ctx.scale(dpr, dpr);
    
    // store width/height internally
    this.renderer.canvasWidth = width;
    this.renderer.canvasHeight = height;
  }

  initUI() {
    // sync sidebar inputs on start
    document.getElementById('width-val').innerText = this.width;
    document.getElementById('height-val').innerText = this.height;
    
    this.updateAlgorithmPanel();
  }

  bindEvents() {
    // core buttons
    document.getElementById('algo-select').addEventListener('change', (e) => {
      this.activeAlgo = e.target.value;
      this.updateAlgorithmPanel();
      this.generateNewMap();
    });

    document.getElementById('btn-rand-seed').addEventListener('click', () => {
      const phrases = ['quest', 'crypt', 'heights', 'island', 'cavern', 'ruins', 'dungeon', 'depths', 'abyss'];
      const randWord = phrases[Math.floor(Math.random() * phrases.length)];
      const randNum = Math.floor(Math.random() * 9000) + 1000;
      const newSeed = `${randWord}-${randNum}`;
      
      const seedInput = document.getElementById('seed-input');
      seedInput.value = newSeed;
      this.seed = newSeed;
      this.generateNewMap();
    });

    document.getElementById('seed-input').addEventListener('change', (e) => {
      this.seed = e.target.value || 'rogue-quest';
      this.generateNewMap();
    });

    document.getElementById('btn-generate').addEventListener('click', () => {
      this.generateNewMap();
    });

    // slider event listeners
    document.getElementById('width-range').addEventListener('input', (e) => {
      this.width = parseInt(e.target.value);
      document.getElementById('width-val').innerText = this.width;
    });
    
    document.getElementById('height-range').addEventListener('input', (e) => {
      this.height = parseInt(e.target.value);
      document.getElementById('height-val').innerText = this.height;
    });

    // sub sliders helper
    const bindSliderVal = (sliderId, valId, suffix = '') => {
      document.getElementById(sliderId).addEventListener('input', (e) => {
        document.getElementById(valId).innerText = e.target.value + suffix;
      });
    };
    bindSliderVal('bsp-min-size', 'bsp-min-val');
    bindSliderVal('bsp-max-size', 'bsp-max-val');
    bindSliderVal('ca-prob', 'ca-prob-val', '%');
    bindSliderVal('ca-iter', 'ca-iter-val');
    bindSliderVal('terrain-octaves', 'terrain-octaves-val');
    bindSliderVal('terrain-scale', 'terrain-scale-val');

    // view checkboxes
    const gridToggle = document.getElementById('toggle-grid');
    gridToggle.addEventListener('change', (e) => {
      this.renderer.showGrid = e.target.checked;
      this.renderCurrentStep();
    });

    // canvas zoom buttons
    document.getElementById('btn-zoom-in').addEventListener('click', () => {
      this.renderer.zoom = Math.min(8.0, this.renderer.zoom * 1.2);
      this.renderCurrentStep();
    });

    document.getElementById('btn-zoom-out').addEventListener('click', () => {
      this.renderer.zoom = Math.max(0.3, this.renderer.zoom / 1.2);
      this.renderCurrentStep();
    });

    document.getElementById('btn-view-reset').addEventListener('click', () => {
      this.renderer.centerMap(this.width, this.height);
      this.renderer.zoom = 1.0;
      this.renderCurrentStep();
    });

    // render callback
    this.renderer.onRedraw = () => {
      this.renderCurrentStep();
    };

    // playback slider
    document.getElementById('step-scrubber').addEventListener('input', (e) => {
      this.pauseAnimation();
      this.currentStep = parseInt(e.target.value);
      this.renderCurrentStep();
    });

    document.getElementById('btn-playback-prev').addEventListener('click', () => {
      this.pauseAnimation();
      if (this.currentStep > 0) {
        this.currentStep--;
        this.renderCurrentStep();
      }
    });

    document.getElementById('btn-playback-next').addEventListener('click', () => {
      this.pauseAnimation();
      if (this.currentStep < this.snapshots.length - 1) {
        this.currentStep++;
        this.renderCurrentStep();
      }
    });

    document.getElementById('btn-playback-play').addEventListener('click', () => {
      if (this.isAnimating) {
        this.pauseAnimation();
      } else {
        this.startAnimation();
      }
    });

    document.getElementById('speed-range').addEventListener('input', (e) => {
      this.fps = parseInt(e.target.value);
      document.getElementById('speed-val').innerText = this.fps;
    });

    // tab switching logic
    const tabs = document.querySelectorAll('.tab-btn');
    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        tabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        
        const paneId = `tab-${tab.getAttribute('data-tab')}`;
        document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
        document.getElementById(paneId).classList.add('active');
      });
    });

    // resize handler
    window.addEventListener('resize', () => {
      this.initDPI();
      this.renderCurrentStep();
    });
  }

  // update active panel ui
  updateAlgorithmPanel() {
    // hide other settings
    document.querySelectorAll('.algo-settings-pane').forEach(p => p.style.display = 'none');
    
    // show target settings
    document.getElementById(`settings-${this.activeAlgo}`).style.display = 'block';

    // load walkthrough text
    document.getElementById('algo-explanation-content').innerHTML = explanationDb[this.activeAlgo];

    // load code text
    document.getElementById('code-snippet').innerHTML = pseudoCodeDb[this.activeAlgo];
  }

  // run the map gen
  generateNewMap() {
    this.pauseAnimation();
    
    // recalculate dpi size
    this.initDPI();
    
    // read user inputs
    const seedVal = document.getElementById('seed-input').value.trim() || 'rogue-quest';
    this.seed = seedVal;

    // choose generator and run
    if (this.activeAlgo === 'bsp') {
      const minN = parseInt(document.getElementById('bsp-min-size').value);
      const maxN = parseInt(document.getElementById('bsp-max-size').value);
      
      this.bspGenerator.width = this.width;
      this.bspGenerator.height = this.height;
      this.bspGenerator.seedString = this.seed;
      this.bspGenerator.minNodeSize = minN;
      this.bspGenerator.maxNodeSize = maxN;
      
      this.snapshots = this.bspGenerator.generate();
    } else if (this.activeAlgo === 'ca') {
      const prob = parseInt(document.getElementById('ca-prob').value) / 100;
      const iter = parseInt(document.getElementById('ca-iter').value);
      
      this.caGenerator.width = this.width;
      this.caGenerator.height = this.height;
      this.caGenerator.seedString = this.seed;
      this.caGenerator.initialWallProbability = prob;
      this.caGenerator.iterations = iter;
      
      this.snapshots = this.caGenerator.generate();
    } else if (this.activeAlgo === 'terrain') {
      const octaves = parseInt(document.getElementById('terrain-octaves').value);
      const scale = parseFloat(document.getElementById('terrain-scale').value);
      
      this.terrainGenerator.width = this.width;
      this.terrainGenerator.height = this.height;
      this.terrainGenerator.seedString = this.seed;
      this.terrainGenerator.octaves = octaves;
      this.terrainGenerator.baseScale = scale;
      
      this.snapshots = this.terrainGenerator.generate();
    }

    // set timeline bounds
    const scrubber = document.getElementById('step-scrubber');
    scrubber.max = this.snapshots.length - 1;
    scrubber.value = 0;
    this.currentStep = 0;

    // center map inside viewer
    this.renderer.centerMap(this.width, this.height);

    // auto animate from frame 0 so they see the algorythm carve step-by-step
    this.startAnimation();
  }

  // single step rendering pipeline
  renderCurrentStep() {
    if (this.snapshots.length === 0) return;
    
    const snapshot = this.snapshots[this.currentStep];
    
    // draw on html canvas
    this.renderer.render(snapshot, this.activeAlgo);

    // update scrubber timeline
    document.getElementById('step-scrubber').value = this.currentStep;
    document.getElementById('step-counter').innerText = `Step ${this.currentStep + 1} / ${this.snapshots.length}`;

    // update pan/zoom hud
    document.getElementById('hud-zoom').innerText = `${this.renderer.zoom.toFixed(1)}x`;
    document.getElementById('hud-pan').innerText = `${Math.round(this.renderer.panX)}, ${Math.round(this.renderer.panY)}`;

    // update metrics
    if (snapshot.metrics) {
      const keys = Object.keys(snapshot.metrics);
      const values = Object.values(snapshot.metrics);
      
      const cards = document.querySelectorAll('.metric-card');
      cards.forEach((card, idx) => {
        if (idx < keys.length) {
          card.style.display = 'flex';
          card.querySelector('.metric-label').innerText = keys[idx];
          card.querySelector('.metric-val').innerText = values[idx];
        } else {
          card.style.display = 'none'; // hide extra cards if map type returns fewer metrics
        }
      });
    }

    // update console log output pane
    this.updateConsoleLogs();
  }

  updateConsoleLogs() {
    const consoleBody = document.getElementById('console-output');
    consoleBody.innerHTML = ''; // clear previous

    // draw log history
    for (let i = 0; i <= this.currentStep; i++) {
      const snapshot = this.snapshots[i];
      if (!snapshot) continue;
      
      const pad = (num) => String(num).padStart(2, '0');
      // log timestamps
      const stepMinutes = Math.floor(i / 60);
      const stepSeconds = i % 60;
      const timestamp = `[00:${pad(stepMinutes)}:${pad(stepSeconds)}]`;

      const logLine = document.createElement('div');
      logLine.className = 'console-line';
      if (i === this.currentStep) {
        logLine.classList.add('highlight'); // glow current step
      }

      logLine.innerHTML = `
        <span class="console-timestamp">${timestamp}</span>
        <span class="console-text">${snapshot.log}</span>
      `;
      
      consoleBody.appendChild(logLine);
    }

    // scroll log
    consoleBody.scrollTop = consoleBody.scrollHeight;
  }

  // play animator loop
  startAnimation() {
    if (this.isAnimating) return;
    
    this.isAnimating = true;
    
    // toggle play button
    const playIcon = document.getElementById('play-icon');
    playIcon.innerText = 'pause';
    document.getElementById('btn-playback-play').classList.add('active-glow');

    // if already at final frame, wrap around to beginning
    if (this.currentStep >= this.snapshots.length - 1) {
      this.currentStep = 0;
    }

    this.lastFrameTime = performance.now();
    this.animationLoop();
  }

  pauseAnimation() {
    if (!this.isAnimating) return;
    
    this.isAnimating = false;
    
    // switch icon back to play
    const playIcon = document.getElementById('play-icon');
    playIcon.innerText = 'play_arrow';
    document.getElementById('btn-playback-play').classList.remove('active-glow');
  }

  animationLoop() {
    if (!this.isAnimating) return;

    const now = performance.now();
    const elapsed = now - this.lastFrameTime;
    const msPerFrame = 1000 / this.fps;

    if (elapsed >= msPerFrame) {
      this.lastFrameTime = now - (elapsed % msPerFrame);
      
      if (this.currentStep < this.snapshots.length - 1) {
        this.currentStep++;
        this.renderCurrentStep();
      } else {
        // animation finished, pause
        this.pauseAnimation();
      }
    }

    requestAnimationFrame(() => this.animationLoop());
  }
}

// instantiate controller when window completly loads (guarantees css layouts have computed)
window.addEventListener('load', () => {
  window.app = new AppController();
});
