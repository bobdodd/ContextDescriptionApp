/**
 * Where Am I? - Mobile-first accessible location description app
 */

// Import modules
import { MapManager } from './MapManager.js';
import { DescriptionGenerator } from './DescriptionGenerator.js';
import { LocationService } from './LocationService.js';
import { CompassService } from './CompassService.js';
import { TileLoader } from './TileLoader.js';
import { CleanUIController } from './CleanUIController.js';

// Application class
class WhereAmIApp {
    constructor() {
        // Services
        this.mapManager = null;
        this.descriptionGenerator = null;
        this.locationService = null;
        this.compassService = null;
        this.uiController = null;
        this.tileLoader = null;
        
        // State
        this.currentLocation = null;
        this.currentHeading = null;
        this.lastDescription = null;
        this.autoUpdate = true;
        this.voiceEnabled = true;
        this.useTestLocation = true; // Start with test location
        this.useSimulatedCompass = false;
        this.simulatedHeading = 0;
        
        // Configuration
        this.config = {
            tileBaseUrl: 'https://bobd77.sg-host.com/tiles/',
            defaultCenter: { lat: 43.65, lng: -79.38 }, // Toronto
            testLocation: { lat: 43.6469, lng: -79.3769 }, // Yonge & Front intersection
            defaultZoom: 16, // Standard zoom level
            minZoom: 10, // Minimum zoom level (zoomed out)
            maxZoom: 20, // Maximum zoom level (zoomed in)
            updateDistanceThreshold: 10, // meters
            updateHeadingThreshold: 30, // degrees
            descriptionRadius: 100, // meters for immediate area
            distanceZones: {
                immediate: 50,    // 0-50m: Very detailed, "right here", "next to you"
                near: 100,        // 50-100m: Detailed, "nearby", "close by"
                vicinity: 200,    // 100-200m: Moderate detail, "in the vicinity"
                area: 400         // 200-400m: Basic info only, "in the area"
            },
            maxDescriptionDistance: 400 // meters - horizon for descriptions
        };
    }
    
    /**
     * Initialize the application
     */
    async init() {
        try {
            // Initialize services
            this.tileLoader = new TileLoader(this.config.tileBaseUrl);
            this.mapManager = new MapManager('map-svg', this.tileLoader, this.config);
            this.descriptionGenerator = new DescriptionGenerator(this.mapManager);
            this.locationService = new LocationService();
            this.compassService = new CompassService();
            this.uiController = new CleanUIController(this);
            
            // Set up event listeners
            this.setupEventListeners();
            
            // Initialize UI
            this.uiController.init();
            
            // Initialize map (hidden but used for data)
            await this.mapManager.initialize();
            
            // Auto-start location services
            this.startLocationTracking();
            
            console.log('Where Am I app initialized');
        } catch (error) {
            console.error('Failed to initialize app:', error);
            this.uiController.showError('Failed to initialize. Please refresh and try again.');
        }
    }
    
