// ca cave gen
export class CellularCaveGenerator {
  constructor(width = 60, height = 40, seed = "cave789") {
    this.width = width;
    this.height = height;
    this.seedString = seed;
    this.random = this.createRandom(seed);
    this.grid = [];
    this.snapshots = [];

    // configs
    this.initialWallProbability = 0.45; // 45% walls
    this.iterations = 5;
  }

  // prng mulberry32
  createRandom(seedStr) {
    let hash = 0;
    for (let i = 0; i < seedStr.length; i++) {
      hash = (hash << 5) - hash + seedStr.charCodeAt(i);
      hash |= 0;
    }
    let a = hash === 0 ? 123456789 : hash;
    return function () {
      let t = (a += 0x6d2b79f5);
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  cloneGrid(grid) {
    return grid.map(row => [...row]);
  }

  recordSnapshot(logMessage, highlights = []) {
    this.snapshots.push({
      grid: this.cloneGrid(this.grid),
      highlights: highlights,
      log: logMessage,
      metrics: this.calculateMetrics()
    });
  }

  calculateMetrics() {
    let floorCount = 0;
    let wallCount = 0;
    let itemSpawnCount = 0;

    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const val = this.grid[y][x];
        if (val === 1) floorCount++;
        else if (val === 0) wallCount++;
        else if (val > 1) itemSpawnCount++;
      }
    }

    return {
      "Total Tiles": this.width * this.height,
      "Floor Area": floorCount,
      "Wall Area": wallCount,
      "Density": `${Math.round((floorCount / (this.width * this.height)) * 100)}% Floors`,
      "Complexity": "O(N * W * H)"
    };
  }

