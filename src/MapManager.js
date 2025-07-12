/**
 * MapManager - Handles map rendering and interaction
 */

export class MapManager extends EventTarget {
    constructor(svgElementId, tileLoader, config) {
        super();
        
        this.svg = document.getElementById(svgElementId);
        this.tileContainer = document.getElementById('tile-container');
        this.overlayContainer = document.getElementById('overlay-container');
        this.tileLoader = tileLoader;
        this.config = config;
        
        // Map state
        this.center = config.defaultCenter;
        this.zoom = config.defaultZoom;
        this.viewBox = { x: 0, y: 0, width: 800, height: 600 };
        
        // Loaded tiles cache
        this.loadedTiles = new Map();
        this.tileSize = 800; // SVG units per tile (matching tile SVG dimensions)
        
        // Interaction state
        this.isDragging = false;
        this.dragStart = null;
        
        // Constants
        this.TILE_DEGREE_SIZE = 0.01; // Each tile covers 0.01° x 0.01°
        
        // Location marker
        this.locationMarker = null;
        this.isDraggingPin = false;
        this.pinDragStart = null;
    }
    
    /**
     * Initialize the map
     */
    async initialize() {
        // Get actual SVG dimensions
        const rect = this.svg.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
            this.viewBox.width = rect.width;
            this.viewBox.height = rect.height;
        }
        
        // Set up SVG viewBox
        this.updateViewBox();
        
        // Set up event listeners
        this.setupEventListeners();
        
        // Load initial tiles
        await this.loadVisibleTiles();
        
