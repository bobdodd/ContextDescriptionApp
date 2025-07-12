/**
 * LocationService - Handles geolocation and location search
 */

export class LocationService extends EventTarget {
    constructor() {
        super();
        
        this.watchId = null;
        this.lastLocation = null;
        this.isTracking = false;
        
        // Options for geolocation
        this.geoOptions = {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 30000
        };
    }
    
    /**
     * Get current location once
     */
    async getCurrentLocation() {
        return new Promise((resolve, reject) => {
            if (!navigator.geolocation) {
                reject(new Error('Geolocation is not supported by your browser'));
                return;
            }
            
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    const location = {
                        lat: position.coords.latitude,
                        lng: position.coords.longitude,
                        accuracy: position.coords.accuracy,
                        timestamp: position.timestamp
                    };
                    
                    this.lastLocation = location;
                    this.dispatchEvent(new CustomEvent('locationUpdate', { detail: location }));
                    resolve(location);
                },
                (error) => {
                    this.handleLocationError(error);
                    reject(error);
                },
                this.geoOptions
            );
        });
    }
    
    /**
     * Start tracking location
     */
    startTracking() {
        if (this.isTracking) return;
        
        if (!navigator.geolocation) {
            throw new Error('Geolocation is not supported by your browser');
        }
        
        this.watchId = navigator.geolocation.watchPosition(
            (position) => {
                const location = {
                    lat: position.coords.latitude,
                    lng: position.coords.longitude,
                    accuracy: position.coords.accuracy,
                    timestamp: position.timestamp
                };
                
                this.lastLocation = location;
                this.isTracking = true;
                this.dispatchEvent(new CustomEvent('locationUpdate', { detail: location }));
            },
            (error) => {
                this.handleLocationError(error);
            },
            this.geoOptions
        );
    }
    
    /**
     * Stop tracking location
     */
    stopTracking() {
        if (this.watchId !== null) {
            navigator.geolocation.clearWatch(this.watchId);
            this.watchId = null;
            this.isTracking = false;
            this.dispatchEvent(new CustomEvent('trackingStopped'));
        }
    }
    
    /**
     * Handle location errors
     */
    handleLocationError(error) {
        let message = 'Unable to get location';
        
        switch(error.code) {
            case error.PERMISSION_DENIED:
                message = 'Location permission denied';
                break;
            case error.POSITION_UNAVAILABLE:
                message = 'Location information unavailable';
                break;
            case error.TIMEOUT:
                message = 'Location request timed out';
                break;
        }
        
        this.dispatchEvent(new CustomEvent('locationError', { 
            detail: { error, message } 
        }));
    }
    
    /**
     * Search for a location (placeholder for geocoding)
     */
    async search(query) {
        // This is a placeholder implementation
        // In a real app, this would call a geocoding API
        
        // For demo purposes, return some example Toronto locations
        const exampleLocations = {
            'cn tower': { lat: 43.6426, lng: -79.3871, name: 'CN Tower' },
            'union station': { lat: 43.6453, lng: -79.3806, name: 'Union Station' },
            'toronto city hall': { lat: 43.6532, lng: -79.3832, name: 'Toronto City Hall' },
            'rogers centre': { lat: 43.6414, lng: -79.3894, name: 'Rogers Centre' },
            'harbourfront': { lat: 43.6389, lng: -79.3831, name: 'Harbourfront' },
            'distillery district': { lat: 43.6503, lng: -79.3596, name: 'Distillery District' },
            'yonge dundas square': { lat: 43.6561, lng: -79.3802, name: 'Yonge-Dundas Square' },
            'yvr': { lat: 49.1967, lng: -123.1815, name: 'Vancouver International Airport' },
            'yvr airport': { lat: 49.1967, lng: -123.1815, name: 'Vancouver International Airport' }
        };
        
        const lowerQuery = query.toLowerCase();
        
        // Check for exact matches
        if (exampleLocations[lowerQuery]) {
            return [exampleLocations[lowerQuery]];
        }
        
        // Check for partial matches
        const matches = [];
        for (const [key, location] of Object.entries(exampleLocations)) {
            if (key.includes(lowerQuery) || location.name.toLowerCase().includes(lowerQuery)) {
                matches.push(location);
            }
        }
        
        if (matches.length > 0) {
            return matches;
        }
        
        // Try to parse as coordinates
        const coordMatch = query.match(/(-?\d+\.?\d*),\s*(-?\d+\.?\d*)/);
        if (coordMatch) {
            const lat = parseFloat(coordMatch[1]);
            const lng = parseFloat(coordMatch[2]);
            
            if (!isNaN(lat) && !isNaN(lng) && 
                lat >= -90 && lat <= 90 && 
                lng >= -180 && lng <= 180) {
                return [{
                    lat,
                    lng,
                    name: `${lat.toFixed(4)}, ${lng.toFixed(4)}`
                }];
            }
        }
        
        // No matches found
        return [];
    }
    
    /**
     * Get distance between two points (in meters)
     */
    getDistance(point1, point2) {
        const R = 6371000; // Earth radius in meters
        const lat1 = point1.lat * Math.PI / 180;
        const lat2 = point2.lat * Math.PI / 180;
        const deltaLat = (point2.lat - point1.lat) * Math.PI / 180;
        const deltaLng = (point2.lng - point1.lng) * Math.PI / 180;
        
        const a = Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
                  Math.cos(lat1) * Math.cos(lat2) *
                  Math.sin(deltaLng / 2) * Math.sin(deltaLng / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        
        return R * c;
    }
    
    /**
     * Get bearing between two points (in degrees)
     */
    getBearing(point1, point2) {
        const lat1 = point1.lat * Math.PI / 180;
        const lat2 = point2.lat * Math.PI / 180;
        const deltaLng = (point2.lng - point1.lng) * Math.PI / 180;
        
        const x = Math.sin(deltaLng) * Math.cos(lat2);
        const y = Math.cos(lat1) * Math.sin(lat2) -
                  Math.sin(lat1) * Math.cos(lat2) * Math.cos(deltaLng);
        
        const bearing = Math.atan2(x, y) * 180 / Math.PI;
        
        return (bearing + 360) % 360;
    }
    
    /**
     * Format distance for display
     */
    formatDistance(meters) {
        if (meters < 1000) {
            return `${Math.round(meters)} meters`;
        } else {
            return `${(meters / 1000).toFixed(1)} km`;
        }
    }
    
    /**
     * Convert bearing to compass direction
     */
    bearingToCompass(bearing) {
        const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
        const index = Math.round(bearing / 45) % 8;
        return directions[index];
    }
}