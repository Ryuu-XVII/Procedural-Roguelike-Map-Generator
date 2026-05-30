// noise landscape gen
export class FractalTerrainGenerator {
  constructor(width = 60, height = 40, seed = "terrain456") {
    this.width = width;
    this.height = height;
    this.seedString = seed;
    this.random = this.createRandom(seed);
    
    // intermediate maps stored as 2d height arrays (0.0 to 1.0)
    this.heightMap = [];
    this.grid = []; // stores visual tile codes for standard renderer (0=water, 1=sand, 2=grass, 3=forest, 4=rock, 5=snow)
    this.snapshots = [];

    // fbm settings
    this.octaves = 4;
    this.lacunarity = 2.0;
    this.gain = 0.5;
    this.baseScale = 0.08; // base scale for first octave
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

  // 2d value noise lookup
  setupNoiseGrid(rand) {
    const size = 256;
    const noiseTable = new Float32Array(size * size);
    for (let i = 0; i < size * size; i++) {
      noiseTable[i] = rand();
    }
    
    // sample 2d value noise
    this.sampleNoise2D = (x, y) => {
      const xInt = Math.floor(x);
      const yInt = Math.floor(y);
      const xFrac = x - xInt;
      const yFrac = y - yInt;

      // cosine interpolator
      const u = xFrac * xFrac * (3 - 2 * xFrac);
      const v = yFrac * yFrac * (3 - 2 * yFrac);

      const getVal = (tx, ty) => {
        // wrap-around cooridinate index (toroidal tiling)
        const rx = ((tx % size) + size) % size;
        const ry = ((ty % size) + size) % size;
        return noiseTable[ry * size + rx];
      };

      // 4 corners
      const v00 = getVal(xInt, yInt);
      const v10 = getVal(xInt + 1, yInt);
      const v01 = getVal(xInt, yInt + 1);
      const v11 = getVal(xInt + 1, yInt + 1);

      // linear interpolations
      const i1 = v00 + u * (v10 - v00);
      const i2 = v01 + u * (v11 - v01);
      return i1 + v * (i2 - i1);
    };
  }

  recordSnapshot(logMessage, phaseName) {
    // generate current tile representation for standard renderer
    const visualGrid = Array(this.height).fill(null).map(() => Array(this.width).fill(0));
    
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const height = this.heightMap[y][x];
        
        if (phaseName === 'heightmap') {
          // if we are just showing the raw hightmap, mapping it to greyscale heights
          // map value [0.0, 1.0] to visual codes. in the client, we will draw greyscale if specified.
          // let's store height float values in grid directly as high floats, renderer will draw them as greyscale
          visualGrid[y][x] = height; 
        } else {
          // otherwise map to biome codes:
          // 0 = deep ocean, 0.5 = shallow ocean, 1 = beach sand, 2 = grasslands, 3 = forests, 4 = high stone, 5 = snow mountain
          if (height < 0.35) visualGrid[y][x] = 0;       // deep water
          else if (height < 0.43) visualGrid[y][x] = 0.5; // shallow water
          else if (height < 0.47) visualGrid[y][x] = 1;   // sand
          else if (height < 0.65) visualGrid[y][x] = 2;   // grass
          else if (height < 0.78) visualGrid[y][x] = 3;   // forest
          else if (height < 0.88) visualGrid[y][x] = 4;   // rock
          else visualGrid[y][x] = 5;                      // snow
        }
      }
    }

