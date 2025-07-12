/**
 * CleanUIController - Manages the new clean UI
 */

export class CleanUIController {
    constructor(app) {
        this.app = app;
        this.elements = {};
        this.menuOpen = false;
        this.descriptionVisible = true;
    }
    
    /**
     * Initialize UI
     */
    init() {
        this.cacheElements();
        this.setupEventListeners();
        this.updateToggleButton();
        
        // Set initial states
        this.updateGPSStatus('Off');
        this.updateCompassStatus('Off');
    }
    
    /**
     * Cache DOM elements
     */
    cacheElements() {
        // Top bar
        this.elements.menuToggle = document.getElementById('menu-toggle');
        this.elements.slideMenu = document.getElementById('slide-menu');
        this.elements.gpsStatus = document.getElementById('gps-status');
        this.elements.compassStatus = document.getElementById('compass-status');
        
        // Menu items
        this.elements.toggleLocation = document.getElementById('toggle-location');
        this.elements.showDescription = document.getElementById('show-description');
        this.elements.voiceEnabled = document.getElementById('voice-enabled');
        this.elements.autoUpdate = document.getElementById('auto-update');
        this.elements.detailLevel = document.querySelectorAll('input[name="detail-level"]');
        this.elements.locationSearch = document.getElementById('location-search');
        this.elements.searchButton = document.getElementById('search-button');
        
        // Simulated compass
        this.elements.simulatedCompassGroup = document.getElementById('simulated-compass-group');
        this.elements.useSimulatedCompass = document.getElementById('use-simulated-compass');
        this.elements.simulatedDirectionWrapper = document.getElementById('simulated-direction-wrapper');
        this.elements.simulatedDirection = document.getElementById('simulated-direction');
        
        // Action buttons
        this.elements.updateLocation = document.getElementById('update-location');
        this.elements.speakLocation = document.getElementById('speak-location');
        
        // Map controls
        this.elements.zoomIn = document.getElementById('zoom-in');
        this.elements.zoomOut = document.getElementById('zoom-out');
        this.elements.centerLocation = document.getElementById('center-location');
        
        // Description panel
        this.elements.descriptionPanel = document.getElementById('description-panel');
        this.elements.locationTitle = document.getElementById('location-title');
        this.elements.locationSummary = document.getElementById('location-summary');
        this.elements.locationDetails = document.getElementById('location-details');
        this.elements.directionIndicator = document.getElementById('direction-indicator');
        this.elements.closeDescription = document.getElementById('close-description');
        this.elements.shareLocation = document.getElementById('share-location');
    }
    
