/**
 * Binary Space Partitioning (BSP) Dungeon Generator
 */
export class BSPDungeonGenerator {
  constructor(width = 60, height = 40, seed = "dungeon123") {
    this.width = width;
    this.height = height;
    this.seedString = seed;
    this.random = this.createRandom(seed);
    this.grid = [];
    this.snapshots = [];
    this.nodes = []; // BSP Tree nodes
    
    // Configs
    this.minNodeSize = 10;
    this.maxNodeSize = 25;
    this.roomMinPadding = 2;
  }

  // mulberry32 seedable generator
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

  // Helper to clone a 2D grid
  cloneGrid(grid) {
    return grid.map(row => [...row]);
  }

  // Record a visual frame
  recordSnapshot(logMessage, highlightNode = null, highlights = []) {
    this.snapshots.push({
      grid: this.cloneGrid(this.grid),
      nodes: this.nodes.map(n => ({ ...n })),
      highlights: highlights,
      highlightNode: highlightNode ? { ...highlightNode } : null,
      log: logMessage,
      metrics: this.calculateMetrics()
    });
  }

  calculateMetrics() {
    let floorCount = 0;
    let wallCount = 0;
    let corridorCount = 0;
    let roomCount = 0;

    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        if (this.grid[y][x] === 1) floorCount++;
        else if (this.grid[y][x] === 2) corridorCount++;
        else if (this.grid[y][x] === 0) wallCount++;
      }
    }

    // Leaf nodes containing rooms
    this.nodes.forEach(n => {
      if (n.room) roomCount++;
    });

    return {
      "Total Tiles": this.width * this.height,
      "Room Floor Tiles": floorCount,
      "Corridor Tiles": corridorCount,
      "Wall Tiles": wallCount,
      "Rooms Generated": roomCount,
      "Grid Coverage": `${Math.round(((floorCount + corridorCount) / (this.width * this.height)) * 100)}%`
    };
  }

  // initalize the grid with solid walls (0)
  initGrid() {
    this.grid = Array(this.height).fill(null).map(() => Array(this.width).fill(0));
  }

  generate() {
    this.initGrid();
    this.snapshots = [];
    this.nodes = [];
    this.random = this.createRandom(this.seedString);

    // Initial empty state
    this.recordSnapshot("Initialized a solid rock dungeon grid.");

    // Define root BSP node (entire map minus 1 margin for edge walls)
    const rootNode = {
      id: 1,
      x: 1,
      y: 1,
      w: this.width - 2,
      h: this.height - 2,
      left: null,
      right: null,
      parent: null,
      room: null
    };
    
    this.nodes.push(rootNode);
    this.recordSnapshot("Created root BSP tree node covering the printable area.", rootNode);

    // recursivly split nodes
    const queue = [rootNode];
    let nextId = 2;

    while (queue.length > 0) {
      const node = queue.shift();
      
      // Try to split the node
      const canSplitH = node.w > this.maxNodeSize || (node.w > this.minNodeSize * 2 && this.random() > 0.3);
      const canSplitV = node.h > this.maxNodeSize || (node.h > this.minNodeSize * 2 && this.random() > 0.3);
      
      let splitH = false;
      if (canSplitH && canSplitV) {
        splitH = this.random() > 0.5; // Randomly choose orientation
      } else if (canSplitH) {
        splitH = true;
      } else if (canSplitV) {
        splitH = false;
      } else {
        continue; // Cannot split further
      }

      if (splitH) {
        // Vertical split line (splits horizontally into left/right)
        const minSplit = this.minNodeSize;
        const maxSplit = node.w - this.minNodeSize;
        if (maxSplit <= minSplit) continue;
        
        // Random split point
        const splitPoint = Math.floor(this.random() * (maxSplit - minSplit)) + minSplit;
        
        node.left = {
          id: nextId++,
          x: node.x,
          y: node.y,
          w: splitPoint,
          h: node.h,
          left: null,
          right: null,
          parent: node,
          room: null
        };
        
        node.right = {
          id: nextId++,
          x: node.x + splitPoint,
          y: node.y,
          w: node.w - splitPoint,
          h: node.h,
          left: null,
          right: null,
          parent: node,
          room: null
        };
        
        this.nodes.push(node.left, node.right);
        queue.push(node.left, node.right);
        
        this.recordSnapshot(
          `Split Node #${node.id} vertically at column x=${node.x + splitPoint} into Children #${node.left.id} and #${node.right.id}.`,
          node,
          [{ x: node.x + splitPoint, y: node.y, w: 1, h: node.h, type: 'split_v' }]
        );
      } else {
        // Horizontal split line (splits vertically into top/bottom - we call them left/right for simplicity)
        const minSplit = this.minNodeSize;
        const maxSplit = node.h - this.minNodeSize;
        if (maxSplit <= minSplit) continue;
        
        const splitPoint = Math.floor(this.random() * (maxSplit - minSplit)) + minSplit;
        
        node.left = {
          id: nextId++,
          x: node.x,
          y: node.y,
          w: node.w,
          h: splitPoint,
          left: null,
          right: null,
          parent: node,
          room: null
        };
        
        node.right = {
          id: nextId++,
          x: node.x,
          y: node.y + splitPoint,
          w: node.w,
          h: node.h - splitPoint,
          left: null,
          right: null,
          parent: node,
          room: null
        };
        
        this.nodes.push(node.left, node.right);
        queue.push(node.left, node.right);
        
        this.recordSnapshot(
          `Split Node #${node.id} horizontally at row y=${node.y + splitPoint} into Children #${node.left.id} and #${node.right.id}.`,
          node,
          [{ x: node.x, y: node.y + splitPoint, w: node.w, h: 1, type: 'split_h' }]
        );
      }
    }

    // Carve Rooms in leaf nodes
    const leaves = this.nodes.filter(n => n.left === null && n.right === null);
    
    leaves.forEach(leaf => {
      // Choose room sizes smaller than the leaf bounds
      const minW = Math.max(5, this.minNodeSize - this.roomMinPadding * 2);
      const minH = Math.max(5, this.minNodeSize - this.roomMinPadding * 2);
      
      const maxW = leaf.w - this.roomMinPadding * 2;
      const maxH = leaf.h - this.roomMinPadding * 2;
      
      if (maxW < minW || maxH < minH) return;
      
      const roomW = Math.floor(this.random() * (maxW - minW + 1)) + minW;
      const roomH = Math.floor(this.random() * (maxH - minH + 1)) + minH;
      
      // Random position inside the leaf
      const roomX = leaf.x + Math.floor(this.random() * (leaf.w - roomW - this.roomMinPadding * 2)) + this.roomMinPadding;
      const roomY = leaf.y + Math.floor(this.random() * (leaf.h - roomH - this.roomMinPadding * 2)) + this.roomMinPadding;
      
      leaf.room = {
        x: roomX,
        y: roomY,
        w: roomW,
        h: roomH
      };

      // Carve the room tiles
      for (let y = roomY; y < roomY + roomH; y++) {
        for (let x = roomX; x < roomX + roomW; x++) {
          this.grid[y][x] = 1; // 1 = Room Floor
        }
      }
      
      this.recordSnapshot(
        `Carved Room (${roomW}x${roomH}) in Leaf Node #${leaf.id} at coordinates (${roomX}, ${roomY}).`,
        leaf
      );
    });

    // Connect Rooms recursivly by ascending the BSP tree
    this.connectNodes(rootNode);

    // Place Decorations/Interactives (Player, Chest, Enemies)
    this.decorateDungeon(leaves);

    return this.snapshots;
  }

  // recursivly connect children of each node
  connectNodes(node) {
    if (!node || node.left === null || node.right === null) return;
    
    // Recurse down first
    this.connectNodes(node.left);
    this.connectNodes(node.right);
    
    // Connect left child and right child
    const roomA = this.findRoom(node.left);
    const roomB = this.findRoom(node.right);
    
    if (roomA && roomB) {
      this.carveCorridor(roomA, roomB, node);
    }
  }

  // Find any carved room inside a node or its children
  findRoom(node) {
    if (!node) return null;
    if (node.room) return node.room;
    
    const leftRoom = this.findRoom(node.left);
    if (leftRoom) return leftRoom;
    
    return this.findRoom(node.right);
  }

  // Carve corridoor between two room structures
  carveCorridor(roomA, roomB, parentNode) {
    // Get center points of rooms
    const cxA = Math.floor(roomA.x + roomA.w / 2);
    const cyA = Math.floor(roomA.y + roomA.h / 2);
    const cxB = Math.floor(roomB.x + roomB.w / 2);
    const cyB = Math.floor(roomB.y + roomB.h / 2);

    const highlights = [];
    
    // Choose starting axis randomly (Horizontal first or Vertical first)
    if (this.random() > 0.5) {
      // Horizontal segment then Vertical segment
      this.carveHorizontal(cxA, cxB, cyA, highlights);
      this.carveVertical(cyA, cyB, cxB, highlights);
    } else {
      // Vertical segment then Horizontal segment
      this.carveVertical(cyA, cyB, cxA, highlights);
      this.carveHorizontal(cxA, cxB, cyB, highlights);
    }

    this.recordSnapshot(
      `Carved hallway connecting Room at (${cxA},${cyA}) with Room at (${cxB},${cyB}) through Node #${parentNode.id}.`,
      parentNode,
      highlights
    );
  }

  carveHorizontal(x1, x2, y, highlights) {
    const start = Math.min(x1, x2);
    const end = Math.max(x1, x2);
    for (let x = start; x <= end; x++) {
      if (this.grid[y][x] === 0) {
        this.grid[y][x] = 2; // 2 = corridoor
      }
      highlights.push({ x: x, y: y, w: 1, h: 1, type: 'corridor_highlight' });
    }
  }

  carveVertical(y1, y2, x, highlights) {
    const start = Math.min(y1, y2);
    const end = Math.max(y1, y2);
    for (let y = start; y <= end; y++) {
      if (this.grid[y][x] === 0) {
        this.grid[y][x] = 2; // 2 = corridoor
      }
      highlights.push({ x: x, y: y, w: 1, h: 1, type: 'corridor_highlight' });
    }
  }

  // Populate maps with interactables (Player, Chest, Keys, Enemies, Doors)
  decorateDungeon(leaves) {
    const validRooms = leaves.filter(l => l.room !== null).map(l => l.room);
    if (validRooms.length === 0) return;

    // Pick Room A for player spawn
    const playerRoom = validRooms[0];
    const playerX = Math.floor(playerRoom.x + playerRoom.w / 2);
    const playerY = Math.floor(playerRoom.y + playerRoom.h / 2);
    this.grid[playerY][playerX] = 4; // 4 = Player Spawn

    // Pick the most distant room for Chest
    let bestDist = -1;
    let chestRoomIndex = validRooms.length - 1;
    for (let i = 1; i < validRooms.length; i++) {
      const rm = validRooms[i];
      const cx = Math.floor(rm.x + rm.w / 2);
      const cy = Math.floor(rm.y + rm.h / 2);
      const d = Math.abs(cx - playerX) + Math.abs(cy - playerY); // Manhattan distance
      if (d > bestDist) {
        bestDist = d;
        chestRoomIndex = i;
      }
    }
    const chestRoom = validRooms[chestRoomIndex];
    const chestX = Math.floor(chestRoom.x + chestRoom.w / 2);
    const chestY = Math.floor(chestRoom.y + chestRoom.h / 2);
    this.grid[chestY][chestX] = 5; // 5 = Chest / Goal

    // Place some enemies (6) and ambiant lights/doors in remaining rooms
    const decorationHighlights = [];
    validRooms.forEach((room, index) => {
      // Add enemies to non-player rooms
      if (index !== 0) {
        const enemyX = Math.floor(room.x + this.random() * (room.w - 2)) + 1;
        const enemyY = Math.floor(room.y + this.random() * (room.h - 2)) + 1;
        if (this.grid[enemyY][enemyX] === 1) {
          this.grid[enemyY][enemyX] = 6; // 6 = Enemy
          decorationHighlights.push({ x: enemyX, y: enemyY, type: 'spawn_enemy' });
        }
      }

      // 1. Place archetectural Pillars (9) inside large rooms!
      if (room.w >= 7 && room.h >= 7) {
        const px1 = room.x + 2;
        const px2 = room.x + room.w - 3;
        const py1 = room.y + 2;
        const py2 = room.y + room.h - 3;
        
        const pillarCoords = [
          {x: px1, y: py1}, {x: px2, y: py1},
          {x: px1, y: py2}, {x: px2, y: py2}
        ];
        
        pillarCoords.forEach(c => {
          if (this.grid[c.y][c.x] === 1) {
            this.grid[c.y][c.x] = 9; // 9 = Pillar
          }
        });
      }

      // 2. Place random Floor Detail objects (8 = Cobweb, 10 = Gold, 11 = Broken Pot, 12 = Skeleton)
      for (let y = room.y; y < room.y + room.h; y++) {
        for (let x = room.x; x < room.x + room.w; x++) {
          if (this.grid[y][x] === 1) {
            // Corner cobwebs
            const isCorner = 
              (x === room.x || x === room.x + room.w - 1) &&
              (y === room.y || y === room.y + room.h - 1);
              
            if (isCorner && this.random() < 0.4) {
              this.grid[y][x] = 8; // 8 = Cobweb
            } else if (this.random() < 0.05) {
              const roll = this.random();
              if (roll < 0.4) {
                this.grid[y][x] = 10; // 10 = Gold Coins
              } else if (roll < 0.8) {
                this.grid[y][x] = 11; // 11 = Broken Pot
              } else {
                this.grid[y][x] = 12; // 12 = Skeleton
              }
            }
          }
        }
      }
    });

    // Detect intersectons where a room connects to a corridoor to place Doors (3)
    for (let y = 1; y < this.height - 1; y++) {
      for (let x = 1; x < this.width - 1; x++) {
        // If it's a corridoor floor
        if (this.grid[y][x] === 2) {
          // Check neighbors: if it connects to room floor (1)
          const leftIsRoom = this.grid[y][x - 1] === 1;
          const rightIsRoom = this.grid[y][x + 1] === 1;
          const topIsRoom = this.grid[y - 1][x] === 1;
          const bottomIsRoom = this.grid[y + 1][x] === 1;

          // Vertical corridoor entering horizontal room door
          if ((leftIsRoom || rightIsRoom) && this.grid[y - 1][x] !== 1 && this.grid[y + 1][x] !== 1) {
            this.grid[y][x] = 3; // 3 = Door
            decorationHighlights.push({ x: x, y: y, type: 'door' });
          }
          // Horizontal corridoor entering vertical room door
          else if ((topIsRoom || bottomIsRoom) && this.grid[y][x - 1] !== 1 && this.grid[y][x + 1] !== 1) {
            this.grid[y][x] = 3; // 3 = Door
            decorationHighlights.push({ x: x, y: y, type: 'door' });
          }
        }
      }
    }

    // 3. Scan for Wall Torches (7): Place a torch on a solid wall directly above a floor tile
    for (let y = 1; y < this.height - 1; y++) {
      for (let x = 1; x < this.width - 1; x++) {
        if ((this.grid[y][x] === 1 || this.grid[y][x] === 2) && this.grid[y - 1][x] === 0) {
          if (this.random() < 0.15) {
            let tooClose = false;
            for (let dx = -3; dx <= 3; dx++) {
              if (this.grid[y - 1][x + dx] === 7) tooClose = true;
            }
            if (!tooClose) {
              this.grid[y - 1][x] = 7; // 7 = Wall Torch
              decorationHighlights.push({ x: x, y: y - 1, type: 'torch' });
            }
          }
        }
      }
    }

    this.recordSnapshot(
      "Dungeon layout complete! Placed Hero (Green), Dungeon Chest (Gold), hostile Orc spawns (Red), and carved Door frames (Brown). Added architectural pillars, wall torches, cobwebs, and scattered bones/pots.",
      null,
      decorationHighlights
    );
  }
}