    this.snapshots.push({
      grid: visualGrid,
      heightMap: this.cloneGrid(this.heightMap),
      phase: phaseName,
      log: logMessage,
      metrics: this.calculateMetrics()
    });
  }

  calculateMetrics() {
    let deepWater = 0;
    let shallowWater = 0;
    let beach = 0;
    let grass = 0;
    let forest = 0;
    let mountain = 0;

    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const h = this.heightMap[y][x];
        if (h < 0.35) deepWater++;
        else if (h < 0.43) shallowWater++;
        else if (h < 0.47) beach++;
        else if (h < 0.65) grass++;
        else if (h < 0.78) forest++;
        else mountain++;
      }
    }

    const total = this.width * this.height;
    return {
      "Total Area": total,
      "Water Coverage": `${Math.round(((deepWater + shallowWater) / total) * 100)}%`,
      "Plains Area": grass,
      "Forest Area": forest,
      "High Peaks": mountain,
      "Algorithmic Mode": "2D Fractal Noise"
    };
  }

  generate() {
    this.snapshots = [];
    this.random = this.createRandom(this.seedString);
    this.setupNoiseGrid(this.random);

    // initial empty hightmap
    this.heightMap = Array(this.height).fill(null).map(() => Array(this.width).fill(0.0));
    this.recordSnapshot("Initialized flat elevation array. Preparing multi-octave synthesis.", "heightmap");

    // octave 1: continents
    this.addOctave(0, this.baseScale * 0.4, 1.0);
    this.recordSnapshot("Octave 1 added: Very low-frequency value noise shapes the broad continental shores.", "heightmap");

    // octave 2: bays
    this.addOctave(1, this.baseScale * 1.0, 0.5);
    this.recordSnapshot("Octave 2 added: Medium-frequency overlay adds major bays, valleys, and regional coastlines.", "heightmap");

    // octave 3: hills
    this.addOctave(2, this.baseScale * 2.5, 0.25);
    this.recordSnapshot("Octave 3 added: High-frequency noise introduces local hills, dynamic fjords, and complex shorelines.", "heightmap");

    // octave 4: cliffs
    this.addOctave(3, this.baseScale * 6.0, 0.12);
    this.recordSnapshot("Octave 4 added: Fine micro-frequency noise produces craggy coastlines and jagged detail paths.", "heightmap");

    // normalize height grid
    this.normalizeHeightMap();
    this.recordSnapshot("Elevation Normalization: Rescaled all values to fit exactly within [0.0, 1.0]. Ensures precise sea-level matching.", "heightmap");

    // map biomes
    this.recordSnapshot("Biome Mapping: Applied temperature and elevation band calculations, morphing raw values into geographical zones.", "biomes");

    // add cities and ships
    this.decorateTerrain();

    return this.snapshots;
  }

  addOctave(octaveIndex, scale, weight) {
    const xOffset = this.random() * 1000;
    const yOffset = this.random() * 1000;

    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        // rand offsets
        const sampleX = x * scale + xOffset;
        const sampleY = y * scale + yOffset;
        
        // add weighted noise value to hightmap
        this.heightMap[y][x] += this.sampleNoise2D(sampleX, sampleY) * weight;
      }
    }
  }

  normalizeHeightMap() {
    let minVal = Infinity;
    let maxVal = -Infinity;

    // find current bounds
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const val = this.heightMap[y][x];
        if (val < minVal) minVal = val;
        if (val > maxVal) maxVal = val;
      }
    }

    const range = maxVal - minVal;
    if (range === 0) return;

    // linearly stretch values to [0.0, 1.0]
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        this.heightMap[y][x] = (this.heightMap[y][x] - minVal) / range;
      }
    }
  }

  decorateTerrain() {
    const decorations = [];

    // find a nice grassy cooridinates (between 0.48 and 0.60 elevation) that could be a capital city
    const citiesToPlace = 3;
    let citiesPlaced = 0;

    // we search the map for valid plains tiles to place visual icons
    for (let y = 5; y < this.height - 5 && citiesPlaced < citiesToPlace; y++) {
      for (let x = 5; x < this.width - 5 && citiesPlaced < citiesToPlace; x++) {
        const h = this.heightMap[y][x];
        // if it's grasslands and we have random chance
        if (h >= 0.48 && h <= 0.60 && this.random() < 0.02) {
          // check neighbors to make sure it's not immediately next to water or mountain
          let countOk = 0;
          for (let dy = -2; dy <= 2; dy++) {
            for (let dx = -2; dx <= 2; dx++) {
              const nh = this.heightMap[y + dy][x + dx];
              if (nh >= 0.45 && nh <= 0.65) countOk++;
            }
          }
          if (countOk === 25) { // safe large plain
            this.grid[y][x] = 7; // 7 = kingdom capital
            decorations.push({ x, y, type: 'city' });
            citiesPlaced++;
            
            // skip scanning nearby cooridinates
            x += 10;
          }
        }
      }
    }

    // place some trade ships (8) in water
    let shipsPlaced = 0;
    for (let y = 4; y < this.height - 4 && shipsPlaced < 4; y++) {
      for (let x = 4; x < this.width - 4 && shipsPlaced < 4; x++) {
        const h = this.heightMap[y][x];
        if (h >= 0.25 && h <= 0.32 && this.random() < 0.015) {
          this.grid[y][x] = 8; // 8 = trade galleon
          decorations.push({ x, y, type: 'ship' });
          shipsPlaced++;
          
          x += 12; // spread out ships
        }
      }
    }

    this.recordSnapshot(
      `Cartography Finalized: Visualized coastal trade lanes. Dropped ${citiesPlaced} human keeps and ${shipsPlaced} trade galleons across the world map.`,
      "biomes"
    );
  }
}
