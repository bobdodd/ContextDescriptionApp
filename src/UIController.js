/**
 * UIController - Manages UI interactions and state
 */

export class UIController {
    constructor(app) {
        this.app = app;
        
        // UI elements
        this.elements = {
            menuToggle: document.getElementById('menu-toggle'),
            sidebar: document.getElementById('sidebar'),
            getLocation: document.getElementById('get-location'),
            locationStatus: document.getElementById('location-status'),
            areaSearch: document.getElementById('area-search'),
            searchButton: document.getElementById('search-button'),
            descriptionContent: document.getElementById('description-content'),
            readAloud: document.getElementById('read-aloud'),
            copyDescription: document.getElementById('copy-description'),
            shareDescription: document.getElementById('share-description'),
            zoomIn: document.getElementById('zoom-in'),
            zoomOut: document.getElementById('zoom-out'),
            centerMap: document.getElementById('center-map')
        };
        
        // State
        this.sidebarOpen = window.innerWidth > 768;
        this.speechSynthesis = window.speechSynthesis;
        this.currentUtterance = null;
    }
    
    /**
     * Initialize UI
     */
    init() {
        this.setupEventListeners();
        this.updateSidebarState();
    }
    
    /**
     * Set up UI event listeners
     */
    setupEventListeners() {
        // Menu toggle
        this.elements.menuToggle.addEventListener('click', () => {
            this.toggleSidebar();
        });
        
        // Location button
        this.elements.getLocation.addEventListener('click', () => {
            this.requestLocation();
        });
        
        // Search
        this.elements.searchButton.addEventListener('click', () => {
            this.performSearch();
        });
        
        this.elements.areaSearch.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.performSearch();
            }
        });
        
        // Map controls
        this.elements.zoomIn.addEventListener('click', () => {
            this.app.mapManager.zoomIn();
        });
        
        this.elements.zoomOut.addEventListener('click', () => {
            this.app.mapManager.zoomOut();
        });
        
        this.elements.centerMap.addEventListener('click', () => {
            this.centerOnLocation();
        });
        
        // Description actions
        this.elements.readAloud.addEventListener('click', () => {
            this.toggleReadAloud();
        });
        
        this.elements.copyDescription.addEventListener('click', () => {
            this.copyDescription();
        });
        
        this.elements.shareDescription.addEventListener('click', () => {
            this.shareDescription();
        });
        
        // Handle escape key to close sidebar on mobile
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && window.innerWidth <= 768) {
                this.closeSidebar();
            }
        });
    }
    
    /**
     * Toggle sidebar visibility
     */
    toggleSidebar() {
        this.sidebarOpen = !this.sidebarOpen;
        this.updateSidebarState();
    }
    
    /**
     * Update sidebar state
     */
    updateSidebarState() {
        const sidebar = this.elements.sidebar;
        const menuToggle = this.elements.menuToggle;
        
        if (this.sidebarOpen) {
            sidebar.classList.add('open');
            menuToggle.setAttribute('aria-expanded', 'true');
        } else {
            sidebar.classList.remove('open');
            menuToggle.setAttribute('aria-expanded', 'false');
        }
    }
    
    /**
     * Close sidebar
     */
    closeSidebar() {
        this.sidebarOpen = false;
        this.updateSidebarState();
    }
    
    /**
     * Request user location
     */
    async requestLocation() {
        try {
            this.updateLocationStatus('Requesting location...', 'pending');
            
            const location = await this.app.locationService.getCurrentLocation();
            
            this.updateLocationStatus(
                `Location found: ${location.lat.toFixed(4)}, ${location.lng.toFixed(4)}`,
                'success'
            );
            
            // Update button state
            this.elements.getLocation.textContent = '📍 Update Location';
            
        } catch (error) {
            this.updateLocationStatus(
                'Failed to get location. Please check permissions.',
                'error'
            );
        }
    }
    
    /**
     * Update location status display
     */
    updateLocationStatus(message, type = 'info') {
        const status = this.elements.locationStatus;
        status.textContent = message;
        status.className = `location-status ${type}`;
        
        // Clear status after delay
        if (type === 'success') {
            setTimeout(() => {
                status.textContent = '';
                status.className = 'location-status';
            }, 5000);
        }
    }
    
    /**
     * Perform location search
     */
    performSearch(query = null) {
        const searchQuery = query || this.elements.areaSearch.value.trim();
        
        if (!searchQuery) {
            this.showError('Please enter a location to search');
            return;
        }
        
        // Disable search button during search
        this.elements.searchButton.disabled = true;
        this.elements.searchButton.textContent = 'Searching...';
        
        // Perform search through app
        this.app.searchLocation(searchQuery).finally(() => {
            this.elements.searchButton.disabled = false;
            this.elements.searchButton.textContent = 'Search';
        });
    }
    
    /**
     * Center map on current location
     */
    centerOnLocation() {
        const location = this.app.locationService.lastLocation;
        
        if (location) {
            this.app.mapManager.setCenter(location.lat, location.lng);
        } else {
            this.requestLocation();
        }
    }
    
    /**
     * Display area description
     */
    displayDescription(description) {
        const content = this.elements.descriptionContent;
        
        // Clear existing content
        content.innerHTML = '';
        
        // Add title
        if (description.title) {
            const title = document.createElement('h3');
            title.textContent = description.title;
            content.appendChild(title);
        }
        
        // Add summary
        if (description.summary) {
            const summary = document.createElement('p');
            summary.className = 'description-summary';
            summary.textContent = description.summary;
            content.appendChild(summary);
        }
        
        // Add sections
        if (description.sections) {
            description.sections.forEach(section => {
                const sectionEl = document.createElement('section');
                sectionEl.className = 'description-section';
                
                const heading = document.createElement('h4');
                heading.textContent = section.heading;
                sectionEl.appendChild(heading);
                
                const contentEl = document.createElement('p');
                contentEl.textContent = section.content;
                sectionEl.appendChild(contentEl);
                
                content.appendChild(sectionEl);
            });
        }
        
        // Scroll to description on mobile
        if (window.innerWidth <= 768) {
            content.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
    }
    
    /**
     * Get description options from UI
     */
    getDescriptionOptions() {
        return {
            detailLevel: document.querySelector('input[name="detail-level"]:checked').value,
            includeLandmarks: document.getElementById('include-landmarks').checked,
            includeTransit: document.getElementById('include-transit').checked,
            includeAccessibility: document.getElementById('include-accessibility').checked,
            includeAmenities: document.getElementById('include-amenities').checked,
            includeDirections: document.getElementById('include-directions').checked
        };
    }
    
    /**
     * Toggle read aloud functionality
     */
    toggleReadAloud() {
        if (this.currentUtterance && this.speechSynthesis.speaking) {
            this.stopReadAloud();
        } else {
            this.startReadAloud();
        }
    }
    
    /**
     * Start reading description aloud
     */
    startReadAloud() {
        if (!this.speechSynthesis) {
            this.showError('Text-to-speech is not supported in your browser');
            return;
        }
        
        const text = this.elements.descriptionContent.textContent;
        
        if (!text || text.trim() === '') {
            this.showError('No description to read');
            return;
        }
        
        // Create utterance
        this.currentUtterance = new SpeechSynthesisUtterance(text);
        this.currentUtterance.rate = 0.9;
        this.currentUtterance.pitch = 1;
        
        // Update button state
        this.elements.readAloud.textContent = '⏸️ Pause';
        
        // Handle end of speech
        this.currentUtterance.onend = () => {
            this.elements.readAloud.textContent = '🔊 Read Aloud';
            this.currentUtterance = null;
        };
        
        // Start speaking
        this.speechSynthesis.speak(this.currentUtterance);
    }
    
    /**
     * Stop reading aloud
     */
    stopReadAloud() {
        if (this.speechSynthesis) {
            this.speechSynthesis.cancel();
            this.elements.readAloud.textContent = '🔊 Read Aloud';
            this.currentUtterance = null;
        }
    }
    
    /**
     * Copy description to clipboard
     */
    async copyDescription() {
        const text = this.elements.descriptionContent.textContent;
        
        if (!text || text.trim() === '') {
            this.showError('No description to copy');
            return;
        }
        
        try {
            await navigator.clipboard.writeText(text);
            this.showSuccess('Description copied to clipboard');
        } catch (error) {
            // Fallback for older browsers
            const textarea = document.createElement('textarea');
            textarea.value = text;
            textarea.style.position = 'fixed';
            textarea.style.opacity = '0';
            document.body.appendChild(textarea);
            textarea.select();
            
            try {
                document.execCommand('copy');
                this.showSuccess('Description copied to clipboard');
            } catch (e) {
                this.showError('Failed to copy description');
            }
            
            document.body.removeChild(textarea);
        }
    }
    
    /**
     * Share description
     */
    async shareDescription() {
        const text = this.elements.descriptionContent.textContent;
        const title = this.elements.descriptionContent.querySelector('h3')?.textContent || 'Area Description';
        
        if (!text || text.trim() === '') {
            this.showError('No description to share');
            return;
        }
        
        // Create shareable URL with current location
        const center = this.app.mapManager.center;
        const zoom = this.app.mapManager.zoom;
        const url = new URL(window.location);
        url.searchParams.set('lat', center.lat.toFixed(4));
        url.searchParams.set('lng', center.lng.toFixed(4));
        url.searchParams.set('zoom', zoom);
        
        if (navigator.share) {
            try {
                await navigator.share({
                    title: title,
                    text: text,
                    url: url.toString()
                });
            } catch (error) {
                if (error.name !== 'AbortError') {
                    this.showError('Failed to share description');
                }
            }
        } else {
            // Fallback: copy URL to clipboard
            try {
                await navigator.clipboard.writeText(url.toString());
                this.showSuccess('Link copied to clipboard');
            } catch (error) {
                this.showError('Sharing is not supported in your browser');
            }
        }
    }
    
    /**
     * Show error message
     */
    showError(message) {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = 'notification error';
        notification.textContent = message;
        notification.setAttribute('role', 'alert');
        
        document.body.appendChild(notification);
        
        // Remove after delay
        setTimeout(() => {
            notification.remove();
        }, 5000);
    }
    
    /**
     * Show success message
     */
    showSuccess(message) {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = 'notification success';
        notification.textContent = message;
        notification.setAttribute('role', 'status');
        
        document.body.appendChild(notification);
        
        // Remove after delay
        setTimeout(() => {
            notification.remove();
        }, 3000);
    }
}