    /**
     * Set up event listeners
     */
    setupEventListeners() {
        // Location updates
        this.locationService.addEventListener('locationUpdate', (event) => {
            this.handleLocationUpdate(event.detail);
        });
        
        this.locationService.addEventListener('locationError', (event) => {
            this.handleLocationError(event.detail);
        });
        
        // Compass updates
        this.compassService.addEventListener('headingChange', (event) => {
            this.handleHeadingChange(event.detail);
        });
        
        this.compassService.addEventListener('error', (event) => {
            console.warn('Compass error:', event.detail);
            this.uiController.updateCompassStatus('Not available');
            this.uiController.showCompassUnavailable();
            // Enable simulated compass
            this.enableSimulatedCompass();
        });
        
        // Visibility change - pause updates when app is hidden
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                this.pauseTracking();
            } else {
                this.resumeTracking();
            }
        });
        
        // Map location changes (from control+click or drag)
        this.mapManager.addEventListener('locationChanged', (event) => {
            this.handleManualLocationChange(event.detail);
        });
        
        // Keyboard events
        document.addEventListener('keydown', (event) => {
            // Stop speech on Escape key
            if (event.key === 'Escape' && window.speechSynthesis) {
                window.speechSynthesis.cancel();
                this.uiController.showSuccess('Speech stopped');
            }
        });
    }
    
    /**
     * Start location tracking
     */
    async startLocationTracking() {
        try {
            if (this.useTestLocation) {
                // Use test location
                this.uiController.updateGPSStatus('Test Mode');
                
                // Set location immediately
                setTimeout(() => {
                    this.handleLocationUpdate(this.config.testLocation);
                }, 500); // Small delay to ensure map is ready
                
                // Still try to start compass
                if (this.compassService.isSupported) {
                    try {
                        await this.compassService.start();
                        this.uiController.updateCompassStatus('Starting...');
                    } catch (error) {
                        console.warn('Compass not available:', error);
                        this.uiController.updateCompassStatus('Not available');
                        this.uiController.showCompassUnavailable();
                        this.enableSimulatedCompass();
                    }
                }
            } else {
                // Update UI status
                this.uiController.updateGPSStatus('Starting...');
                
                // Start real location tracking
                this.locationService.startTracking();
                
                // Start compass if available
                if (this.compassService.isSupported) {
                    try {
                        await this.compassService.start();
                        this.uiController.updateCompassStatus('Starting...');
                    } catch (error) {
                        console.warn('Compass not available:', error);
                        this.uiController.updateCompassStatus('Not available');
                        this.uiController.showCompassUnavailable();
                        this.enableSimulatedCompass();
                    }
                }
            }
        } catch (error) {
            console.error('Failed to start location tracking:', error);
            this.uiController.updateGPSStatus('Error');
            this.uiController.showError('Unable to access your location. Please check permissions.');
        }
    }
    
    /**
     * Handle location update
     */
    async handleLocationUpdate(location) {
        console.log('Location update:', location);
        
        // Update GPS status
        if (!this.useTestLocation) {
            this.uiController.updateGPSStatus('Active');
        }
        
        // Check if location changed significantly
        const shouldUpdate = !this.currentLocation || 
            this.locationService.getDistance(this.currentLocation, location) > this.config.updateDistanceThreshold;
        
        // Always update the marker position for real GPS tracking
        // (even for small movements to show GPS is active)
        if (!this.useTestLocation || shouldUpdate) {
            // Update location marker
            this.mapManager.updateLocationMarker(location.lat, location.lng);
        }
        
        if (shouldUpdate) {
            this.currentLocation = location;
            
            // Update map position to the actual location
            this.mapManager.setCenter(location.lat, location.lng);
            
            // Load tiles for area
            await this.preloadAreaTiles(location);
            
            // Generate new description
            if (this.autoUpdate) {
                await this.updateLocationDescription();
            }
        }
    }
    
    /**
     * Handle location error
     */
    handleLocationError(error) {
        this.uiController.updateGPSStatus('Error');
        this.uiController.showError(error.message);
    }
    
    /**
     * Handle heading change
     */
    handleHeadingChange(data) {
        const shouldUpdate = !this.currentHeading || 
            Math.abs(data.heading - this.currentHeading) > this.config.updateHeadingThreshold;
        
        this.currentHeading = data.heading;
        
        // Update compass status to active on first valid data (unless simulated)
        if (!this.useSimulatedCompass && this.uiController.elements.compassStatus.textContent.includes('Starting')) {
            this.uiController.updateCompassStatus('Active');
        }
        
        // Update compass UI
        this.uiController.updateCompass(data.heading);
        
        // Update direction-based descriptions if needed
        if (shouldUpdate && this.autoUpdate && this.currentLocation) {
            this.updateDirectionalInfo();
        }
    }
    
    /**
     * Preload tiles around current location
     */
    async preloadAreaTiles(location) {
        const bounds = {
            north: location.lat + 0.005,
            south: location.lat - 0.005,
            east: location.lng + 0.005,
            west: location.lng - 0.005
        };
        
        await this.tileLoader.preloadArea(bounds, true);
    }
    
    /**
     * Update location description
     */
    async updateLocationDescription() {
        if (!this.currentLocation) return;
        
        console.log('Updating location description for:', this.currentLocation);
        
        try {
            // Show loading state
            this.uiController.showLoadingDescription();
            
            // Get description options
            const options = this.uiController.getDescriptionOptions();
            
            // Generate description for current location (no offset since pin has no offset)
            const area = {
                center: {
                    lat: this.currentLocation.lat,
                    lng: this.currentLocation.lng
                },
                radius: this.config.descriptionRadius,
                heading: this.currentHeading || 0 // Default to north if no heading
            };
            console.log('Description generation searching at:', area.center);
            
            // Add distance configuration to options
            options.maxDistance = this.config.maxDescriptionDistance;
            options.distanceZones = this.config.distanceZones;
            
            const description = await this.descriptionGenerator.generateDescription(area, options);
            
            // Add current address/intersection info
            const intersection = await this.findNearestIntersection();
            if (intersection) {
                description.intersection = intersection;
            }
            
            // Display description
            this.uiController.displayLocationDescription(description);
            
            // Store for reference
            this.lastDescription = description;
            
            // Announce if voice enabled
            if (this.voiceEnabled && this.autoUpdate) {
                this.announceLocation(description);
            }
        } catch (error) {
            console.error('Failed to generate description:', error);
            console.error('Error details:', error.stack);
            this.uiController.showError('Unable to describe this location');
        }
    }
    
    /**
     * Update directional information
     */
    updateDirectionalInfo() {
        if (!this.lastDescription || !this.currentHeading) return;
        
        // Update "what's ahead" based on current heading
        const directionalInfo = this.descriptionGenerator.getDirectionalInfo(
            this.currentLocation,
            this.currentHeading,
            this.lastDescription
        );
        
        this.uiController.updateDirectionalInfo(directionalInfo);
    }
    
    /**
     * Find nearest intersection
     */
    async findNearestIntersection() {
        if (!this.currentLocation) return null;
        
        // Get features from map (no offset since pin has no offset)
        console.log('findNearestIntersection searching at:', this.currentLocation);
        const features = await this.descriptionGenerator.getFeaturesInArea({
            center: this.currentLocation,
            radius: 50
        });
        const sortedByDistance = features.slice(0, 5).map(f => `${f.name} (${f.distance}m)`);
        console.log('Closest features by distance:', sortedByDistance);
        
        // Find road intersections
        const roads = features.filter(f => f.type.includes('highway') && f.name);
        
        if (roads.length >= 2) {
            // Simple intersection detection - find roads with different names
            const roadNames = [...new Set(roads.map(r => r.name))];
            if (roadNames.length >= 2) {
                return {
                    street1: roadNames[0],
                    street2: roadNames[1],
                    distance: 'nearby'
                };
            }
        }
        
        return null;
    }
    
    /**
     * Announce location with text-to-speech
     */
    announceLocation(description) {
        if (!window.speechSynthesis) return;
        
        // Cancel any ongoing speech
        window.speechSynthesis.cancel();
        
        // Build announcement
        let announcement = '';
        
        // Title
        if (description.intersection) {
            announcement = `You are near ${description.intersection.street1} and ${description.intersection.street2}. `;
        } else if (description.title) {
            announcement = `${description.title}. `;
        }
        
        // Facing direction
        if (this.currentHeading !== null && this.currentHeading !== undefined) {
            const direction = CompassService.headingToFullDirection(this.currentHeading);
            announcement += `Facing ${direction}. `;
        }
        
        // Summary
        if (description.summary) {
            announcement += `${description.summary}. `;
        }
        
        // Add all sections with pauses between distance rings
        if (description.sections && description.sections.length > 0) {
            description.sections.forEach((section, index) => {
                if (section.content) {
                    // Add section heading for context (optional, but helps with understanding)
                    if (section.heading && section.heading.includes('meters')) {
                        announcement += section.heading + ': ';
                    }
                    
                    // If content is an array (for directional info), join it
                    if (Array.isArray(section.content)) {
                        announcement += section.content.join('. ') + '. ';
                    } else {
                        announcement += section.content + '. ';
                    }
                    
                    // Add a pause between distance rings (represented by period and space)
                    // The speech synthesizer will naturally pause at periods
                    if (index < description.sections.length - 1) {
                        announcement += ' . '; // Extra period creates a longer pause
                    }
                }
            });
        }
        
        // Create and speak utterance
        const utterance = new SpeechSynthesisUtterance(announcement);
        utterance.rate = 0.9;
        utterance.pitch = 1;
        
        window.speechSynthesis.speak(utterance);
    }
    
    /**
     * Refresh location manually
     */
    async refreshLocation() {
        if (this.locationService.isTracking) {
            await this.locationService.getCurrentLocation();
        } else {
            await this.startLocationTracking();
        }
    }
    
    /**
     * Speak current location
     */
    speakLocation() {
        if (this.lastDescription) {
            this.announceLocation(this.lastDescription);
        } else {
            this.uiController.showError('No location information available');
        }
    }
    
    /**
     * Share current location
     */
    async shareLocation() {
        if (!this.currentLocation) {
            this.uiController.showError('Location not available');
            return;
        }
        
        const url = new URL(window.location);
        url.searchParams.set('lat', this.currentLocation.lat.toFixed(6));
        url.searchParams.set('lng', this.currentLocation.lng.toFixed(6));
        
        const text = this.lastDescription ? 
            `${this.lastDescription.title}: ${this.lastDescription.summary}` :
            `Location: ${this.currentLocation.lat.toFixed(6)}, ${this.currentLocation.lng.toFixed(6)}`;
        
        if (navigator.share) {
            try {
                await navigator.share({
                    title: 'My Location',
                    text: text,
                    url: url.toString()
                });
            } catch (error) {
                if (error.name !== 'AbortError') {
                    this.uiController.showError('Unable to share location');
                }
            }
        } else {
            // Fallback - copy to clipboard
            try {
                await navigator.clipboard.writeText(url.toString());
                this.uiController.showSuccess('Location link copied to clipboard');
            } catch (error) {
                this.uiController.showError('Unable to copy location');
            }
        }
    }
    
    /**
     * Search for a destination
     */
    async searchDestination(query) {
        try {
            const results = await this.locationService.search(query);
            
            if (results.length > 0) {
                this.uiController.displaySearchResults(results);
            } else {
                this.uiController.showError('No results found');
            }
        } catch (error) {
            console.error('Search error:', error);
            this.uiController.showError('Search failed. Please try again.');
        }
    }
    
    /**
     * Set settings
     */
    updateSettings(settings) {
        if (settings.detailLevel !== undefined) {
            // Will be used in next description update
        }
        
        if (settings.autoUpdate !== undefined) {
            this.autoUpdate = settings.autoUpdate;
        }
        
        if (settings.voiceEnabled !== undefined) {
            this.voiceEnabled = settings.voiceEnabled;
        }
        
        if (settings.voiceDirections !== undefined) {
            // For future navigation features
        }
    }
    
    /**
     * Pause tracking when app is hidden
     */
    pauseTracking() {
        if (this.locationService.isTracking) {
            this.locationService.stopTracking();
        }
        if (this.compassService.isActive) {
            this.compassService.stop();
        }
    }
    
    /**
     * Resume tracking when app is visible
     */
    resumeTracking() {
        if (!document.hidden && this.autoUpdate) {
            this.startLocationTracking();
        }
    }
    
    /**
     * Toggle between test and real location
     */
    async toggleLocationMode() {
        this.useTestLocation = !this.useTestLocation;
        
        if (this.useTestLocation) {
            // Switch to test location
            this.locationService.stopTracking();
            this.uiController.updateGPSStatus('Test Mode');
            await this.handleLocationUpdate(this.config.testLocation);
            this.uiController.showSuccess('Switched to test location: Yonge & Front');
        } else {
            // Switch to real location
            this.uiController.showSuccess('Switching to real location...');
            this.startLocationTracking();
        }
    }
    
    /**
     * Enable simulated compass
     */
    enableSimulatedCompass() {
        this.useSimulatedCompass = true;
        this.uiController.updateCompassStatus('Simulated');
        // Set initial simulated heading
        this.setSimulatedHeading(this.simulatedHeading);
    }
    
    /**
     * Toggle simulated compass
     */
    toggleSimulatedCompass(enable) {
        this.useSimulatedCompass = enable;
        
        if (enable) {
            // Stop real compass if running
            if (this.compassService.isActive) {
                this.compassService.stop();
            }
            this.uiController.updateCompassStatus('Simulated');
            // Apply current simulated heading
            this.setSimulatedHeading(this.simulatedHeading);
        } else {
            // Try to restart real compass
            this.uiController.updateCompassStatus('Starting...');
            if (this.compassService.isSupported) {
                this.compassService.start().catch(error => {
                    console.warn('Failed to restart compass:', error);
                    this.uiController.updateCompassStatus('Not available');
                    this.uiController.showCompassUnavailable();
                });
            }
        }
    }
    
    /**
     * Set simulated heading
     */
    setSimulatedHeading(heading) {
        this.simulatedHeading = heading;
        if (this.useSimulatedCompass) {
            // Simulate a heading change event
            this.handleHeadingChange({ heading: heading });
        }
    }
    
    /**
     * Handle manual location change from map interaction
     */
    async handleManualLocationChange(location) {
        
        // Update current location
        this.currentLocation = location;
        
        // Update map center to the actual location
        this.mapManager.setCenter(location.lat, location.lng);
        
        // Load tiles for the new area
        await this.preloadAreaTiles(location);
        
        // Update location description
        await this.updateLocationDescription();
        
        // If using test location mode, update the test location
        if (this.useTestLocation) {
            this.config.testLocation = location;
        }
        
        // Show a notification
        this.uiController.showSuccess(`Location updated to: ${location.lat.toFixed(4)}, ${location.lng.toFixed(4)}`);
    }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    const app = new WhereAmIApp();
    app.init();
    
    // Make app available globally for debugging
    window.whereAmI = app;
});