/**
 * TileLoader - Handles loading and caching of SVG tiles
 */

export class TileLoader {
    constructor(baseUrl) {
        this.baseUrl = baseUrl;
        this.cache = new Map();
        this.loading = new Map();
        this.maxCacheSize = 50; // Maximum tiles to keep in cache
    }
    
    /**
     * Load a tile by coordinates
     */
    async loadTile(lat, lng) {
        // Format coordinates to match tile naming convention (3 decimal places)
        const latStr = lat.toFixed(3);
        const lngStr = lng.toFixed(3);
        const tileKey = `${latStr}_${lngStr}`;
        const tileUrl = `${this.baseUrl}${tileKey}.svg.gz`;
        
        // Check cache first
        if (this.cache.has(tileKey)) {
            return this.cache.get(tileKey);
        }
        
        // Check if already loading
        if (this.loading.has(tileKey)) {
            return this.loading.get(tileKey);
        }
        
        // Start loading
        const loadPromise = this.fetchTile(tileUrl, tileKey);
        this.loading.set(tileKey, loadPromise);
        
        try {
            const svgContent = await loadPromise;
            
            // Cache the result
            this.addToCache(tileKey, svgContent);
            
            // Remove from loading
            this.loading.delete(tileKey);
            
            return svgContent;
        } catch (error) {
            // Remove from loading on error
            this.loading.delete(tileKey);
            throw error;
        }
    }
    
    /**
     * Fetch tile from server
     */
    async fetchTile(url, tileKey) {
        try {
            const response = await fetch(url);
            
            if (!response.ok) {
                if (response.status === 404) {
                    // Tile doesn't exist - this is normal for areas without coverage
                    return null;
                }
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            // Get the response as array buffer for manual decompression
            const arrayBuffer = await response.arrayBuffer();
            
            // Decompress gzipped content
            let svgContent;
            
            // Check if DecompressionStream is available (modern browsers)
            if (typeof DecompressionStream !== 'undefined') {
                try {
                    const stream = new DecompressionStream('gzip');
                    const writer = stream.writable.getWriter();
                    const reader = stream.readable.getReader();
                    
                    // Write the compressed data
                    writer.write(new Uint8Array(arrayBuffer));
                    writer.close();
                    
                    // Read the decompressed data
                    const chunks = [];
                    let result;
                    while (!(result = await reader.read()).done) {
                        chunks.push(result.value);
                    }
                    
                    // Convert to string
                    const decoder = new TextDecoder();
                    svgContent = decoder.decode(new Uint8Array(chunks.reduce((acc, chunk) => [...acc, ...chunk], [])));
                } catch (decompressionError) {
                    console.error(`Failed to decompress tile ${tileKey} with DecompressionStream:`, decompressionError);
                    return null;
                }
            } else {
                // Fallback: Use pako library for gzip decompression
                if (typeof pako !== 'undefined') {
                    try {
                        const uint8Array = new Uint8Array(arrayBuffer);
                        const decompressed = pako.ungzip(uint8Array);
                        const decoder = new TextDecoder();
                        svgContent = decoder.decode(decompressed);
                    } catch (pakoError) {
                        console.error(`Failed to decompress tile ${tileKey} with pako:`, pakoError);
                        return null;
                    }
                } else {
                    console.error(`No gzip decompression available for tile ${tileKey}. DecompressionStream and pako are both unavailable.`);
                    return null;
                }
            }
            
            // Validate SVG content
            if (!svgContent.includes('<svg') && !svgContent.includes('<g')) {
                console.warn(`Invalid SVG content for tile ${tileKey}`);
                return null;
            }
            
            // Extract just the content inside the SVG (not the SVG tag itself)
            const parser = new DOMParser();
            const doc = parser.parseFromString(svgContent, 'image/svg+xml');
            const svgElement = doc.querySelector('svg');
            
            if (svgElement) {
                // Return inner content of SVG
                return svgElement.innerHTML;
            } else {
                // Return as-is if it's already just the inner content
                return svgContent;
            }
        } catch (error) {
            console.error(`Failed to fetch tile ${tileKey}:`, error);
            return null;
        }
    }
    
    /**
     * Add tile to cache with LRU eviction
     */
    addToCache(key, content) {
        // Don't cache null content
        if (content === null) return;
        
        // If cache is full, remove oldest entry
        if (this.cache.size >= this.maxCacheSize) {
            const firstKey = this.cache.keys().next().value;
            this.cache.delete(firstKey);
        }
        
        this.cache.set(key, content);
    }
    
    /**
     * Preload tiles for an area
     */
    async preloadArea(bounds, priority = false) {
        const tiles = this.getTilesInBounds(bounds);
        
        if (priority) {
            // Load all tiles in parallel for priority areas
            const promises = tiles.map(tile => 
                this.loadTile(tile.lat, tile.lng).catch(() => null)
            );
            await Promise.all(promises);
        } else {
            // Load tiles sequentially for background loading
            for (const tile of tiles) {
                try {
                    await this.loadTile(tile.lat, tile.lng);
                } catch (error) {
                    // Continue loading other tiles on error
                    console.error(`Failed to preload tile:`, error);
                }
            }
        }
    }
    
    /**
     * Get list of tiles in bounds
     */
    getTilesInBounds(bounds) {
        const TILE_SIZE = 0.01; // 0.01 degrees per tile
        const tiles = [];
        
        const startLat = Math.floor(bounds.south / TILE_SIZE) * TILE_SIZE;
        const endLat = Math.ceil(bounds.north / TILE_SIZE) * TILE_SIZE;
        const startLng = Math.floor(bounds.west / TILE_SIZE) * TILE_SIZE;
        const endLng = Math.ceil(bounds.east / TILE_SIZE) * TILE_SIZE;
        
        for (let lat = startLat; lat < endLat; lat += TILE_SIZE) {
            for (let lng = startLng; lng < endLng; lng += TILE_SIZE) {
                tiles.push({
                    lat: Math.round(lat * 1000) / 1000,  // Round to 3 decimal places
                    lng: Math.round(lng * 1000) / 1000   // Round to 3 decimal places
                });
            }
        }
        
        return tiles;
    }
    
    /**
     * Clear cache
     */
    clearCache() {
        this.cache.clear();
    }
    
    /**
     * Get cache statistics
     */
    getCacheStats() {
        return {
            size: this.cache.size,
            maxSize: this.maxCacheSize,
            loading: this.loading.size
        };
    }
}