        // Dispatch ready event
        this.dispatchEvent(new CustomEvent('ready'));
    }
    
    /**
     * Set up event listeners for map interaction
     */
    setupEventListeners() {
        // Mouse events
        this.svg.addEventListener('mousedown', this.handleMouseDown.bind(this));
        this.svg.addEventListener('mousemove', this.handleMouseMove.bind(this));
        this.svg.addEventListener('mouseup', this.handleMouseUp.bind(this));
        this.svg.addEventListener('wheel', this.handleWheel.bind(this), { passive: false });
        
        // Touch events
        this.svg.addEventListener('touchstart', this.handleTouchStart.bind(this), { passive: true });
        this.svg.addEventListener('touchmove', this.handleTouchMove.bind(this), { passive: false });
        this.svg.addEventListener('touchend', this.handleTouchEnd.bind(this), { passive: true });
        
        // Click for selection
        this.svg.addEventListener('click', this.handleClick.bind(this));
    }
    
    /**
     * Update SVG viewBox based on center and zoom
     */
    updateViewBox() {
        const scale = Math.pow(2, this.zoom - 16); // Base zoom is 16
        const width = this.viewBox.width / scale;
        const height = this.viewBox.height / scale;
        
        // Convert lat/lng to pixel coordinates
        const centerX = this.lngToPixel(this.center.lng);
        const centerY = this.latToPixel(this.center.lat);
        
        // Calculate viewBox
        const x = centerX - width / 2;
        const y = centerY - height / 2;
        
        this.svg.setAttribute('viewBox', `${x} ${y} ${width} ${height}`);
        
        // Load tiles for new view
        this.loadVisibleTiles();
        
        // Update marker position if it exists
        if (this.markerLocation) {
            this.updateLocationMarker(this.markerLocation.lat, this.markerLocation.lng);
        }
    }
    
    /**
     * Convert latitude to pixel coordinate
     */
    latToPixel(lat) {
        // Simple linear projection for small areas
        // Each tile is 0.01 degrees, so 100 tiles per degree
        // Use a scale factor based on zoom level
        const scale = Math.pow(2, this.zoom - 16);
        return -lat * 100 * this.tileSize * scale;
    }
    
    /**
     * Convert longitude to pixel coordinate
     */
    lngToPixel(lng) {
        // Simple linear projection for small areas
        const scale = Math.pow(2, this.zoom - 16);
        return lng * 100 * this.tileSize * scale;
    }
    
    /**
     * Convert pixel to latitude
     */
    pixelToLat(y) {
        const scale = Math.pow(2, this.zoom - 16);
        return -y / (100 * this.tileSize * scale);
    }
    
    /**
     * Convert pixel to longitude
     */
    pixelToLng(x) {
        const scale = Math.pow(2, this.zoom - 16);
        return x / (100 * this.tileSize * scale);
    }
    
    /**
     * Load visible tiles
     */
    async loadVisibleTiles() {
        // Get current viewBox in world coordinates
        const viewBox = this.svg.viewBox.baseVal;
        
        console.log('Loading tiles for viewBox:', viewBox);
        
        // Convert to lat/lng bounds
        const bounds = {
            north: this.pixelToLat(viewBox.y),
            south: this.pixelToLat(viewBox.y + viewBox.height),
            west: this.pixelToLng(viewBox.x),
            east: this.pixelToLng(viewBox.x + viewBox.width)
        };
        
        console.log('Calculated bounds:', bounds);
        
        // Calculate which tiles we need
        const tiles = this.getTilesInBounds(bounds);
        console.log('Tiles to load:', tiles);
        
        // Load tiles
        for (const tile of tiles) {
            await this.loadTile(tile);
        }
        
        console.log('Loaded tiles:', this.loadedTiles.size);
        
        // Remove tiles outside view
        this.removeInvisibleTiles(tiles);
    }
    
    /**
     * Get list of tiles in bounds
     */
    getTilesInBounds(bounds) {
        const tiles = [];
        
        // Round to tile boundaries
        const startLat = Math.floor(bounds.south / this.TILE_DEGREE_SIZE) * this.TILE_DEGREE_SIZE;
        const endLat = Math.ceil(bounds.north / this.TILE_DEGREE_SIZE) * this.TILE_DEGREE_SIZE;
        const startLng = Math.floor(bounds.west / this.TILE_DEGREE_SIZE) * this.TILE_DEGREE_SIZE;
        const endLng = Math.ceil(bounds.east / this.TILE_DEGREE_SIZE) * this.TILE_DEGREE_SIZE;
        
        // Generate tile list
        for (let lat = startLat; lat < endLat; lat += this.TILE_DEGREE_SIZE) {
            for (let lng = startLng; lng < endLng; lng += this.TILE_DEGREE_SIZE) {
                tiles.push({
                    lat: Math.round(lat * 1000) / 1000,  // Round to 3 decimal places
                    lng: Math.round(lng * 1000) / 1000   // Round to 3 decimal places
                });
            }
        }
        
        return tiles;
    }
    
    /**
     * Load a single tile
     */
    async loadTile(tile) {
        const key = `${tile.lat}_${tile.lng}`;
        
        // Check if already loaded
        if (this.loadedTiles.has(key)) return;
        
        try {
            // Load tile SVG
            const tileSvg = await this.tileLoader.loadTile(tile.lat, tile.lng);
            
            if (tileSvg) {
                // Create group for tile
                const tileGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
                tileGroup.setAttribute('data-tile', key);
                
                // Calculate tile position and size
                const scale = Math.pow(2, this.zoom - 16);
                const tileWorldSize = this.TILE_DEGREE_SIZE * 100 * this.tileSize * scale;
                
                // Position tile at its bottom-left corner
                // Since latitude increases upward but SVG Y increases downward,
                // we position at the higher latitude (which is a smaller Y value)
                const x = this.lngToPixel(tile.lng);
                const y = this.latToPixel(tile.lat + this.TILE_DEGREE_SIZE);
                
                // Debug: Try adjusting for potential tile offset
                // It appears tiles might be shifted - let's test
                const tileOffset = 0; // We can adjust this if needed
                
                // Tiles are 1000 SVG units (based on viewBox="0 0 1000 1000")
                const tileScale = tileWorldSize / 1000;
                
                // Apply transform - ensure precise alignment
                const transform = `translate(${x.toFixed(6)}, ${y.toFixed(6)}) scale(${tileScale.toFixed(6)})`;
                tileGroup.setAttribute('transform', transform);
                
                // Add tile content
                tileGroup.innerHTML = tileSvg;
                
                
                // Add to container
                this.tileContainer.appendChild(tileGroup);
                
                // Cache
                this.loadedTiles.set(key, tileGroup);
            }
        } catch (error) {
            console.error(`Failed to load tile ${key}:`, error);
        }
    }
    
    /**
     * Remove tiles outside current view
     */
    removeInvisibleTiles(visibleTiles) {
        const visibleKeys = new Set(
            visibleTiles.map(t => `${t.lat}_${t.lng}`)
        );
        
        // Remove tiles not in visible set
        for (const [key, tileGroup] of this.loadedTiles) {
            if (!visibleKeys.has(key)) {
                tileGroup.remove();
                this.loadedTiles.delete(key);
            }
        }
    }
    
    /**
     * Handle mouse down
     */
    handleMouseDown(event) {
        this.isDragging = true;
        this.dragStart = {
            x: event.clientX,
            y: event.clientY,
            viewBox: { ...this.svg.viewBox.baseVal }
        };
        this.svg.style.cursor = 'grabbing';
    }
    
    /**
     * Handle mouse move
     */
    handleMouseMove(event) {
        if (!this.isDragging) return;
        
        const scale = Math.pow(2, this.zoom - 16);
        const dx = (event.clientX - this.dragStart.x) / scale;
        const dy = (event.clientY - this.dragStart.y) / scale;
        
        // Update center
        const newCenterX = this.lngToPixel(this.center.lng) - dx;
        const newCenterY = this.latToPixel(this.center.lat) - dy;
        
        this.center = {
            lat: this.pixelToLat(newCenterY),
            lng: this.pixelToLng(newCenterX)
        };
        
        this.updateViewBox();
    }
    
    /**
     * Handle mouse up
     */
    handleMouseUp() {
        this.isDragging = false;
        this.svg.style.cursor = 'grab';
    }
    
    /**
     * Handle wheel event for zoom
     */
    handleWheel(event) {
        event.preventDefault();
        
        const delta = event.deltaY > 0 ? -1 : 1;
        this.setZoom(this.zoom + delta * 0.5);
    }
    
    /**
     * Handle click for area selection or pin movement
     */
    handleClick(event) {
        if (this.isDragging) return;
        
        // Check if Shift key is held
        if (event.shiftKey) {
            // Get click position in SVG coordinates
            const pt = this.svg.createSVGPoint();
            pt.x = event.clientX;
            pt.y = event.clientY;
            
            const svgP = pt.matrixTransform(this.svg.getScreenCTM().inverse());
            
            // Convert to lat/lng
            const lat = this.pixelToLat(svgP.y);
            const lng = this.pixelToLng(svgP.x);
            
            // Update marker location
            this.updateLocationMarker(lat, lng);
            
            // Notify app of location change
            this.dispatchEvent(new CustomEvent('locationChanged', {
                detail: { lat, lng }
            }));
            
            event.preventDefault();
            event.stopPropagation();
        }
    }
    
    /**
     * Set map center
     */
    setCenter(lat, lng) {
        this.center = { lat, lng };
        this.updateViewBox();
    }
    
    /**
     * Set zoom level
     */
    setZoom(zoom) {
        this.zoom = Math.max(
            this.config.minZoom,
            Math.min(this.config.maxZoom, zoom)
        );
        this.updateViewBox();
    }
    
    /**
     * Zoom in
     */
    zoomIn() {
        this.setZoom(this.zoom + 1);
    }
    
    /**
     * Zoom out
     */
    zoomOut() {
        this.setZoom(this.zoom - 1);
    }
    
    /**
     * Pan in direction
     */
    pan(direction) {
        const panDistance = 0.002; // degrees
        
        switch(direction) {
            case 'north':
                this.center.lat += panDistance;
                break;
            case 'south':
                this.center.lat -= panDistance;
                break;
            case 'east':
                this.center.lng += panDistance;
                break;
            case 'west':
                this.center.lng -= panDistance;
                break;
        }
        
        this.updateViewBox();
    }
    
    /**
     * Go to home position
     */
    goHome() {
        this.center = this.config.defaultCenter;
        this.zoom = this.config.defaultZoom;
        this.updateViewBox();
    }
    
    /**
     * Handle window resize
     */
    handleResize() {
        const rect = this.svg.getBoundingClientRect();
        this.viewBox.width = rect.width;
        this.viewBox.height = rect.height;
        this.updateViewBox();
    }
    
    /**
     * Handle touch start
     */
    handleTouchStart(event) {
        if (event.touches.length === 1) {
            this.handleMouseDown({
                clientX: event.touches[0].clientX,
                clientY: event.touches[0].clientY
            });
        }
    }
    
    /**
     * Handle touch move
     */
    handleTouchMove(event) {
        if (event.touches.length === 1) {
            event.preventDefault();
            this.handleMouseMove({
                clientX: event.touches[0].clientX,
                clientY: event.touches[0].clientY
            });
        }
    }
    
    /**
     * Handle touch end
     */
    handleTouchEnd() {
        this.handleMouseUp();
    }
    
    /**
     * Update location marker
     */
    updateLocationMarker(lat, lng) {
        // Remove existing marker if any
        if (this.locationMarker) {
            this.locationMarker.remove();
        }
        
        // Store the location for redraws
        this.markerLocation = { lat, lng };
        
        // Calculate position in map coordinates
        const x = this.lngToPixel(lng);
        const y = this.latToPixel(lat);
        
        // Apply the exact offsets determined by clicking on the actual intersection
        // The intersection is 0.001725° south and 0.001225° east of the coordinate position
        const offsetLat = -0.001725;  // Move south
        const offsetLng = 0.001225;   // Move east
        
        const correctedX = this.lngToPixel(lng + offsetLng);
        const correctedY = this.latToPixel(lat + offsetLat);
        
        // Create pin shape
        this.locationMarker = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        this.locationMarker.setAttribute('id', 'location-marker');
        this.locationMarker.setAttribute('transform', `translate(${correctedX}, ${correctedY})`);
        
        // Get current zoom scale for pin size
        const scale = Math.pow(2, this.zoom - 16);
        const pinScale = 1 / scale; // Keep pin same size regardless of zoom
        
        // Create scaled group for pin
        const pinGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        pinGroup.setAttribute('transform', `scale(${pinScale})`);
        
        // Add shadow for visibility
        const shadow = document.createElementNS('http://www.w3.org/2000/svg', 'ellipse');
        shadow.setAttribute('cx', '0');
        shadow.setAttribute('cy', '2');
        shadow.setAttribute('rx', '12');
        shadow.setAttribute('ry', '6');
        shadow.setAttribute('fill', 'rgba(0,0,0,0.3)');
        
        // Outer glow/halo for visibility
        const halo = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        halo.setAttribute('cx', '0');
        halo.setAttribute('cy', '-35');
        halo.setAttribute('r', '25');
        halo.setAttribute('fill', 'rgba(255, 255, 255, 0.8)');
        halo.setAttribute('filter', 'blur(3px)');
        
        // Pin path (drop shape) - pointing to exact location - made larger
        const pinPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        pinPath.setAttribute('d', 'M 0 0 C -20 -20 -20 -45 0 -65 C 20 -45 20 -20 0 0 Z');
        pinPath.setAttribute('fill', '#dc2626');
        pinPath.setAttribute('stroke', '#ffffff');
        pinPath.setAttribute('stroke-width', '4');
        pinPath.setAttribute('filter', 'drop-shadow(0 2px 4px rgba(0,0,0,0.5))');
        
        // Inner circle - larger
        const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        circle.setAttribute('cx', '0');
        circle.setAttribute('cy', '-35');
        circle.setAttribute('r', '12');
        circle.setAttribute('fill', '#ffffff');
        
        // Assemble pin
        pinGroup.appendChild(halo);
        pinGroup.appendChild(shadow);
        pinGroup.appendChild(pinPath);
        pinGroup.appendChild(circle);
        
        // Make pin interactive
        pinGroup.style.cursor = 'grab';
        
        // Add event listeners for dragging
        pinGroup.addEventListener('mousedown', (e) => this.handlePinMouseDown(e));
        
        // Add to marker
        this.locationMarker.appendChild(pinGroup);
        
        // Add to overlay container (which is inside the main SVG)
        this.overlayContainer.appendChild(this.locationMarker);
        
        
    }
    
    /**
     * Handle pin mouse down
     */
    handlePinMouseDown(event) {
        // Only allow dragging with Shift key
        if (!event.shiftKey) return;
        
        event.preventDefault();
        event.stopPropagation();
        
        this.isDraggingPin = true;
        
        // Get starting position
        const pt = this.svg.createSVGPoint();
        pt.x = event.clientX;
        pt.y = event.clientY;
        const svgP = pt.matrixTransform(this.svg.getScreenCTM().inverse());
        
        this.pinDragStart = {
            x: event.clientX,
            y: event.clientY,
            svgX: svgP.x,
            svgY: svgP.y,
            markerLat: this.markerLocation.lat,
            markerLng: this.markerLocation.lng
        };
        
        // Change cursor
        event.target.style.cursor = 'grabbing';
        
        // Add document-level listeners for drag
        document.addEventListener('mousemove', this.handlePinDrag.bind(this));
        document.addEventListener('mouseup', this.handlePinDragEnd.bind(this));
    }
    
    /**
     * Handle pin drag
     */
    handlePinDrag(event) {
        if (!this.isDraggingPin || !this.pinDragStart) return;
        
        event.preventDefault();
        
        // Calculate movement in SVG coordinates
        const pt = this.svg.createSVGPoint();
        pt.x = event.clientX;
        pt.y = event.clientY;
        const svgP = pt.matrixTransform(this.svg.getScreenCTM().inverse());
        
        const dx = svgP.x - this.pinDragStart.svgX;
        const dy = svgP.y - this.pinDragStart.svgY;
        
        // Convert movement to lat/lng
        const scale = Math.pow(2, this.zoom - 16);
        const dLat = -dy / (100 * this.tileSize * scale);
        const dLng = dx / (100 * this.tileSize * scale);
        
        // Update marker position
        const newLat = this.pinDragStart.markerLat + dLat;
        const newLng = this.pinDragStart.markerLng + dLng;
        
        this.updateLocationMarker(newLat, newLng);
    }
    
    /**
     * Handle pin drag end
     */
    handlePinDragEnd(event) {
        if (!this.isDraggingPin) return;
        
        this.isDraggingPin = false;
        this.pinDragStart = null;
        
        // Restore cursor
        const pinGroup = this.locationMarker.querySelector('g');
        if (pinGroup) {
            pinGroup.style.cursor = 'grab';
        }
        
        // Remove document-level listeners
        document.removeEventListener('mousemove', this.handlePinDrag.bind(this));
        document.removeEventListener('mouseup', this.handlePinDragEnd.bind(this));
        
        // Notify app of final location
        if (this.markerLocation) {
            this.dispatchEvent(new CustomEvent('locationChanged', {
                detail: {
                    lat: this.markerLocation.lat,
                    lng: this.markerLocation.lng
                }
            }));
        }
    }
}