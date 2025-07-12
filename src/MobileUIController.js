/**
 * MobileUIController - Manages mobile UI interactions
 */

export class MobileUIController {
    constructor(app) {
        this.app = app;
        
        // UI elements cache
        this.elements = {};
        
        // State
        this.activeTab = 'around';
    }
    
    /**
     * Initialize UI
     */
    init() {
        this.cacheElements();
        this.setupEventListeners();
        this.setupTabs();
        this.updateToggleButton();
        
        // Initialize compass display
        this.elements.directionText.textContent = 'Direction unavailable';
    }
    
    /**
     * Cache DOM elements
     */
    cacheElements() {
        // Status indicators
        this.elements.gpsStatus = document.getElementById('gps-status');
        this.elements.compassStatus = document.getElementById('compass-status');
        
        // Compass
        this.elements.compassNeedle = document.getElementById('compass-needle');
        this.elements.directionText = document.getElementById('direction-text');
        
        // Location info
        this.elements.locationTitle = document.getElementById('location-title');
        this.elements.locationSummary = document.getElementById('location-summary');
        
        // Badges
        this.elements.intersectionBadge = document.querySelector('#nearest-intersection .badge-text');
        this.elements.accessibilityBadge = document.querySelector('#accessibility-summary .badge-text');
        
        // Tab controls
        this.elements.tabs = document.querySelectorAll('.tab-button');
        this.elements.panels = document.querySelectorAll('.tab-panel');
        
        // Content areas
        this.elements.aroundContent = document.getElementById('around-content');
        this.elements.navigationResults = document.getElementById('navigation-results');
        
        // Action buttons
        this.elements.refreshButton = document.getElementById('refresh-location');
        this.elements.toggleButton = document.getElementById('toggle-location');
        this.elements.speakButton = document.getElementById('speak-location');
        this.elements.shareButton = document.getElementById('share-location');
        
        // Search
        this.elements.searchInput = document.getElementById('destination-search');
        this.elements.searchButton = document.getElementById('search-button');
        
        // Settings
        this.elements.detailLevel = document.querySelectorAll('input[name="detail-level"]');
        this.elements.updateFreq = document.querySelectorAll('input[name="update-freq"]');
        this.elements.voiceEnabled = document.getElementById('voice-enabled');
        this.elements.voiceDirections = document.getElementById('voice-directions');
        
        // Map controls
        this.elements.mapZoomIn = document.getElementById('map-zoom-in');
        this.elements.mapZoomOut = document.getElementById('map-zoom-out');
        this.elements.mapCenter = document.getElementById('map-center');
        
        // Card toggle
        this.elements.cardToggle = document.querySelector('.card-toggle');
    }
    
