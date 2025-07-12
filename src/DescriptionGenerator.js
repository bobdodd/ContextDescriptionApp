/**
 * DescriptionGenerator - Generates contextual descriptions for map areas
 */

export class DescriptionGenerator {
    constructor(mapManager) {
        this.mapManager = mapManager;
        
        // Feature type descriptions
        this.featureDescriptions = {
            building: 'building',
            'building:commercial': 'commercial building',
            'building:residential': 'residential building',
            'building:retail': 'retail building',
            'building:office': 'office building',
            highway: 'road',
            'highway:primary': 'major road',
            'highway:secondary': 'secondary road',
            'highway:residential': 'residential street',
            'highway:footway': 'footpath',
            'highway:cycleway': 'cycle path',
            amenity: 'amenity',
            'amenity:restaurant': 'restaurant',
            'amenity:cafe': 'café',
            'amenity:bank': 'bank',
            'amenity:pharmacy': 'pharmacy',
            'amenity:hospital': 'hospital',
            'amenity:school': 'school',
            shop: 'shop',
            'shop:supermarket': 'supermarket',
            'shop:convenience': 'convenience store',
            'shop:clothes': 'clothing store',
            leisure: 'leisure facility',
            'leisure:park': 'park',
            'leisure:playground': 'playground',
            'leisure:sports_centre': 'sports center',
            'public_transport:station': 'transit station',
            'public_transport:stop': 'transit stop',
            'railway:station': 'railway station',
            'railway:tram_stop': 'tram stop',
            'highway:bus_stop': 'bus stop'
        };
        
        // Direction names
        this.directions = {
            north: 'north',
            northeast: 'northeast',
            east: 'east',
            southeast: 'southeast',
            south: 'south',
            southwest: 'southwest',
            west: 'west',
            northwest: 'northwest'
        };
    }
    
    /**
     * Generate description for an area
     */
    async generateDescription(area, options) {
        // Get features in the area with distance filtering
        const maxDistance = options.maxDistance || 400;
        const features = await this.getFeaturesInArea(area, maxDistance);
        
        // Get distance zones for categorization
        const zones = options.distanceZones || {
            immediate: 50,
            near: 100,
            vicinity: 200,
            area: 400
        };
        
        // Build description based on options
        const description = {
            title: this.generateTitle(area, features),
            summary: this.generateSummary(area, features, options),
            sections: []
        };
        
        // If no features found, provide a basic description
        if (features.length === 0) {
            description.title = 'Current Location';
            description.summary = 'Loading map data...';
            description.sections = [];
        } else {
            // Add sections based on options
            if (options.includeLandmarks) {
                const landmarks = this.describeLandmarks(features, options.detailLevel, zones);
                if (landmarks && landmarks.content && landmarks.content.trim()) {
                    description.sections.push(landmarks);
                }
            }
            
            if (options.includeTransit) {
                const transit = this.describeTransit(features, options.detailLevel, zones);
                if (transit && transit.content && transit.content.trim()) {
                    description.sections.push(transit);
                }
            }
            
            if (options.includeAccessibility) {
                const accessibility = this.describeAccessibility(features, options.detailLevel, zones);
                if (accessibility && accessibility.content && accessibility.content.trim()) {
                    description.sections.push(accessibility);
                }
            }
            
            if (options.includeAmenities) {
                const amenities = this.describeAmenities(features, options.detailLevel, zones);
                if (amenities && amenities.content && amenities.content.trim()) {
                    description.sections.push(amenities);
                }
            }
            
            if (options.includeDirections) {
                const directions = this.describeDirections(area, features, options.detailLevel, zones);
                if (directions && directions.content) {
                    // Handle array content for directions
                    if (Array.isArray(directions.content) && directions.content.length > 0) {
                        description.sections.push(directions);
                    } else if (typeof directions.content === 'string' && directions.content.trim()) {
                        description.sections.push(directions);
                    }
                }
            }
        }
        
        return description;
    }
    
