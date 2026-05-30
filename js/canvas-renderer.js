/**
 * Canvas Renderer with Interactive Pan, Zoom, and Custom Stylized Tile Renderers
 */
export class CanvasRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    
    // Pan & Zoom state
    this.zoom = 1.0;
    this.panX = 0;
    this.panY = 0;
    
    // Drag state
    this.isDragging = false;
    this.startX = 0;
    this.startY = 0;
    
    // Grid settings
    this.tileSize = 16; // Pixels per grid tile
    this.showGrid = false;
    
    // Color palettes
    this.colors = {
      dungeon: {
        wall: '#111827',         // Very dark gray
        wallShadow: '#030712',   // Deeper shadow
        floorRoom: '#374151',    // Medium warm gray
        floorCorridor: '#4b5563',// Cool gray
        door: '#b45309',         // Amber wood
        player: '#10b981',       // Emerald neon
        chest: '#fbbf24',        // Gold
        enemy: '#f87171',        // Coral red
        splitV: 'rgba(239, 68, 68, 0.4)',  // Translucent split lines
        splitH: 'rgba(59, 130, 246, 0.4)',
        highlightCorridor: 'rgba(245, 158, 11, 0.3)'
      },
      cave: {
        wall: '#18181b',         // Dark zinc
        floor: '#27272a',        // Light zinc
        player: '#10b981',       // Emerald
        chest: '#f59e0b',        // Amber
        enemy: '#ef4444',        // Red
        isolatedHighlight: 'rgba(239, 68, 68, 0.4)'
      },
      terrain: {
        deepWater: '#1e3a8a',    // Deep blue
        shallowWater: '#1d4ed8', // Medium blue
        sand: '#fef08a',         // Sand yellow
        grass: '#22c55e',        // Grass green
        forest: '#15803d',       // Dark forest green
        rock: '#78716c',         // Stone gray
        snow: '#fafaf9',         // White snow
        city: '#e11d48',         // Neon Rose
        ship: '#ffffff'          // White sail
      }
    };

    this.initEvents();
  }

  // Set up interaction listeners
  initEvents() {
    this.canvas.addEventListener('mousedown', (e) => {
      this.isDragging = true;
      this.startX = e.clientX - this.panX;
      this.startY = e.clientY - this.panY;
      this.canvas.style.cursor = 'grabbing';
    });

    window.addEventListener('mousemove', (e) => {
      if (!this.isDragging) return;
      this.panX = e.clientX - this.startX;
      this.panY = e.clientY - this.startY;
      this.requestRedraw();
    });

    window.addEventListener('mouseup', () => {
      this.isDragging = false;
      this.canvas.style.cursor = 'grab';
    });

    this.canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      
      const zoomFactor = 1.1;
      let newZoom = this.zoom;
      
      if (e.deltaY < 0) {
        newZoom *= zoomFactor;
      } else {
        newZoom /= zoomFactor;
      }

      // Bound zoom between 0.3x and 8.0x
      newZoom = Math.max(0.3, Math.min(8.0, newZoom));
      
      // Zoom centered on mouse cursor cooridinate
      const rect = this.canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      // Adjust pan cooridinates to keep mouse position anchored
      this.panX = mouseX - (mouseX - this.panX) * (newZoom / this.zoom);
      this.panY = mouseY - (mouseY - this.panY) * (newZoom / this.zoom);
      this.zoom = newZoom;

      this.requestRedraw();
    }, { passive: false });

    // Touch Support for Mobile
    let lastTouchX = 0, lastTouchY = 0;
    this.canvas.addEventListener('touchstart', (e) => {
      if (e.touches.length === 1) {
        this.isDragging = true;
        lastTouchX = e.touches[0].clientX;
        lastTouchY = e.touches[0].clientY;
      }
    });

    this.canvas.addEventListener('touchmove', (e) => {
      if (this.isDragging && e.touches.length === 1) {
        const dx = e.touches[0].clientX - lastTouchX;
        const dy = e.touches[0].clientY - lastTouchY;
        this.panX += dx;
        this.panY += dy;
        lastTouchX = e.touches[0].clientX;
        lastTouchY = e.touches[0].clientY;
        this.requestRedraw();
      }
    });

    this.canvas.addEventListener('touchend', () => {
      this.isDragging = false;
    });

    this.canvas.style.cursor = 'grab';
  }

  // Request redraw is managed by the app orchestrator
  requestRedraw() {
    if (this.onRedraw) this.onRedraw();
  }

  // Adjust cooridinates so the map centers within the viewport
  centerMap(mapW, mapH) {
    const rect = this.canvas.getBoundingClientRect();
    const mapPixelW = mapW * this.tileSize * this.zoom;
    const mapPixelH = mapH * this.tileSize * this.zoom;
    
    this.panX = (rect.width - mapPixelW) / 2;
    this.panY = (rect.height - mapPixelH) / 2;
  }

  // Main drawing pipeline
  render(snapshot, mapType) {
    if (!snapshot || !snapshot.grid) return;
    
    // Normalize string key values from external app controllers
    if (mapType === 'bsp') mapType = 'dungeon';
    if (mapType === 'ca') mapType = 'cave';
    
    const grid = snapshot.grid;
    const height = grid.length;
    const width = grid[0].length;

    // Clear the entire canvas buffer using absolute pixel transforms (prevents scale distortion)
    this.ctx.save();
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.fillStyle = '#090d16'; // Deep dark slate background
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.restore();

    this.ctx.save();
    
    // Apply pan and zoom transforms
    this.ctx.translate(this.panX, this.panY);
    this.ctx.scale(this.zoom, this.zoom);

    // 1. Draw Map Tiles
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const val = grid[y][x];
        this.drawTile(x, y, val, mapType, snapshot.phase);
      }
    }

    // 1.5 Draw ambiant Torches Glow Lighting Overlay (Dungeon mode)
    if (mapType === 'dungeon') {
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          if (grid[y][x] === 7) {
            const tx = x * this.tileSize + this.tileSize / 2;
            const ty = y * this.tileSize + this.tileSize - 8;
            
            const grad = this.ctx.createRadialGradient(tx, ty, 2, tx, ty, 64);
            grad.addColorStop(0, 'rgba(249, 115, 22, 0.28)'); // Amber core
            grad.addColorStop(0.4, 'rgba(249, 115, 22, 0.1)'); // Fading halo
            grad.addColorStop(1, 'rgba(249, 115, 22, 0)');
            
            this.ctx.fillStyle = grad;
            this.ctx.beginPath();
            this.ctx.arc(tx, ty, 64, 0, Math.PI * 2);
            this.ctx.fill();
          }
        }
      }
    }

    // 1.6 Draw ambiant Magma Thermal Glow (Cave mode)
    if (mapType === 'cave') {
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          if (grid[y][x] === 14) {
            const tx = x * this.tileSize + this.tileSize / 2;
            const ty = y * this.tileSize + this.tileSize / 2;
            
            const grad = this.ctx.createRadialGradient(tx, ty, 2, tx, ty, 36);
            grad.addColorStop(0, 'rgba(239, 68, 68, 0.2)'); // Soft neon red
            grad.addColorStop(0.5, 'rgba(239, 68, 68, 0.05)');
            grad.addColorStop(1, 'rgba(239, 68, 68, 0)');
            
            this.ctx.fillStyle = grad;
            this.ctx.beginPath();
            this.ctx.arc(tx, ty, 36, 0, Math.PI * 2);
            this.ctx.fill();
          }
        }
      }
    }

    // 2. Draw algorythm Specific Visualizations (e.g. BSP cuts or search areas)
    if (mapType === 'dungeon') {
      this.drawDungeonOverlays(snapshot);
    } else if (mapType === 'cave') {
      this.drawCaveOverlays(snapshot);
    } else if (mapType === 'terrain') {
      this.drawTerrainOverlays(snapshot);
    }

    // 3. Draw Grid Lines (optional overlay)
    if (this.showGrid) {
      this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
      this.ctx.lineWidth = 0.5;
      
      this.ctx.beginPath();
      for (let x = 0; x <= width; x++) {
        this.ctx.moveTo(x * this.tileSize, 0);
        this.ctx.lineTo(x * this.tileSize, height * this.tileSize);
      }
      for (let y = 0; y <= height; y++) {
        this.ctx.moveTo(0, y * this.tileSize);
        this.ctx.lineTo(width * this.tileSize, y * this.tileSize);
      }
      this.ctx.stroke();
    }

    this.ctx.restore();
  }

  // Draw tile depending on map mode
  drawTile(x, y, val, mapType, phase) {
    const size = this.tileSize;
    const px = x * size;
    const py = y * size;

    if (mapType === 'dungeon') {
      const colors = this.colors.dungeon;
      switch (val) {
        case 0: // Wall (draw beautyful block with 3D shadow and brick line)
          this.ctx.fillStyle = colors.wall;
          this.ctx.fillRect(px, py, size, size);
          
          // Draw light bevel border on top
          this.ctx.fillStyle = '#334155'; // Bevel grey
          this.ctx.fillRect(px, py, size, 1.5);
          
          // Draw slight inner shadow / bevel
          this.ctx.fillStyle = colors.wallShadow;
          this.ctx.fillRect(px, py + size - 2, size, 2);
          break;
        case 1: // Room Floor (cracks and moss detail)
          this.ctx.fillStyle = colors.floorRoom;
          this.ctx.fillRect(px, py, size, size);
          
          // Deterministic detail textures
          const hashFloor = (x * 17 + y * 31) % 15;
          if (hashFloor === 0) {
            this.ctx.strokeStyle = 'rgba(0, 0, 0, 0.15)';
            this.ctx.lineWidth = 1;
            this.ctx.beginPath();
            this.ctx.moveTo(px + 3, py + 2);
            this.ctx.lineTo(px + size - 4, py + size - 3);
            this.ctx.stroke();
          } else if (hashFloor === 1) {
            this.ctx.fillStyle = 'rgba(16, 185, 129, 0.08)'; //moss
            this.ctx.fillRect(px + 2, py + 2, size - 4, size - 4);
          } else {
            this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.02)';
            this.ctx.lineWidth = 1;
            this.ctx.strokeRect(px + 1, py + 1, size - 2, size - 2);
          }
          break;
        case 2: // corridoor floor (cobblestone textures)
          this.ctx.fillStyle = colors.floorCorridor;
          this.ctx.fillRect(px, py, size, size);
          
          this.ctx.strokeStyle = 'rgba(0, 0, 0, 0.08)';
          this.ctx.lineWidth = 0.5;
          this.ctx.beginPath();
          this.ctx.moveTo(px, py + size / 2);
          this.ctx.lineTo(px + size, py + size / 2);
          this.ctx.moveTo(px + size / 2, py);
          this.ctx.lineTo(px + size / 2, py + size);
          this.ctx.stroke();
          break;
        case 3: // Door
          this.ctx.fillStyle = colors.floorCorridor;
          this.ctx.fillRect(px, py, size, size);
          
          // Heavy wood arches
          this.ctx.fillStyle = '#78350f'; 
          this.ctx.fillRect(px + 1, py + 1, size - 2, size - 2);
          this.ctx.fillStyle = colors.door;
          this.ctx.fillRect(px + 3, py + 3, size - 6, size - 6);
          
          // Handle dot
          this.ctx.fillStyle = '#000000';
          this.ctx.fillRect(px + size/2 - 2, py + size/2 - 1, 2, 2);
          break;
        case 4: // Player Hero
          this.ctx.fillStyle = colors.floorRoom;
          this.ctx.fillRect(px, py, size, size);
          this.drawActor(px + size / 2, py + size / 2, size / 2 - 2, colors.player);
          break;
        case 5: // Golden Chest
          this.ctx.fillStyle = colors.floorRoom;
          this.ctx.fillRect(px, py, size, size);
          this.drawChest(px, py, size, colors.chest);
          break;
        case 6: // Orc Enemy
          this.ctx.fillStyle = colors.floorRoom;
          this.ctx.fillRect(px, py, size, size);
          this.drawActor(px + size / 2, py + size / 2, size / 2 - 3, colors.enemy, true);
          break;
        case 7: // Wall Torch
          this.ctx.fillStyle = colors.wall;
          this.ctx.fillRect(px, py, size, size);
          
          // Bevels
          this.ctx.fillStyle = '#334155';
          this.ctx.fillRect(px, py, size, 1.5);
          
          // Bracket holder
          this.ctx.fillStyle = '#4b5563';
          this.ctx.fillRect(px + size/2 - 2, py + size - 6, 4, 6);
          
          // Flame
          this.ctx.fillStyle = '#f97316'; // orange flame
          this.ctx.beginPath();
          this.ctx.arc(px + size/2, py + size - 8, 3, 0, Math.PI * 2);
          this.ctx.fill();
          
          this.ctx.fillStyle = '#fbbf24'; // gold core
          this.ctx.beginPath();
          this.ctx.arc(px + size/2, py + size - 8, 1.5, 0, Math.PI * 2);
          this.ctx.fill();
          break;
        case 8: // Cobweb
          this.ctx.fillStyle = colors.floorRoom;
          this.ctx.fillRect(px, py, size, size);
          
          this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
          this.ctx.lineWidth = 0.5;
          this.ctx.beginPath();
          this.ctx.moveTo(px, py);
          this.ctx.lineTo(px + size, py + size);
          this.ctx.moveTo(px, py + size / 2);
          this.ctx.lineTo(px + size / 2, py);
          this.ctx.stroke();
          break;
        case 9: // Pillar
          this.ctx.fillStyle = colors.floorRoom;
          this.ctx.fillRect(px, py, size, size);
          
          // Base pedestal
          this.ctx.fillStyle = '#1e293b';
          this.ctx.beginPath();
          this.ctx.arc(px + size/2, py + size/2, size/2 - 1, 0, Math.PI * 2);
          this.ctx.fill();
          
          // Column shaft
          this.ctx.fillStyle = '#64748b';
          this.ctx.beginPath();
          this.ctx.arc(px + size/2, py + size/2, size/2 - 3, 0, Math.PI * 2);
          this.ctx.fill();
          
          // Cap highlights
          this.ctx.fillStyle = '#94a3b8';
          this.ctx.beginPath();
          this.ctx.arc(px + size/2 - 1, py + size/2 - 1, size/4, 0, Math.PI * 2);
          this.ctx.fill();
          break;
        case 10: // Gold Coins
          this.ctx.fillStyle = colors.floorRoom;
          this.ctx.fillRect(px, py, size, size);
          
          this.ctx.fillStyle = '#fbbf24'; // bright gold
          this.ctx.beginPath();
          this.ctx.arc(px + 5, py + 6, 2, 0, Math.PI * 2);
          this.ctx.arc(px + 10, py + 9, 2.5, 0, Math.PI * 2);
          this.ctx.arc(px + 7, py + 11, 2, 0, Math.PI * 2);
          this.ctx.fill();
          break;
        case 11: // Broken Pot
          this.ctx.fillStyle = colors.floorRoom;
          this.ctx.fillRect(px, py, size, size);
          
          this.ctx.fillStyle = '#b45309'; // Clay brown
          this.ctx.beginPath();
          this.ctx.moveTo(px + 4, py + 4);
          this.ctx.lineTo(px + 9, py + 8);
          this.ctx.lineTo(px + 3, py + 10);
          this.ctx.closePath();
          this.ctx.fill();
          
          this.ctx.beginPath();
          this.ctx.arc(px + 11, py + 5, 2, 0, Math.PI * 2);
          this.ctx.fill();
          break;
        case 12: // Skeleton Shards
          this.ctx.fillStyle = colors.floorRoom;
          this.ctx.fillRect(px, py, size, size);
          
          this.ctx.fillStyle = '#e2e8f0'; // skull white
          this.ctx.beginPath();
          this.ctx.arc(px + 8, py + 6, 2.5, 0, Math.PI * 2);
          this.ctx.fill();
          
          this.ctx.strokeStyle = '#cbd5e1';
          this.ctx.lineWidth = 1;
          this.ctx.beginPath();
          this.ctx.moveTo(px + 4, py + 11);
          this.ctx.lineTo(px + 12, py + 11);
          this.ctx.stroke();
          break;
      }
    } else if (mapType === 'cave') {
      const colors = this.colors.cave;
      switch (val) {
        case 0: // Cave stone wall
          this.ctx.fillStyle = colors.wall;
          this.ctx.fillRect(px, py, size, size);
          
          // Stone block lines
          this.ctx.strokeStyle = '#27272a';
          this.ctx.lineWidth = 0.5;
          this.ctx.strokeRect(px + 1, py + 1, size - 2, size - 2);
          break;
        case 1: // Cave smooth path
          this.ctx.fillStyle = colors.floor;
          this.ctx.fillRect(px, py, size, size);
          
          // Organic moss speckles
          this.ctx.fillStyle = 'rgba(16, 185, 129, 0.03)';
          this.ctx.fillRect(px + (x % 3) * 4, py + (y % 3) * 4, 3, 3);
          break;
        case 4: // Player
          this.ctx.fillStyle = colors.floor;
          this.ctx.fillRect(px, py, size, size);
          this.drawActor(px + size / 2, py + size / 2, size / 2 - 2, colors.player);
          break;
        case 5: // Gold Chest
          this.ctx.fillStyle = colors.floor;
          this.ctx.fillRect(px, py, size, size);
          this.drawChest(px, py, size, colors.chest);
          break;
        case 6: // Cave spider/enemy
          this.ctx.fillStyle = colors.floor;
          this.ctx.fillRect(px, py, size, size);
          this.drawActor(px + size / 2, py + size / 2, size / 2 - 3, colors.enemy, true);
          break;
        case 13: // Water Pool
          this.ctx.fillStyle = '#1d4ed8'; // deep blue water
          this.ctx.fillRect(px, py, size, size);
          
          // Ripple circle detail
          this.ctx.strokeStyle = '#3b82f6';
          this.ctx.lineWidth = 0.5;
          this.ctx.strokeRect(px + 2, py + 2, size - 4, size - 4);
          break;
        case 14: // Magma Pool
          this.ctx.fillStyle = '#b91c1c'; // basalt red
          this.ctx.fillRect(px, py, size, size);
          
          // Magma crack highlights
          this.ctx.fillStyle = '#f97316'; // orange glow
          this.ctx.fillRect(px + 3, py + 2, 4, 2);
          this.ctx.fillRect(px + 8, py + 9, 3, 3);
          break;
        case 15: // Stalagmite
          this.ctx.fillStyle = colors.floor;
          this.ctx.fillRect(px, py, size, size);
          
          // Pointy stone spire
          this.ctx.fillStyle = '#3f3f46';
          this.ctx.beginPath();
          this.ctx.moveTo(px + size/2, py + 2);
          this.ctx.lineTo(px + size - 3, py + size - 2);
          this.ctx.lineTo(px + 3, py + size - 2);
          this.ctx.closePath();
          this.ctx.fill();
          
          // Highlight cap
          this.ctx.fillStyle = '#71717a';
          this.ctx.beginPath();
          this.ctx.moveTo(px + size/2, py + 2);
          this.ctx.lineTo(px + size/2 + 2, py + 6);
          this.ctx.lineTo(px + size/2 - 2, py + 6);
          this.ctx.closePath();
          this.ctx.fill();
          break;
      }
    } else if (mapType === 'terrain') {
      const colors = this.colors.terrain;
      if (phase === 'heightmap') {
        // Render height values directly as gorgeous grayscale
        const v = Math.round(val * 255);
        this.ctx.fillStyle = `rgb(${v}, ${v}, ${v})`;
        this.ctx.fillRect(px, py, size, size);
      } else {
        // Biome mapping
        switch (val) {
          case 0: // Deep Water
            this.ctx.fillStyle = colors.deepWater;
            break;
          case 0.5: // Shallow Water
            this.ctx.fillStyle = colors.shallowWater;
            break;
          case 1: // Beach
            this.ctx.fillStyle = colors.sand;
            break;
          case 2: // Plains
            this.ctx.fillStyle = colors.grass;
            break;
          case 3: // Forest (Draw organic pine tree silhouette)
            this.ctx.fillStyle = colors.forest;
            this.ctx.fillRect(px, py, size, size);
            
            this.ctx.fillStyle = '#14532d'; // Pine shadow green
            this.ctx.beginPath();
            this.ctx.moveTo(px + size / 2, py + 3);
            this.ctx.lineTo(px + size - 3, py + size - 2);
            this.ctx.lineTo(px + 3, py + size - 2);
            this.ctx.closePath();
            this.ctx.fill();
            break;
          case 4: // Stone Mounts (slate rocky peaks)
            this.ctx.fillStyle = colors.rock;
            this.ctx.fillRect(px, py, size, size);
            
            this.ctx.fillStyle = '#44403c'; // dark slate peak
            this.ctx.beginPath();
            this.ctx.moveTo(px + size / 2, py + 4);
            this.ctx.lineTo(px + size - 2, py + size);
            this.ctx.lineTo(px + 2, py + size);
            this.ctx.closePath();
            this.ctx.fill();
            break;
          case 5: // Snow (Rocky peaks with beveled snow caps)
            this.ctx.fillStyle = colors.rock;
            this.ctx.fillRect(px, py, size, size);
            
            // Stone base peak
            this.ctx.fillStyle = '#44403c'; 
            this.ctx.beginPath();
            this.ctx.moveTo(px + size / 2, py + 2);
            this.ctx.lineTo(px + size - 1, py + size);
            this.ctx.lineTo(px + 1, py + size);
            this.ctx.closePath();
            this.ctx.fill();
            
            // White snow cap
            this.ctx.fillStyle = '#fafaf9'; // pure white
            this.ctx.beginPath();
            this.ctx.moveTo(px + size / 2, py + 2);
            this.ctx.lineTo(px + size / 2 + 4, py + 7);
            this.ctx.lineTo(px + size / 2 - 4, py + 7);
            this.ctx.closePath();
            this.ctx.fill();
            break;
          case 7: // Keep Castle
            this.ctx.fillStyle = colors.grass;
            this.ctx.fillRect(px, py, size, size);
            this.drawCastle(px, py, size, colors.city);
            return;
          case 8: // Trade ship
            this.ctx.fillStyle = colors.shallowWater;
            this.ctx.fillRect(px, py, size, size);
            this.drawShip(px, py, size, colors.ship);
            return;
        }
        this.ctx.fillRect(px, py, size, size);
      }
    }
  }

  // Draw circular character actor (with optional spikes for hostile enemies)
  drawActor(cx, cy, r, color, isEnemy = false) {
    this.ctx.shadowColor = color;
    this.ctx.shadowBlur = 6;
    
    this.ctx.fillStyle = color;
    this.ctx.beginPath();
    this.ctx.arc(cx, cy, r, 0, Math.PI * 2);
    this.ctx.fill();

    this.ctx.shadowBlur = 0; // Reset shadow

    // Add detailed inner pattern
    this.ctx.strokeStyle = '#000000';
    this.ctx.lineWidth = 1;
    this.ctx.beginPath();
    
    if (isEnemy) {
      // Draw angry eyes (cross)
      this.ctx.moveTo(cx - 2, cy - 2);
      this.ctx.lineTo(cx - 0.5, cy - 0.5);
      this.ctx.moveTo(cx + 2, cy - 2);
      this.ctx.lineTo(cx + 0.5, cy - 0.5);
      this.ctx.stroke();
    } else {
      // Draw standard inner shield details
      this.ctx.arc(cx, cy, r - 2, 0, Math.PI * 2);
      this.ctx.stroke();
    }
  }

  // Draw gold chest detail
  drawChest(px, py, size, color) {
    const margin = 3;
    const cx = px + margin;
    const cy = py + margin + 1;
    const w = size - margin * 2;
    const h = size - margin * 2 - 1;

    this.ctx.shadowColor = color;
    this.ctx.shadowBlur = 6;
    
    // Main gold box
    this.ctx.fillStyle = '#78350f'; // wood frame
    this.ctx.fillRect(cx, cy, w, h);
    
    this.ctx.fillStyle = color; // gold plates
    this.ctx.fillRect(cx + 2, cy + 2, w - 4, 3);
    this.ctx.fillRect(cx + 2, cy + 6, w - 4, h - 8);

    // Iron locking band
    this.ctx.fillStyle = '#4b5563';
    this.ctx.fillRect(px + size/2 - 1, cy, 2, h);
    
    // Keyhole lock
    this.ctx.fillStyle = '#000';
    this.ctx.fillRect(px + size/2 - 2, cy + 4, 4, 3);
    
    this.ctx.shadowBlur = 0;
  }

  drawCastle(px, py, size, color) {
    this.ctx.shadowColor = color;
    this.ctx.shadowBlur = 8;
    this.ctx.fillStyle = color;
    
    // Draw triple towers
    this.ctx.fillRect(px + 2, py + 6, 3, 7);
    this.ctx.fillRect(px + 6, py + 3, 4, 10);
    this.ctx.fillRect(px + 11, py + 6, 3, 7);
    
    // Crest flags
    this.ctx.fillStyle = '#fbbf24';
    this.ctx.beginPath();
    this.ctx.moveTo(px + 8, py + 1);
    this.ctx.lineTo(px + 11, py + 2);
    this.ctx.lineTo(px + 8, py + 3);
    this.ctx.closePath();
    this.ctx.fill();

    this.ctx.shadowBlur = 0;
  }

  drawShip(px, py, size, color) {
    this.ctx.fillStyle = '#7c2d12'; // Wood hull
    this.ctx.beginPath();
    this.ctx.moveTo(px + 3, py + 10);
    this.ctx.lineTo(px + 13, py + 10);
    this.ctx.lineTo(px + 11, py + 13);
    this.ctx.lineTo(px + 5, py + 13);
    this.ctx.closePath();
    this.ctx.fill();

    // Sails
    this.ctx.fillStyle = color;
    this.ctx.beginPath();
    this.ctx.moveTo(px + 8, py + 2);
    this.ctx.lineTo(px + 5, py + 9);
    this.ctx.lineTo(px + 8, py + 9);
    this.ctx.closePath();
    this.ctx.fill();

    this.ctx.beginPath();
    this.ctx.moveTo(px + 8, py + 4);
    this.ctx.lineTo(px + 11, py + 9);
    this.ctx.lineTo(px + 8, py + 9);
    this.ctx.closePath();
    this.ctx.fill();
  }

  // Draw overlay frames for active nodes, splits, corridoors
  drawDungeonOverlays(snapshot) {
    const size = this.tileSize;

    // 1. Draw split lines
    if (snapshot.highlights) {
      snapshot.highlights.forEach(h => {
        if (h.type === 'split_v') {
          this.ctx.fillStyle = this.colors.dungeon.splitV;
          this.ctx.fillRect(h.x * size, h.y * size, size, h.h * size);
          
          this.ctx.strokeStyle = '#ef4444';
          this.ctx.lineWidth = 1.5;
          this.ctx.beginPath();
          this.ctx.moveTo(h.x * size + size/2, h.y * size);
          this.ctx.lineTo(h.x * size + size/2, (h.y + h.h) * size);
          this.ctx.stroke();
        } else if (h.type === 'split_h') {
          this.ctx.fillStyle = this.colors.dungeon.splitH;
          this.ctx.fillRect(h.x * size, h.y * size, h.w * size, size);
          
          this.ctx.strokeStyle = '#3b82f6';
          this.ctx.lineWidth = 1.5;
          this.ctx.beginPath();
          this.ctx.moveTo(h.x * size, h.y * size + size/2);
          this.ctx.lineTo((h.x + h.w) * size, h.y * size + size/2);
          this.ctx.stroke();
        } else if (h.type === 'corridor_highlight') {
          this.ctx.fillStyle = this.colors.dungeon.highlightCorridor;
          this.ctx.fillRect(h.x * size, h.y * size, size, size);
        }
      });
    }

    // 2. Draw border of the Active Partition / Node currently computed
    if (snapshot.highlightNode) {
      const node = snapshot.highlightNode;
      this.ctx.strokeStyle = '#22c55e'; // glowing green border
      this.ctx.lineWidth = 2;
      this.ctx.shadowColor = '#22c55e';
      this.ctx.shadowBlur = 8;
      this.ctx.strokeRect(node.x * size + 1, node.y * size + 1, node.w * size - 2, node.h * size - 2);
      this.ctx.shadowBlur = 0;
    }
  }

  // Draw overlay frames for isolated parts, or iterations
  drawCaveOverlays(snapshot) {
    const size = this.tileSize;

    if (snapshot.highlights) {
      snapshot.highlights.forEach(h => {
        if (h.type === 'isolated_chamber_highlight') {
          this.ctx.fillStyle = this.colors.cave.isolatedHighlight;
          this.ctx.fillRect(h.x * size, h.y * size, size, size);
          
          this.ctx.strokeStyle = '#ef4444';
          this.ctx.lineWidth = 0.5;
          this.ctx.strokeRect(h.x * size, h.y * size, size, size);
        } else if (h.type === 'ca_wall') {
          this.ctx.fillStyle = 'rgba(239, 68, 68, 0.15)';
          this.ctx.fillRect(h.x * size, h.y * size, size, size);
        } else if (h.type === 'ca_floor') {
          this.ctx.fillStyle = 'rgba(16, 185, 129, 0.15)';
          this.ctx.fillRect(h.x * size, h.y * size, size, size);
        }
      });
    }
  }

  // Topographic lines overlay for map height
  drawTerrainOverlays(snapshot) {
    if (snapshot.phase === 'heightmap' || !snapshot.heightMap) return;
    
    const size = this.tileSize;
    const grid = snapshot.grid;
    const height = grid.length;
    const width = grid[0].length;
    
    // Draw topographic outlines (contours) at distinct boundaries
    this.ctx.strokeStyle = 'rgba(0, 0, 0, 0.08)';
    this.ctx.lineWidth = 1;
    this.ctx.beginPath();
    
    for (let y = 0; y < height - 1; y++) {
      for (let x = 0; x < width - 1; x++) {
        // If current biome code is different from right/bottom neighbor, draw border segment
        const val = grid[y][x];
        const rightVal = grid[y][x+1];
        const downVal = grid[y+1][x];
        
        if (val !== rightVal) {
          this.ctx.moveTo((x + 1) * size, y * size);
          this.ctx.lineTo((x + 1) * size, (y + 1) * size);
        }
        if (val !== downVal) {
          this.ctx.moveTo(x * size, (y + 1) * size);
          this.ctx.lineTo((x + 1) * size, (y + 1) * size);
        }
      }
    }
    this.ctx.stroke();
  }
}