    /**
     * Setup event listeners
     */
    setupEventListeners() {
        // Menu toggle
        this.elements.menuToggle.addEventListener('click', () => this.toggleMenu());
        
        // Close menu when clicking outside
        document.addEventListener('click', (e) => {
            if (this.menuOpen && !this.elements.slideMenu.contains(e.target) && 
                !this.elements.menuToggle.contains(e.target)) {
                this.closeMenu();
            }
        });
        
        // Location mode toggle
        this.elements.toggleLocation.addEventListener('click', () => {
            this.app.toggleLocationMode();
            this.updateToggleButton();
        });
        
        // Settings
        this.elements.showDescription.addEventListener('change', () => {
            this.descriptionVisible = this.elements.showDescription.checked;
            this.updateDescriptionVisibility();
        });
        
        this.elements.voiceEnabled.addEventListener('change', () => {
            this.app.updateSettings({ voiceEnabled: this.elements.voiceEnabled.checked });
        });
        
        this.elements.autoUpdate.addEventListener('change', () => {
            this.app.updateSettings({ autoUpdate: this.elements.autoUpdate.checked });
        });
        
        // Simulated compass toggle
        this.elements.useSimulatedCompass.addEventListener('change', () => {
            const useSimulated = this.elements.useSimulatedCompass.checked;
            this.elements.simulatedDirectionWrapper.style.display = useSimulated ? 'block' : 'none';
            this.app.toggleSimulatedCompass(useSimulated);
        });
        
        // Simulated compass direction
        this.elements.simulatedDirection.addEventListener('change', () => {
            const heading = parseFloat(this.elements.simulatedDirection.value);
            this.app.setSimulatedHeading(heading);
        });
        
        // Search
        this.elements.searchButton.addEventListener('click', () => this.performSearch());
        this.elements.locationSearch.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.performSearch();
        });
        
        // Action buttons
        this.elements.updateLocation.addEventListener('click', () => {
            this.app.refreshLocation();
        });
        
        this.elements.speakLocation.addEventListener('click', () => {
            this.app.speakLocation();
        });
        
        // Map controls
        this.elements.zoomIn.addEventListener('click', () => {
            this.app.mapManager.zoomIn();
        });
        
        this.elements.zoomOut.addEventListener('click', () => {
            this.app.mapManager.zoomOut();
        });
        
        this.elements.centerLocation.addEventListener('click', () => {
            if (this.app.currentLocation) {
                this.app.mapManager.setCenter(
                    this.app.currentLocation.lat,
                    this.app.currentLocation.lng
                );
            }
        });
        
        // Description panel
        this.elements.closeDescription.addEventListener('click', () => {
            this.elements.showDescription.checked = false;
            this.descriptionVisible = false;
            this.updateDescriptionVisibility();
        });
        
        this.elements.shareLocation.addEventListener('click', () => {
            this.app.shareLocation();
        });
    }
    
    /**
     * Toggle menu
     */
    toggleMenu() {
        this.menuOpen = !this.menuOpen;
        this.elements.menuToggle.setAttribute('aria-expanded', this.menuOpen);
        this.elements.slideMenu.classList.toggle('open', this.menuOpen);
    }
    
    /**
     * Close menu
     */
    closeMenu() {
        this.menuOpen = false;
        this.elements.menuToggle.setAttribute('aria-expanded', 'false');
        this.elements.slideMenu.classList.remove('open');
    }
    
    /**
     * Update GPS status
     */
    updateGPSStatus(status) {
        let displayText = `GPS: ${status}`;
        
        if (status === 'Test Mode') {
            displayText = '📍 Test Mode';
        } else if (status === 'Active') {
            displayText = 'GPS: Active';
        }
        
        this.elements.gpsStatus.textContent = displayText;
    }
    
    /**
     * Update compass status
     */
    updateCompassStatus(status) {
        this.elements.compassStatus.textContent = `Compass: ${status}`;
    }
    
    /**
     * Update toggle button
     */
    updateToggleButton() {
        const buttonText = this.elements.toggleLocation.querySelector('.button-text');
        if (this.app.useTestLocation) {
            buttonText.textContent = 'Switch to Real GPS';
        } else {
            buttonText.textContent = 'Switch to Test Mode';
        }
    }
    
    /**
     * Update description visibility
     */
    updateDescriptionVisibility() {
        this.elements.descriptionPanel.classList.toggle('hidden', !this.descriptionVisible);
    }
    
    /**
     * Display location description
     */
    displayLocationDescription(description) {
        if (!this.descriptionVisible) return;
        
        // Update content
        this.elements.locationTitle.textContent = description.title || 'Current Location';
        this.elements.locationSummary.textContent = description.summary || '';
        
        // Update details
        this.elements.locationDetails.innerHTML = '';
        if (description.sections && description.sections.length > 0) {
            const detailsList = document.createElement('ul');
            detailsList.style.margin = '0';
            detailsList.style.paddingLeft = '20px';
            
            description.sections.forEach(section => {
                if (section.content) {
                    // Handle array content (for lists within sections)
                    if (Array.isArray(section.content)) {
                        section.content.forEach(contentItem => {
                            if (contentItem && contentItem.trim()) {
                                const item = document.createElement('li');
                                item.textContent = contentItem;
                                detailsList.appendChild(item);
                            }
                        });
                    } else if (section.content.trim()) {
                        const item = document.createElement('li');
                        item.textContent = section.content;
                        detailsList.appendChild(item);
                    }
                }
            });
            
            this.elements.locationDetails.appendChild(detailsList);
        }
    }
    
    /**
     * Update compass
     */
    updateCompass(heading) {
        const direction = this.headingToDirection(heading);
        this.elements.directionIndicator.textContent = `Facing: ${direction}`;
    }
    
    /**
     * Show compass unavailable
     */
    showCompassUnavailable() {
        this.elements.directionIndicator.textContent = 'Direction unavailable';
        // Automatically check the simulated compass option
        this.elements.useSimulatedCompass.checked = true;
        this.elements.simulatedDirectionWrapper.style.display = 'block';
    }
    
    /**
     * Perform search
     */
    performSearch() {
        const query = this.elements.locationSearch.value.trim();
        if (!query) return;
        
        this.elements.searchButton.disabled = true;
        this.elements.searchButton.textContent = 'Searching...';
        
        this.app.searchDestination(query).finally(() => {
            this.elements.searchButton.disabled = false;
            this.elements.searchButton.textContent = 'Search';
            this.closeMenu();
        });
    }
    
    /**
     * Show loading description
     */
    showLoadingDescription() {
        this.elements.locationTitle.textContent = 'Analyzing location...';
        this.elements.locationSummary.textContent = 'Please wait...';
        this.elements.locationDetails.innerHTML = '';
    }
    
    /**
     * Get description options
     */
    getDescriptionOptions() {
        return {
            detailLevel: document.querySelector('input[name="detail-level"]:checked')?.value || 'standard',
            includeLandmarks: true,
            includeTransit: true,
            includeAccessibility: true,
            includeAmenities: true,
            includeDirections: true
        };
    }
    
    /**
     * Convert heading to direction
     */
    headingToDirection(heading) {
        const directions = ['North', 'NE', 'East', 'SE', 'South', 'SW', 'West', 'NW'];
        const index = Math.round(heading / 45) % 8;
        return directions[index];
    }
    
    /**
     * Show error
     */
    showError(message) {
        // Create a temporary notification
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: calc(var(--top-bar-height) + var(--space-md));
            left: 50%;
            transform: translateX(-50%);
            background: var(--accent-warning);
            color: white;
            padding: var(--space-md);
            border-radius: 8px;
            box-shadow: var(--shadow-lg);
            z-index: 200;
        `;
        notification.textContent = message;
        document.body.appendChild(notification);
        
        setTimeout(() => notification.remove(), 5000);
    }
    
    /**
     * Show success
     */
    showSuccess(message) {
        // Create a temporary notification
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: calc(var(--top-bar-height) + var(--space-md));
            left: 50%;
            transform: translateX(-50%);
            background: var(--accent-success);
            color: white;
            padding: var(--space-md);
            border-radius: 8px;
            box-shadow: var(--shadow-lg);
            z-index: 200;
        `;
        notification.textContent = message;
        document.body.appendChild(notification);
        
        setTimeout(() => notification.remove(), 3000);
    }
}