  // count neighbors
  countWallNeighbors(x, y, gridRef) {
    let count = 0;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx;
        const ny = y + dy;

        // count out of bounds as walls to keep map edges solid
        if (nx < 0 || nx >= this.width || ny < 0 || ny >= this.height) {
          count++;
        } else if (gridRef[ny][nx] === 0) {
          count++;
        }
      }
    }
    return count;
  }

  generate() {
    this.snapshots = [];
    this.random = this.createRandom(this.seedString);

    // seed random walls
    this.grid = Array(this.height).fill(null).map(() => Array(this.width).fill(0));
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        // edge walls
        if (x === 0 || x === this.width - 1 || y === 0 || y === this.height - 1) {
          this.grid[y][x] = 0;
        } else {
          this.grid[y][x] = this.random() < this.initialWallProbability ? 0 : 1; // 0 = wall, 1 = floor
        }
      }
    }
    
    this.recordSnapshot(`Generated initial white noise layout. Approximately ${Math.round(this.initialWallProbability * 100)}% tiles are set as solid rock.`);

    // smooth cave loop
    for (let i = 1; i <= this.iterations; i++) {
      const nextGrid = this.cloneGrid(this.grid);
      const changes = [];

      for (let y = 1; y < this.height - 1; y++) {
        for (let x = 1; x < this.width - 1; x++) {
          const walls = this.countWallNeighbors(x, y, this.grid);
          
          // ca cave rules: >=5 is wall, <=3 is floor
          if (walls >= 5) {
            if (this.grid[y][x] !== 0) {
              nextGrid[y][x] = 0;
              changes.push({ x, y, type: 'ca_wall' });
            }
          } else if (walls <= 3) {
            if (this.grid[y][x] !== 1) {
              nextGrid[y][x] = 1;
              changes.push({ x, y, type: 'ca_floor' });
            }
          }
        }
      }
      this.grid = nextGrid;
      this.recordSnapshot(`Cellular Automata Pass #${i}: Applied 5-neighbor density thresholds. Smoothed jagged borders.`, changes.slice(0, 100));
    }

    // find separate caves
    this.cleanIsolatedChambers();

    // spawn things
    this.decorateCave();

    return this.snapshots;
  }

  // bfs clean
  cleanIsolatedChambers() {
    const visited = Array(this.height).fill(null).map(() => Array(this.width).fill(false));
    const chambers = [];

    // find all seperate floor chambers
    for (let y = 1; y < this.height - 1; y++) {
      for (let x = 1; x < this.width - 1; x++) {
        if (this.grid[y][x] === 1 && !visited[y][x]) {
          // flood fill group
          const chamber = [];
          const queue = [{ x, y }];
          visited[y][x] = true;

          while (queue.length > 0) {
            const curr = queue.shift();
            chamber.push(curr);

            const neighbors = [
              { x: curr.x + 1, y: curr.y },
              { x: curr.x - 1, y: curr.y },
              { x: curr.x, y: curr.y + 1 },
              { x: curr.x, y: curr.y - 1 }
            ];

            neighbors.forEach(n => {
              if (
                n.x >= 0 && n.x < this.width &&
                n.y >= 0 && n.y < this.height &&
                this.grid[n.y][n.x] === 1 &&
                !visited[n.y][n.x]
              ) {
                visited[n.y][n.x] = true;
                queue.push(n);
              }
            });
          }
          chambers.push(chamber);
        }
      }
    }

    if (chambers.length <= 1) {
      this.recordSnapshot("Connectivity Analysis: The cave is fully continuous. No isolated pockets detected.");
      return;
    }

    // sort groups
    chambers.sort((a, b) => b.length - a.length);
    const mainChamber = chambers[0];
    const isolatedChambers = chambers.slice(1);

    // show pruned caves
    const highlights = [];
    isolatedChambers.forEach((chamber, chamberIdx) => {
      chamber.forEach(tile => {
        highlights.push({ x: tile.x, y: tile.y, w: 1, h: 1, type: 'isolated_chamber_highlight' });
      });
    });

    this.recordSnapshot(
      `Connectivity Analysis: Found ${chambers.length} separated chambers. The largest has ${mainChamber.length} tiles. Highlighting ${isolatedChambers.length} isolated cave pockets to prune.`,
      highlights
    );

    // seal extra caves
    isolatedChambers.forEach(chamber => {
      chamber.forEach(tile => {
        this.grid[tile.y][tile.x] = 0; // turn back into solid wall
      });
    });

    this.recordSnapshot(`Pruning Complete: Sealed all isolated pockets. Grid connectivity achieved. Only the main cavern remains.`);
  }

  decorateCave() {
    // get valid floor tiles
    const floors = [];
    for (let y = 1; y < this.height - 1; y++) {
      for (let x = 1; x < this.width - 1; x++) {
        if (this.grid[y][x] === 1) {
          floors.push({ x, y });
        }
      }
    }

    if (floors.length < 5) return;

    // player/chest far apart
    const playerIndex = Math.floor(this.random() * floors.length);
    const playerTile = floors[playerIndex];
    this.grid[playerTile.y][playerTile.x] = 4; // 4 = player

    // max dist
    let furthestTile = floors[0];
    let maxDist = -1;
    floors.forEach(tile => {
      const dist = Math.abs(tile.x - playerTile.x) + Math.abs(tile.y - playerTile.y);
      if (dist > maxDist) {
        maxDist = dist;
        furthestTile = tile;
      }
    });
    this.grid[furthestTile.y][furthestTile.x] = 5; // 5 = chest

    // organic water/lava pools
    const poolFloors = floors.filter(t => this.grid[t.y][t.x] === 1);
    if (poolFloors.length > 25) {
      const waterSeed = poolFloors[Math.floor(this.random() * poolFloors.length)];
      const lavaSeed = poolFloors[Math.floor(this.random() * poolFloors.length)];
      
      const expandPool = (seed, type) => {
        if (!seed) return;
        const queue = [seed];
        this.grid[seed.y][seed.x] = type;
        let count = 0;
        
        while (queue.length > 0 && count < 10) {
          const curr = queue.shift();
          count++;
          
          const neighbors = [
            { x: curr.x + 1, y: curr.y }, { x: curr.x - 1, y: curr.y },
            { x: curr.x, y: curr.y + 1 }, { x: curr.x, y: curr.y - 1 }
          ];
          
          neighbors.forEach(n => {
            if (
              n.x > 0 && n.x < this.width - 1 &&
              n.y > 0 && n.y < this.height - 1 &&
              this.grid[n.y][n.x] === 1 &&
              this.random() < 0.45
            ) {
              this.grid[n.y][n.x] = type;
              queue.push(n);
            }
          });
        }
      };
      
      if (Math.abs(waterSeed.x - playerTile.x) + Math.abs(waterSeed.y - playerTile.y) > 6) {
        expandPool(waterSeed, 13);
      }
      if (Math.abs(lavaSeed.x - playerTile.x) + Math.abs(lavaSeed.y - playerTile.y) > 6 &&
          Math.abs(lavaSeed.x - waterSeed.x) + Math.abs(lavaSeed.y - waterSeed.y) > 6) {
        expandPool(lavaSeed, 14);
      }
    }

    // stalagmites in narrow spots
    for (let y = 1; y < this.height - 1; y++) {
      for (let x = 1; x < this.width - 1; x++) {
        if (this.grid[y][x] === 1) {
          const walls = this.countWallNeighbors(x, y, this.grid);
          if (walls >= 4 && this.random() < 0.22) {
            this.grid[y][x] = 15; // 15 = stalagmite
          }
        }
      }
    }

    // enemies spawn
    const enemiesToPlace = Math.min(12, Math.floor(floors.length / 40));
    let placedEnemies = 0;
    const enemyHighlights = [];

    for (let i = 0; i < floors.length && placedEnemies < enemiesToPlace; i++) {
      const idx = Math.floor(this.random() * floors.length);
      const tile = floors[idx];
      
      const distToPlayer = Math.abs(tile.x - playerTile.x) + Math.abs(tile.y - playerTile.y);
      if (this.grid[tile.y][tile.x] === 1 && distToPlayer > 8) {
        this.grid[tile.y][tile.x] = 6; // enemy
        enemyHighlights.push({ x: tile.x, y: tile.y, type: 'enemy_place' });
        placedEnemies++;
      }
    }

    this.recordSnapshot(
      `Decorated Cavern: Spawns generated! Placed Player, exit Treasure, and ${placedEnemies} monsters. Molded dynamic deep-water reserves, magma pools, and jagged stone stalagmites.`,
      enemyHighlights
    );
  }
}