    /**
     * Get features in area from loaded tiles
     */
    async getFeaturesInArea(area, maxDistance = 400) {
        const features = [];
        
        try {
            // Get bounds of area
            const bounds = this.getAreaBounds(area, maxDistance);
            
            // Get tiles in bounds
            const tiles = this.mapManager.loadedTiles;
            
            console.log('Loaded tiles count:', tiles.size);
            
            // Extract features from tiles
            for (const [key, tileGroup] of tiles) {
                const tileFeatures = this.extractFeaturesFromTile(tileGroup, bounds, key);
                features.push(...tileFeatures);
            }
            
            // Calculate distances and filter by max distance
            const featuresWithDistance = features.map(feature => {
                const distance = this.calculateFeatureDistance(feature, area.center);
                return { ...feature, distance };
            }).filter(f => f.distance <= maxDistance);
            
            // Debug: Log some sample features
            if (featuresWithDistance.length > 0) {
                console.log('Sample features with distances:');
                featuresWithDistance.slice(0, 5).forEach(f => {
                    console.log(`- ${f.name || f.type} in tile ${f.tileLat}_${f.tileLng}, distance: ${f.distance}m`);
                });
            }
            
            // Sort by distance
            featuresWithDistance.sort((a, b) => a.distance - b.distance);
            
            console.log(`Found ${featuresWithDistance.length} features within ${maxDistance}m`);
            
            // Debug: log park-like features
            const parkLike = featuresWithDistance.filter(f => 
                f.type.includes('leisure') || f.type.includes('park') || 
                (f.name && (f.name.toLowerCase().includes('park') || f.name.toLowerCase().includes('garden')))
            );
            if (parkLike.length > 0) {
                console.log('Park-like features found:');
                parkLike.slice(0, 10).forEach(f => {
                    console.log(`- Type: ${f.type}, Name: ${f.name || 'unnamed'}, Distance: ${f.distance}m`);
                });
            }
            
            return featuresWithDistance;
        } catch (error) {
            console.error('Error getting features:', error);
        }
        
        return features;
    }
    
    /**
     * Extract features from a tile SVG
     */
    extractFeaturesFromTile(tileGroup, bounds, tileKey) {
        const features = [];
        
        // Parse tile coordinates from key (e.g., "43.648_-79.378")
        let tileLat = 0, tileLng = 0;
        if (tileKey) {
            const parts = tileKey.split('_');
            tileLat = parseFloat(parts[0]);
            tileLng = parseFloat(parts[1]);
            console.log(`Processing tile: ${tileKey} at ${tileLat}, ${tileLng}`);
        }
        
        // The tiles have a typo: 'class-' instead of 'class'
        // Let's look for both variations and also elements without proper class attributes
        const selectors = [
            '[class-*="highway"]',
            '[class-*="building"]',
            '[class-*="amenity"]',
            '[class-*="shop"]',
            '[class-*="leisure"]',
            '[class-*="public_transport"]',
            '[class-*="railway"]',
            'polygon',
            'path',
            'rect',
            'circle',
            'text'
        ];
        
        const elements = tileGroup.querySelectorAll(selectors.join(', '));
        
        console.log(`Found ${elements.length} elements in tile`);
        
        elements.forEach(element => {
            // Get feature type from class or class- (there's a typo in the tiles)
            const classes = element.getAttribute('class') || element.getAttribute('class-') || '';
            let type = null;
            let name = null;
            
            // Extract type from class (e.g., 'highway-residential' -> 'highway:residential')
            if (classes) {
                // Handle multiple classes like "building building-office"
                const classArray = classes.split(' ').filter(c => c);
                if (classArray.length > 0) {
                    // Use the most specific class (usually the one with a hyphen)
                    const specificClass = classArray.find(c => c.includes('-')) || classArray[0];
                    const classMatch = specificClass.match(/(\w+)-(\w+)/);
                    if (classMatch) {
                        type = `${classMatch[1]}:${classMatch[2]}`;
                    } else {
                        type = specificClass;
                    }
                }
            }
            
            // If no class found, use tag name as fallback
            if (!type && element.tagName) {
                const tag = element.tagName.toLowerCase();
                if (tag === 'polygon' || tag === 'path' || tag === 'rect') {
                    // Try to infer type from parent group
                    const parentGroup = element.closest('g[id]');
                    if (parentGroup) {
                        type = parentGroup.id; // e.g., 'buildings' -> 'building'
                        if (type.endsWith('s')) {
                            type = type.slice(0, -1); // Remove plural 's'
                        }
                    }
                }
            }
            
            // Try to get name from various sources
            name = element.getAttribute('data-name') || 
                   element.getAttribute('aria-label') ||
                   element.getAttribute('title');
            
            // For text elements, use the text content as name
            if (element.tagName.toLowerCase() === 'text' && !name) {
                name = element.textContent;
            }
            
            // Remove OSM ID debug info from name
            if (name) {
                name = name.replace(/\[OSM ID:\s*\d+\]/g, '').trim();
            }
            
            if (type) {
                const feature = {
                    type: type,
                    name: name,
                    element: element,
                    classes: classes,
                    tileLat: tileLat,
                    tileLng: tileLng
                };
                
                // Get position (simplified - would need proper coordinate transformation)
                try {
                    const bbox = element.getBBox();
                    if (bbox && bbox.width > 0 && bbox.height > 0) {
                        feature.position = {
                            x: bbox.x + bbox.width / 2,
                            y: bbox.y + bbox.height / 2
                        };
                    }
                } catch (e) {
                    // getBBox might fail for some elements
                }
                
                features.push(feature);
            }
        });
        
        return features;
    }
    
