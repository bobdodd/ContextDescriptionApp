/**
 * CompassService - Handles device orientation and compass functionality
 */

export class CompassService extends EventTarget {
    constructor() {
        super();
        
        this.heading = null;
        this.isSupported = false;
        this.isActive = false;
        this.watchId = null;
        
        // Check for support
        this.checkSupport();
    }
    
    /**
     * Check if device orientation is supported
     */
    checkSupport() {
        // Check for DeviceOrientationEvent
        if (window.DeviceOrientationEvent) {
            // iOS 13+ requires permission
            if (typeof DeviceOrientationEvent.requestPermission === 'function') {
                this.isSupported = true;
                this.needsPermission = true;
            } else {
                // Android and older iOS
                this.isSupported = true;
                this.needsPermission = false;
            }
        } else {
            this.isSupported = false;
        }
    }
    
    /**
     * Start compass tracking
     */
    async start() {
        if (!this.isSupported) {
            throw new Error('Device orientation is not supported');
        }
        
        if (this.isActive) return;
        
        try {
            // Request permission on iOS 13+
            if (this.needsPermission) {
                const permission = await DeviceOrientationEvent.requestPermission();
                if (permission !== 'granted') {
                    throw new Error('Device orientation permission denied');
                }
            }
            
            // Start listening for orientation events
            window.addEventListener('deviceorientation', this.handleOrientation.bind(this));
            this.isActive = true;
            
            this.dispatchEvent(new CustomEvent('started'));
        } catch (error) {
            this.dispatchEvent(new CustomEvent('error', { detail: error }));
            throw error;
        }
    }
    
    /**
     * Stop compass tracking
     */
    stop() {
        if (!this.isActive) return;
        
        window.removeEventListener('deviceorientation', this.handleOrientation.bind(this));
        this.isActive = false;
        this.heading = null;
        
        this.dispatchEvent(new CustomEvent('stopped'));
    }
    
    /**
     * Handle device orientation event
     */
    handleOrientation(event) {
        // Check if we're getting valid data
        let hasValidData = false;
        
        if (event.absolute && event.alpha !== null) {
            // Calculate compass heading
            // alpha is rotation around z-axis (0-360)
            // On iOS, alpha is relative to current orientation
            // On Android, it's relative to true north
            let heading = 360 - event.alpha;
            
            // Normalize to 0-360
            if (heading < 0) heading += 360;
            if (heading >= 360) heading -= 360;
            
            this.heading = Math.round(heading);
            hasValidData = true;
            
            this.dispatchEvent(new CustomEvent('headingChange', {
                detail: {
                    heading: this.heading,
                    accuracy: event.absolute ? 'high' : 'low'
                }
            }));
        } else if (event.webkitCompassHeading !== undefined) {
            // iOS specific compass heading
            this.heading = Math.round(event.webkitCompassHeading);
            hasValidData = true;
            
            this.dispatchEvent(new CustomEvent('headingChange', {
                detail: {
                    heading: this.heading,
                    accuracy: event.webkitCompassAccuracy || 'medium'
                }
            }));
        }
        
        // If no valid data after a few tries, mark as unsupported
        if (!hasValidData) {
            this.noDataCount = (this.noDataCount || 0) + 1;
            if (this.noDataCount > 5) {
                this.stop();
                this.dispatchEvent(new CustomEvent('error', { 
                    detail: new Error('No compass data available') 
                }));
            }
        }
    }
    
    /**
     * Get current heading
     */
    getHeading() {
        return this.heading;
    }
    
    /**
     * Convert heading to compass direction
     */
    static headingToDirection(heading) {
        const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
        const index = Math.round(heading / 45) % 8;
        return directions[index];
    }
    
    /**
     * Convert heading to full direction name
     */
    static headingToFullDirection(heading) {
        const directions = [
            'North', 'Northeast', 'East', 'Southeast',
            'South', 'Southwest', 'West', 'Northwest'
        ];
        const index = Math.round(heading / 45) % 8;
        return directions[index];
    }
    
    /**
     * Get relative direction between two headings
     */
    static getRelativeDirection(fromHeading, toHeading) {
        let diff = toHeading - fromHeading;
        
        // Normalize to -180 to 180
        if (diff > 180) diff -= 360;
        if (diff < -180) diff += 360;
        
        if (Math.abs(diff) < 22.5) return 'ahead';
        if (Math.abs(diff) > 157.5) return 'behind';
        if (diff > 0 && diff < 67.5) return 'ahead to your right';
        if (diff > 67.5 && diff < 112.5) return 'to your right';
        if (diff > 112.5) return 'behind to your right';
        if (diff < 0 && diff > -67.5) return 'ahead to your left';
        if (diff < -67.5 && diff > -112.5) return 'to your left';
        return 'behind to your left';
    }
}