    /**
     * Set up event listeners
     */
    setupEventListeners() {
        // Action buttons
        this.elements.refreshButton.addEventListener('click', () => {
            this.app.refreshLocation();
        });
        
        this.elements.toggleButton.addEventListener('click', () => {
            this.app.toggleLocationMode();
            this.updateToggleButton();
        });
        
        this.elements.speakButton.addEventListener('click', () => {
            this.app.speakLocation();
        });
        
        this.elements.shareButton.addEventListener('click', () => {
            this.app.shareLocation();
        });
        
        // Search
        this.elements.searchButton.addEventListener('click', () => {
            this.performSearch();
        });
        
        this.elements.searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.performSearch();
            }
        });
        
        // Settings
        this.elements.updateFreq.forEach(radio => {
            radio.addEventListener('change', () => {
                this.app.updateSettings({
                    autoUpdate: document.querySelector('input[name="update-freq"]:checked').value === 'auto'
                });
            });
        });
        
        this.elements.voiceEnabled.addEventListener('change', () => {
            this.app.updateSettings({
                voiceEnabled: this.elements.voiceEnabled.checked
            });
        });
        
        this.elements.voiceDirections.addEventListener('change', () => {
            this.app.updateSettings({
                voiceDirections: this.elements.voiceDirections.checked
            });
        });
        
        // Map controls
        if (this.elements.mapZoomIn) {
            this.elements.mapZoomIn.addEventListener('click', () => {
                this.app.mapManager.zoomIn();
            });
        }
        
        if (this.elements.mapZoomOut) {
            this.elements.mapZoomOut.addEventListener('click', () => {
                this.app.mapManager.zoomOut();
            });
        }
        
        if (this.elements.mapCenter) {
            this.elements.mapCenter.addEventListener('click', () => {
                if (this.app.currentLocation) {
                    this.app.mapManager.setCenter(
                        this.app.currentLocation.lat,
                        this.app.currentLocation.lng
                    );
                }
            });
        }
        
        // Card toggle
        if (this.elements.cardToggle) {
            this.elements.cardToggle.addEventListener('click', () => {
                const isExpanded = this.elements.cardToggle.getAttribute('aria-expanded') === 'true';
                this.elements.cardToggle.setAttribute('aria-expanded', !isExpanded);
            });
        }
    }
    
    /**
     * Set up tab navigation
     */
    setupTabs() {
        this.elements.tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                const targetId = tab.getAttribute('aria-controls');
                this.switchTab(targetId.replace('-panel', ''));
            });
        });
    }
    
    /**
     * Switch active tab
     */
    switchTab(tabName) {
        this.activeTab = tabName;
        
        // Update tab buttons
        this.elements.tabs.forEach(tab => {
            const isActive = tab.id === `${tabName}-tab`;
            tab.classList.toggle('active', isActive);
            tab.setAttribute('aria-selected', isActive);
        });
        
        // Update panels
        this.elements.panels.forEach(panel => {
            const isActive = panel.id === `${tabName}-panel`;
            panel.hidden = !isActive;
        });
    }
    
    /**
     * Update GPS status
     */
    updateGPSStatus(status) {
        this.elements.gpsStatus.textContent = `GPS: ${status}`;
        
        // Update color based on status
        if (status === 'Active') {
            this.elements.gpsStatus.style.color = 'var(--secondary-color)';
        } else if (status === 'Test Mode') {
            this.elements.gpsStatus.style.color = 'var(--primary-color)';
            this.elements.gpsStatus.textContent = '📍 Test: Yonge & Front';
        } else if (status === 'Error') {
            this.elements.gpsStatus.style.color = 'var(--warning-color)';
        } else {
            this.elements.gpsStatus.style.color = '';
        }
    }
    
    /**
     * Update compass status
     */
    updateCompassStatus(status) {
        this.elements.compassStatus.textContent = `Compass: ${status}`;
    }
    
    /**
     * Update compass heading
     */
    updateCompass(heading) {
        // Rotate needle
        this.elements.compassNeedle.style.transform = 
            `translate(-50%, -100%) rotate(${heading}deg)`;
        
        // Update text
        const direction = this.headingToFullDirection(heading);
        this.elements.directionText.textContent = direction;
    }
    
    /**
     * Show compass unavailable state
     */
    showCompassUnavailable() {
        // Hide the compass needle
        this.elements.compassNeedle.style.display = 'none';
        
        // Update text
        this.elements.directionText.textContent = 'Direction unavailable';
        this.elements.directionText.style.fontSize = 'var(--font-size-lg)';
        
        // Update the compass rose to show it's inactive
        const compassRose = document.getElementById('compass-rose');
        compassRose.style.opacity = '0.5';
    }
    
    /**
     * Show loading state for description
     */
    showLoadingDescription() {
        this.elements.locationTitle.textContent = 'Analyzing location...';
        this.elements.locationSummary.textContent = 'Please wait while we identify your surroundings.';
        this.elements.aroundContent.innerHTML = '<p class="placeholder">Loading details...</p>';
    }
    
    /**
     * Display location description
     */
    displayLocationDescription(description) {
        // Update main location info
        this.elements.locationTitle.textContent = description.title || 'Current Location';
        this.elements.locationSummary.textContent = description.summary || 'No description available.';
        
        // Update intersection badge
        if (description.intersection) {
            this.elements.intersectionBadge.textContent = 
                `${description.intersection.street1} & ${description.intersection.street2}`;
        } else {
            this.elements.intersectionBadge.textContent = 'No intersection nearby';
        }
        
        // Update accessibility badge
        const accessibilityCount = this.countAccessibilityFeatures(description);
        if (accessibilityCount > 0) {
            this.elements.accessibilityBadge.textContent = 
                `${accessibilityCount} accessibility feature${accessibilityCount > 1 ? 's' : ''}`;
        } else {
            this.elements.accessibilityBadge.textContent = 'Limited info available';
        }
        
        // Update detailed content
        this.updateAroundContent(description);
    }
    
    /**
     * Update "Around Me" content
     */
    updateAroundContent(description) {
        const content = this.elements.aroundContent;
        content.innerHTML = '';
        
        if (description.sections && description.sections.length > 0) {
            description.sections.forEach(section => {
                const sectionEl = document.createElement('section');
                sectionEl.className = 'content-section';
                
                const heading = document.createElement('h4');
                heading.textContent = section.heading;
                sectionEl.appendChild(heading);
                
                const text = document.createElement('p');
                text.textContent = section.content;
                sectionEl.appendChild(text);
                
                content.appendChild(sectionEl);
            });
        } else {
            content.innerHTML = '<p class="placeholder">No detailed information available for this location.</p>';
        }
    }
    
    /**
     * Update directional information
     */
    updateDirectionalInfo(info) {
        // This could update a "what's ahead" section
        // For now, we'll add it to the description if on the around tab
        if (this.activeTab === 'around' && info) {
            const directionalSection = document.createElement('section');
            directionalSection.className = 'content-section directional-info';
            
            const heading = document.createElement('h4');
            heading.textContent = 'In Your Direction';
            directionalSection.appendChild(heading);
            
            const text = document.createElement('p');
            text.textContent = info;
            directionalSection.appendChild(text);
            
            // Prepend to around content
            this.elements.aroundContent.insertBefore(
                directionalSection,
                this.elements.aroundContent.firstChild
            );
        }
    }
    
    /**
     * Count accessibility features in description
     */
    countAccessibilityFeatures(description) {
        let count = 0;
        
        if (description.sections) {
            const accessSection = description.sections.find(s => 
                s.heading.toLowerCase().includes('accessibility')
            );
            
            if (accessSection && accessSection.content) {
                // Count mentions of accessibility features
                const features = ['wheelchair', 'tactile', 'audio', 'accessible'];
                features.forEach(feature => {
                    if (accessSection.content.toLowerCase().includes(feature)) {
                        count++;
                    }
                });
            }
        }
        
        return count;
    }
    
    /**
     * Get description options from UI
     */
    getDescriptionOptions() {
        return {
            detailLevel: document.querySelector('input[name="detail-level"]:checked').value,
            includeLandmarks: true,
            includeTransit: true,
            includeAccessibility: true,
            includeAmenities: true,
            includeDirections: true
        };
    }
    
    /**
     * Perform search
     */
    performSearch() {
        const query = this.elements.searchInput.value.trim();
        
        if (!query) {
            this.showError('Please enter a location to search');
            return;
        }
        
        this.elements.searchButton.disabled = true;
        this.elements.searchButton.textContent = '🔄';
        
        this.app.searchDestination(query).finally(() => {
            this.elements.searchButton.disabled = false;
            this.elements.searchButton.textContent = '🔍';
        });
    }
    
    /**
     * Display search results
     */
    displaySearchResults(results) {
        const container = this.elements.navigationResults;
        container.innerHTML = '';
        
        results.forEach(result => {
            const resultEl = document.createElement('div');
            resultEl.className = 'search-result';
            
            const name = document.createElement('h4');
            name.textContent = result.name;
            resultEl.appendChild(name);
            
            if (this.app.currentLocation) {
                const distance = this.app.locationService.getDistance(
                    this.app.currentLocation,
                    result
                );
                
                const distanceEl = document.createElement('p');
                distanceEl.className = 'result-distance';
                distanceEl.textContent = this.app.locationService.formatDistance(distance);
                resultEl.appendChild(distanceEl);
            }
            
            const button = document.createElement('button');
            button.className = 'result-button';
            button.textContent = 'Get Directions';
            button.addEventListener('click', () => {
                this.getDirectionsTo(result);
            });
            resultEl.appendChild(button);
            
            container.appendChild(resultEl);
        });
        
        // Switch to navigate tab
        this.switchTab('navigate');
    }
    
    /**
     * Get directions to location
     */
    getDirectionsTo(destination) {
        // This would implement turn-by-turn navigation
        // For now, show a message
        this.showError(`Navigation to ${destination.name} coming soon!`);
    }
    
    /**
     * Convert heading to full direction
     */
    headingToFullDirection(heading) {
        const directions = [
            'North', 'Northeast', 'East', 'Southeast',
            'South', 'Southwest', 'West', 'Northwest'
        ];
        const index = Math.round(heading / 45) % 8;
        return directions[index];
    }
    
    /**
     * Update toggle button text
     */
    updateToggleButton() {
        const buttonText = this.elements.toggleButton.querySelector('.button-text');
        if (this.app.useTestLocation) {
            buttonText.textContent = 'Real GPS';
        } else {
            buttonText.textContent = 'Test Mode';
        }
    }
    
    /**
     * Show error notification
     */
    showError(message) {
        this.showNotification(message, 'error');
    }
    
    /**
     * Show success notification
     */
    showSuccess(message) {
        this.showNotification(message, 'success');
    }
    
    /**
     * Show notification
     */
    showNotification(message, type = 'info') {
        // Remove any existing notifications
        const existing = document.querySelectorAll('.notification');
        existing.forEach(n => n.remove());
        
        // Create new notification
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;
        notification.setAttribute('role', type === 'error' ? 'alert' : 'status');
        
        document.body.appendChild(notification);
        
        // Remove after delay
        setTimeout(() => {
            notification.remove();
        }, 5000);
        
        // Also announce to screen readers
        const announcement = document.createElement('div');
        announcement.className = 'sr-only';
        announcement.setAttribute('role', type === 'error' ? 'alert' : 'status');
        announcement.setAttribute('aria-live', 'polite');
        announcement.textContent = message;
        document.body.appendChild(announcement);
        
        setTimeout(() => {
            announcement.remove();
        }, 1000);
    }
}