    /**
     * Get feature type from class name
     */
    getFeatureTypeFromClass(element) {
        const classes = element.className.baseVal || element.className;
        const match = classes.match(/feature-(\w+)/);
        return match ? match[1] : null;
    }
    
    /**
     * Get area bounds
     */
    getAreaBounds(area, maxDistance = null) {
        const radius = maxDistance || area.radius;
        // More accurate conversion: 1 degree latitude ≈ 111km, 1 degree longitude varies by latitude
        const radiusInDegreesLat = radius / 111000;
        const radiusInDegreesLng = radius / (111000 * Math.cos(area.center.lat * Math.PI / 180));
        
        return {
            north: area.center.lat + radiusInDegreesLat,
            south: area.center.lat - radiusInDegreesLat,
            east: area.center.lng + radiusInDegreesLng,
            west: area.center.lng - radiusInDegreesLng
        };
    }
    
    /**
     * Calculate distance from center to feature
     */
    calculateFeatureDistance(feature, center) {
        if (!feature.position) return 999999; // Far away if no position
        
        // Calculate feature's actual lat/lng based on its tile and position within tile
        const tileSize = 0.01; // degrees per tile (tiles are 0.01° x 0.01°)
        const svgSize = 800; // SVG units per tile
        
        // SVG coordinates: (0,0) is top-left, y increases downward
        // Geographic coordinates: latitude increases northward
        // So we need to invert the y-coordinate
        const featureLat = feature.tileLat + (1 - feature.position.y / svgSize) * tileSize;
        const featureLng = feature.tileLng + (feature.position.x / svgSize) * tileSize;
        
        // Haversine formula for distance
        const R = 6371000; // Earth's radius in meters
        const φ1 = center.lat * Math.PI / 180;
        const φ2 = featureLat * Math.PI / 180;
        const Δφ = (featureLat - center.lat) * Math.PI / 180;
        const Δλ = (featureLng - center.lng) * Math.PI / 180;
        
        const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
                  Math.cos(φ1) * Math.cos(φ2) *
                  Math.sin(Δλ/2) * Math.sin(Δλ/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        
        return Math.round(R * c);
    }
    
    /**
     * Generate title for area
     */
    generateTitle(area, features) {
        // Try to find a named area or landmark
        const namedFeatures = features.filter(f => f.name && !f.name.includes(','));
        
        if (namedFeatures.length > 0) {
            // Prioritize major features for title
            const priorities = [
                f => f.type.includes('station') && f.name,
                f => f.type.includes('building') && f.name.toLowerCase().includes('tower'),
                f => f.type.includes('building') && f.type.includes('commercial'),
                f => f.type.includes('building') && f.type.includes('office'),
                f => f.type.includes('amenity') && f.name,
                f => f.type.includes('shop') && f.name,
                f => f.type.includes('building') && f.name,
                f => f.type.includes('park') && f.name && f.name.length > 5
            ];
            
            for (const priority of priorities) {
                const prominent = namedFeatures.find(priority);
                if (prominent) {
                    return `Near ${prominent.name}`;
                }
            }
            
            // Skip generic names
            const nonGeneric = namedFeatures.find(f => 
                f.name.length > 3 && 
                !['tree', 'grass', 'garden', 'building'].includes(f.name.toLowerCase())
            );
            
            if (nonGeneric) {
                return `Near ${nonGeneric.name}`;
            }
        }
        
        // Default to intersection name for downtown
        if (Math.abs(area.center.lat - 43.6486) < 0.001 && Math.abs(area.center.lng - (-79.3782)) < 0.001) {
            return "Yonge & Front Streets";
        }
        
        return `Location: ${area.center.lat.toFixed(4)}, ${area.center.lng.toFixed(4)}`;
    }
    
    /**
     * Generate summary
     */
    generateSummary(area, features, options) {
        const featureTypes = this.categorizeFeatures(features);
        
        // Describe general area type
        let areaType = '';
        if (featureTypes.buildings.length > 10) {
            areaType = featureTypes.commercial.length > featureTypes.residential.length ? 'Commercial' : 'Residential';
        }
        
        // Count key features
        const counts = [];
        if (featureTypes.transit.length > 0) counts.push(`${featureTypes.transit.length} transit stop${featureTypes.transit.length > 1 ? 's' : ''}`);
        if (featureTypes.parks.length > 0) {
            // Debug what's being counted as parks
            console.log(`Parks found (${featureTypes.parks.length}):`, featureTypes.parks.slice(0, 10).map(p => ({
                name: p.name,
                type: p.type,
                distance: p.distance
            })));
            counts.push(`${featureTypes.parks.length} park${featureTypes.parks.length > 1 ? 's' : ''}`);
        }
        if (featureTypes.amenities.length > 0) counts.push(`${featureTypes.amenities.length} amenities`);
        
        // Check for trees (not counted as parks)
        const trees = features.filter(f => 
            f.name && f.name.toLowerCase().includes('tree') && 
            (f.type.includes('natural') || f.type.includes('leisure'))
        );
        
        if (trees.length > 5) {
            counts.push('mature trees');
        }
        
        if (areaType && counts.length > 0) {
            return `${areaType} area with ${counts.join(', ')}`;
        } else if (areaType) {
            return `${areaType} area`;
        } else if (counts.length > 0) {
            return counts.join(', ');
        }
        
        return 'Mixed use area';
    }
    
    /**
     * Categorize features by type
     */
    categorizeFeatures(features) {
        return {
            buildings: features.filter(f => f.type.includes('building')),
            residential: features.filter(f => f.type.includes('residential')),
            commercial: features.filter(f => f.type.includes('commercial') || f.type.includes('retail')),
            roads: features.filter(f => f.type.includes('highway')),
            transit: features.filter(f => 
                f.type.includes('station') || 
                f.type.includes('stop') || 
                f.type.includes('public_transport')
            ),
            parks: features.filter(f => {
                // Exclude all parking features
                if (f.type.includes('parking')) return false;
                
                // Skip if no name at all
                if (!f.name || f.name.trim().length < 3) return false;
                
                const lowerName = f.name.toLowerCase();
                
                // Exclude anything with these words in the name
                const excludeWords = ['tree', 'grass', 'lawn', 'planter', 'bed', 'strip', 'patch', 'green space', 'parking'];
                for (const word of excludeWords) {
                    if (lowerName.includes(word)) return false;
                }
                
                // Only count if it's explicitly a park or leisure area (but not parking!)
                const isPark = (f.type === 'park' || f.type.startsWith('park:') || 
                               f.type === 'leisure' || f.type.startsWith('leisure:')) &&
                               !f.type.includes('parking');
                
                const hasValidName = ['park', 'square', 'gardens', 'playground', 'common', 'field'].some(word => 
                    lowerName.includes(word) && !lowerName.includes('parking')
                );
                
                return isPark && hasValidName;
            }),
            amenities: features.filter(f => f.type.includes('amenity') || f.type.includes('shop')),
            accessibility: features.filter(f => 
                f.type.includes('wheelchair') || 
                f.type.includes('tactile') || 
                f.type.includes('audio')
            )
        };
    }
    
    /**
     * Describe landmarks
     */
    describeLandmarks(features, detailLevel, zones) {
        const landmarks = features.filter(f => f.name && (
            f.type.includes('building') ||
            f.type.includes('park') ||
            f.type.includes('station') ||
            f.type.includes('amenity')
        ));
        
        if (landmarks.length === 0) return null;
        
        // Group landmarks by distance zone
        const byZone = {};
        landmarks.forEach(landmark => {
            const zone = this.getDistanceZone(landmark.distance, zones);
            if (!byZone[zone]) byZone[zone] = [];
            byZone[zone].push(landmark);
        });
        
        let content = '';
        const descriptions = [];
        
        // Describe immediate landmarks in detail
        if (byZone.immediate && byZone.immediate.length > 0) {
            if (detailLevel === 'detailed') {
                byZone.immediate.forEach(l => {
                    const dist = this.getDistanceDescription(l.distance, 'immediate');
                    descriptions.push(`${l.name} ${dist}`);
                });
            } else {
                const names = byZone.immediate.slice(0, 3).map(l => l.name);
                descriptions.push(`Right here: ${names.join(', ')}`);
            }
        }
        
        // Describe nearby landmarks
        if (byZone.near && byZone.near.length > 0) {
            if (detailLevel !== 'brief') {
                const count = byZone.near.length;
                const sample = byZone.near[0];
                descriptions.push(`${count} landmark${count > 1 ? 's' : ''} nearby (${sample.name} ${this.getDistanceDescription(sample.distance, 'near')})`);
            }
        }
        
        // Only mention vicinity/area landmarks in detailed mode
        if (detailLevel === 'detailed') {
            const farCount = (byZone.vicinity?.length || 0) + (byZone.area?.length || 0);
            if (farCount > 0) {
                descriptions.push(`${farCount} more landmarks within ${zones.area}m`);
            }
        }
        
        content = descriptions.join('. ');
        if (!content) return null;
        
        return {
            heading: 'Landmarks & Points of Interest',
            content: content
        };
    }
    
    /**
     * Describe transit options
     */
    describeTransit(features, detailLevel, zones) {
        const transit = features.filter(f => 
            f.type.includes('station') || 
            f.type.includes('stop') || 
            f.type.includes('public_transport') ||
            f.type.includes('bus_stop')
        );
        
        if (transit.length === 0) return null;
        
        // Only describe transit within walking distance
        const walkable = transit.filter(t => t.distance <= zones.vicinity);
        if (walkable.length === 0) return null;
        
        const descriptions = [];
        
        // Group by distance zone
        const immediate = walkable.filter(t => t.distance <= zones.immediate);
        const near = walkable.filter(t => t.distance > zones.immediate && t.distance <= zones.near);
        
        if (immediate.length > 0) {
            const stop = immediate[0];
            const dist = this.getDistanceDescription(stop.distance, 'immediate');
            if (stop.name) {
                descriptions.push(`${stop.name} ${dist}`);
            } else {
                const type = stop.type.includes('bus') ? 'Bus stop' : 'Transit stop';
                descriptions.push(`${type} ${dist}`);
            }
        }
        
        if (near.length > 0) {
            const count = near.length;
            descriptions.push(`${count} more stop${count > 1 ? 's' : ''} within ${zones.near}m`);
        }
        
        const content = descriptions.join('. ');
        if (!content) return null;
        
        return {
            heading: 'Transit & Transportation',
            content: content
        };
    }
    
    /**
     * Describe accessibility features
     */
    describeAccessibility(features, detailLevel) {
        // Look for accessibility-related features
        const accessible = features.filter(f => 
            f.element.getAttribute('data-wheelchair') === 'yes' ||
            f.element.getAttribute('data-tactile-paving') === 'yes' ||
            f.element.getAttribute('data-audio-signals') === 'yes' ||
            f.type.includes('accessible') ||
            f.type.includes('wheelchair') ||
            f.type.includes('tactile')
        );
        
        const accessibleBuildings = features.filter(f => 
            f.type.includes('building') && 
            f.element.getAttribute('data-wheelchair') === 'yes'
        );
        
        if (accessible.length === 0 && accessibleBuildings.length === 0) {
            return {
                heading: 'Accessibility Features',
                content: 'Limited accessibility information available for this area.'
            };
        }
        
        const descriptions = [];
        
        if (accessibleBuildings.length > 0) {
            descriptions.push(`${accessibleBuildings.length} wheelchair accessible building${accessibleBuildings.length > 1 ? 's' : ''}`);
        }
        
        // Count specific features
        const tactile = accessible.filter(f => 
            f.element.getAttribute('data-tactile-paving') === 'yes'
        );
        const audio = accessible.filter(f => 
            f.element.getAttribute('data-audio-signals') === 'yes'
        );
        
        if (tactile.length > 0) {
            descriptions.push(`${tactile.length} location${tactile.length > 1 ? 's' : ''} with tactile paving`);
        }
        
        if (audio.length > 0) {
            descriptions.push(`${audio.length} crossing${audio.length > 1 ? 's' : ''} with audio signals`);
        }
        
        const content = descriptions.join('. ');
        if (content) {
            return {
                heading: 'Accessibility Features',
                content: content + '.'
            };
        } else {
            return {
                heading: 'Accessibility Features',
                content: 'Limited accessibility information available for this area.'
            };
        }
    }
    
    /**
     * Describe amenities
     */
    describeAmenities(features, detailLevel) {
        const amenities = features.filter(f => 
            f.type.includes('amenity') || 
            f.type.includes('shop') ||
            f.type.includes('restaurant') ||
            f.type.includes('cafe')
        );
        
        if (amenities.length === 0) return null;
        
        let content = '';
        
        if (detailLevel === 'brief') {
            content = `${amenities.length} amenities and services nearby`;
        } else {
            const categories = {
                food: amenities.filter(f => 
                    f.type.includes('restaurant') || 
                    f.type.includes('cafe') || 
                    f.type.includes('fast_food')
                ),
                shopping: amenities.filter(f => f.type.includes('shop')),
                services: amenities.filter(f => 
                    f.type.includes('bank') || 
                    f.type.includes('pharmacy') || 
                    f.type.includes('post_office')
                ),
                healthcare: amenities.filter(f => 
                    f.type.includes('hospital') || 
                    f.type.includes('clinic') || 
                    f.type.includes('doctors')
                )
            };
            
            const descriptions = [];
            
            if (categories.food.length > 0) {
                descriptions.push(`${categories.food.length} food establishment${categories.food.length > 1 ? 's' : ''}`);
            }
            if (categories.shopping.length > 0) {
                descriptions.push(`${categories.shopping.length} shop${categories.shopping.length > 1 ? 's' : ''}`);
            }
            if (categories.services.length > 0) {
                descriptions.push(`${categories.services.length} service${categories.services.length > 1 ? 's' : ''}`);
            }
            if (categories.healthcare.length > 0) {
                descriptions.push(`${categories.healthcare.length} healthcare facilit${categories.healthcare.length > 1 ? 'ies' : 'y'}`);
            }
            
            content = descriptions.length > 0 ? descriptions.join(', ') + '.' : '';
        }
        
        if (!content) return null;
        
        return {
            heading: 'Amenities & Services',
            content: content
        };
    }
    
    /**
     * Describe directions and spatial relationships
     */
    describeDirections(area, features, detailLevel, zones) {
        // Get user's heading - default to north (0) if not available
        const userHeading = area.heading || 0;
        
        // Filter to nearby features with names and calculated positions
        const nearbyFeatures = features.filter(f => 
            f.name && 
            f.distance <= zones.vicinity &&
            !f.name.toLowerCase().includes('tree') &&
            !f.name.toLowerCase().includes('grass')
        );
        
        if (nearbyFeatures.length === 0) return null;
        
        // Calculate relative directions for each feature
        const featuresWithDirections = nearbyFeatures.map(f => {
            // Calculate absolute bearing from user to feature
            const bearing = this.calculateBearing(area.center, f);
            
            // Calculate relative bearing (clock position)
            const relativeBearing = (bearing - userHeading + 360) % 360;
            const clockPosition = this.bearingToClockPosition(relativeBearing);
            const compassDir = this.bearingToCompassDirection(bearing);
            
            return {
                ...f,
                bearing,
                relativeBearing,
                clockPosition,
                compassDir
            };
        });
        
        // Group by clock sectors
        const byClock = {};
        featuresWithDirections.forEach(f => {
            const sector = this.getClockSector(f.clockPosition);
            if (!byClock[sector]) byClock[sector] = [];
            byClock[sector].push(f);
        });
        
        // Build description
        const descriptions = [];
        
        // Order sectors by clock position
        const sectorOrder = ['12', '1-2', '3', '4-5', '6', '7-8', '9', '10-11'];
        
        for (const sector of sectorOrder) {
            if (byClock[sector] && byClock[sector].length > 0) {
                const items = byClock[sector];
                const sectorName = this.getClockSectorName(sector);
                
                if (detailLevel === 'brief') {
                    descriptions.push(`${sectorName}: ${items.length} feature${items.length > 1 ? 's' : ''}`);
                } else {
                    // Take closest 2-3 items per sector
                    const closest = items.sort((a, b) => a.distance - b.distance).slice(0, 3);
                    const names = closest.map(f => {
                        const dist = this.getDistanceDescription(f.distance, this.getDistanceZone(f.distance, zones));
                        return `${f.name} (${dist})`;
                    });
                    descriptions.push(`${sectorName}: ${names.join(', ')}`);
                }
            }
        }
        
        if (descriptions.length === 0) return null;
        
        // Return descriptions as an array for bullet points
        return {
            heading: `Around You (facing ${this.headingToFullDirection(userHeading)})`,
            content: descriptions,
            isList: true
        };
    }
    
    /**
     * Convert angle to compass direction
     */
    angleToDirection(angle) {
        const normalized = ((angle + 360) % 360);
        
        if (normalized < 22.5 || normalized >= 337.5) return 'east';
        if (normalized < 67.5) return 'northeast';
        if (normalized < 112.5) return 'north';
        if (normalized < 157.5) return 'northwest';
        if (normalized < 202.5) return 'west';
        if (normalized < 247.5) return 'southwest';
        if (normalized < 292.5) return 'south';
        return 'southeast';
    }
    
    /**
     * Group features by type
     */
    groupByType(features) {
        const grouped = {};
        
        features.forEach(f => {
            if (!grouped[f.type]) {
                grouped[f.type] = [];
            }
            grouped[f.type].push(f);
        });
        
        return grouped;
    }
    
    /**
     * Get directional information based on heading
     */
    getDirectionalInfo(location, heading, description) {
        // location parameter reserved for future use when calculating relative positions
        if (!description.sections || description.sections.length === 0) {
            return null;
        }
        
        // Find directional section
        const directionalSection = description.sections.find(s => 
            s.heading.toLowerCase().includes('direction')
        );
        
        if (directionalSection) {
            // Extract features in the direction of heading
            const direction = this.headingToFullDirection(heading);
            const directionPattern = new RegExp(`${direction.toLowerCase()}|ahead`, 'i');
            
            const lines = directionalSection.content.split('. ');
            const relevantLines = lines.filter(line => 
                directionPattern.test(line)
            );
            
            if (relevantLines.length > 0) {
                return relevantLines.join('. ');
            }
        }
        
        // Fallback: general ahead info
        return `Facing ${this.headingToFullDirection(heading)}`;
    }
    
    /**
     * Convert heading to full direction name
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
     * Get distance zone for a feature
     */
    getDistanceZone(distance, zones) {
        if (distance <= zones.immediate) return 'immediate';
        if (distance <= zones.near) return 'near';
        if (distance <= zones.vicinity) return 'vicinity';
        if (distance <= zones.area) return 'area';
        return 'far';
    }
    
    /**
     * Get distance description
     */
    getDistanceDescription(distance, zone) {
        if (zone === 'immediate') {
            if (distance < 10) return 'right here';
            if (distance < 25) return 'just ahead';
            return 'very close by';
        }
        if (zone === 'near') {
            return `about ${Math.round(distance/10)*10} meters away`;
        }
        if (zone === 'vicinity') {
            return `about ${Math.round(distance/50)*50} meters away`;
        }
        if (zone === 'area') {
            return `about ${Math.round(distance/100)*100} meters away`;
        }
        return 'in the distance';
    }
    
    /**
     * Calculate bearing from one point to another
     */
    calculateBearing(from, to) {
        // Use the already calculated lat/lng if available
        let toLat, toLng;
        if (to.tileLat !== undefined && to.tileLng !== undefined) {
            // Calculate actual position
            const tileSize = 0.01;
            const svgSize = 800;
            toLat = to.tileLat + (1 - to.position.y / svgSize) * tileSize;
            toLng = to.tileLng + (to.position.x / svgSize) * tileSize;
        } else {
            toLat = to.lat;
            toLng = to.lng;
        }
        
        const dLng = (toLng - from.lng) * Math.PI / 180;
        const lat1 = from.lat * Math.PI / 180;
        const lat2 = toLat * Math.PI / 180;
        
        const y = Math.sin(dLng) * Math.cos(lat2);
        const x = Math.cos(lat1) * Math.sin(lat2) -
                  Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
        
        const bearing = Math.atan2(y, x) * 180 / Math.PI;
        return (bearing + 360) % 360;
    }
    
    /**
     * Convert bearing to clock position
     */
    bearingToClockPosition(relativeBearing) {
        // Convert 0-360 degrees to 1-12 clock position
        let clock = Math.round(relativeBearing / 30);
        if (clock === 0) clock = 12;
        return clock;
    }
    
    /**
     * Convert bearing to compass direction
     */
    bearingToCompassDirection(bearing) {
        const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
        const index = Math.round(bearing / 45) % 8;
        return directions[index];
    }
    
    /**
     * Get clock sector for grouping
     */
    getClockSector(clockPosition) {
        if (clockPosition === 12) return '12';
        if (clockPosition === 1 || clockPosition === 2) return '1-2';
        if (clockPosition === 3) return '3';
        if (clockPosition === 4 || clockPosition === 5) return '4-5';
        if (clockPosition === 6) return '6';
        if (clockPosition === 7 || clockPosition === 8) return '7-8';
        if (clockPosition === 9) return '9';
        if (clockPosition === 10 || clockPosition === 11) return '10-11';
        return '12';
    }
    
    /**
     * Get friendly name for clock sector
     */
    getClockSectorName(sector) {
        const names = {
            '12': 'Straight ahead (12 o\'clock)',
            '1-2': 'Ahead to your right (1-2 o\'clock)',
            '3': 'To your right (3 o\'clock)',
            '4-5': 'Behind to your right (4-5 o\'clock)',
            '6': 'Behind you (6 o\'clock)',
            '7-8': 'Behind to your left (7-8 o\'clock)',
            '9': 'To your left (9 o\'clock)',
            '10-11': 'Ahead to your left (10-11 o\'clock)'
        };
        return names[sector] || sector;
    }
}