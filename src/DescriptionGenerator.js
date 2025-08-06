/**
 * DescriptionGenerator - Generates contextual descriptions for map areas
 */

import { GeometryParser } from './GeometryParser.js';
import { GeometryCalculator } from './GeometryCalculator.js';

export class DescriptionGenerator {
    constructor(mapManager) {
        this.mapManager = mapManager;
        this.geometryParser = new GeometryParser();
        this.geometryCalculator = new GeometryCalculator();
        
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
        
        // Build description
        const description = {
            title: this.generateTitle(area, features),
            summary: '', // Will be generated as part of flowing description
            sections: []
        };
        
        // If no features found, provide a basic description
        console.log(`DescriptionGenerator: Found ${features.length} features in area`);
        if (features.length === 0) {
            description.title = 'Current Location';
            description.summary = 'Loading map data...';
            description.sections = [];
            return description;
        }
        
        // Build rich, sectioned description
        const sections = [];
        
        // Add landmark/location description section
        const landmarkSection = this.describeLandmarks(features, options.detailLevel || 'medium', zones);
        if (landmarkSection && landmarkSection.content) {
            sections.push(landmarkSection);
        }
        
        // Add transit information section  
        const transitSection = this.describeTransit(features, options.detailLevel || 'medium', zones);
        if (transitSection && transitSection.content) {
            sections.push(transitSection);
        }
        
        // Add accessibility section
        const accessibilitySection = this.describeAccessibility(features, options.detailLevel || 'medium');
        if (accessibilitySection && accessibilitySection.content) {
            sections.push(accessibilitySection);
        }
        
        // Add amenities section
        const amenitiesSection = this.describeAmenities(features, options.detailLevel || 'medium');  
        if (amenitiesSection && amenitiesSection.content) {
            sections.push(amenitiesSection);
        }
        
        // Generate main summary from flowing description for location context
        const flowingDesc = this.generateFlowingDescription(area, features, zones);
        
        // Build final description object
        description.sections = sections;
        description.summary = flowingDesc.summary || `Location: ${area.center.lat.toFixed(4)}, ${area.center.lng.toFixed(4)}`;
        
        return description;
    }
    
    /**
     * Generate flowing, natural language description
     */
    generateFlowingDescription(area, features, zones) {
        // Store user heading for relative directions
        this.userHeading = area.heading;
        
        // Clear any existing debug crosshairs
        this.clearDebugCrosshairs();
        
        // First run the debug to see what we find
        this.debugNearbyElements(area.center);
        
        // Now use the EXACT same code as debugNearbyElements to find roads
        const SEARCH_RADIUS = 50; // meters
        const tiles = this.mapManager.loadedTiles;
        const foundElements = [];
        
        // Calculate our position in each tile
        for (const [tileKey, tileGroup] of tiles) {
            const [tileLat, tileLng] = tileKey.split('_').map(parseFloat);
            
            // Convert center to tile-relative SVG coordinates
            // Tile covers tileLat to (tileLat+0.01) and tileLng to (tileLng+0.01)
            const svgX = ((area.center.lng - tileLng) / 0.01) * 1000;
            const svgY = ((tileLat + 0.01 - area.center.lat) / 0.01) * 1000;
            
            // Check if we're within this tile
            if (svgX >= 0 && svgX <= 1000 && svgY >= 0 && svgY <= 1000) {
                // Get all elements - same as debug
                const allElements = tileGroup.querySelectorAll('path, polyline, polygon, g');
                
                allElements.forEach(element => {
                    try {
                        // Get element info - same as debug
                        const tagName = element.tagName;
                        const classes = element.getAttribute('class') || element.getAttribute('class-') || '';
                        
                        // Only include actual road/path elements - same as debug
                        const isRoad = classes.match(/\b(road|highway|street|footway|cycleway|path|pedestrian)\b/);
                        const isArtifact = classes.includes('casing') || classes.includes('outline') || classes.includes('border');
                        if (!isRoad || isArtifact) {
                            return;
                        }
                        
                        const id = element.getAttribute('id') || '';
                        // Extract name from title element if it exists - same as debug
                        const titleElement = element.querySelector('title');
                        let name = '';
                        if (titleElement && titleElement.textContent) {
                            // Title often contains duplicated name, take the first part before comma
                            const titleParts = titleElement.textContent.split(',');
                            name = titleParts[0].trim();
                        }
                        if (!name) {
                            name = element.getAttribute('data-name') || 
                                   element.getAttribute('name') || '';
                        }
                        
                        // Parse geometry - same as debug
                        const geometry = this.geometryParser.parseElement(element);
                        if (geometry && geometry.points.length > 0) {
                            // Calculate distance - same as debug
                            const centerPoint = { x: svgX, y: svgY };
                            let distance;
                            
                            if (geometry.type === 'polygon') {
                                distance = this.geometryCalculator.pointToPolygonDistance(centerPoint, geometry.points);
                            } else if (geometry.type === 'polyline') {
                                distance = this.geometryCalculator.pointToPolylineDistance(centerPoint, geometry.points);
                            } else {
                                distance = this.geometryCalculator.pointToPointDistance(centerPoint, geometry.points[0]);
                            }
                            
                            // Convert SVG units to meters (approximately) - same as debug
                            const distanceInMeters = distance * 1.11;
                            
                            if (distanceInMeters <= SEARCH_RADIUS) {
                                foundElements.push({
                                    tag: tagName,
                                    classes: classes,
                                    id: id,
                                    name: name,
                                    distance: distanceInMeters.toFixed(1),
                                    geometryType: geometry.type,
                                    pointCount: geometry.points.length,
                                    element: element,  // Store reference to the element
                                    geometry: geometry // Store parsed geometry
                                });
                            }
                        }
                    } catch (e) {
                        // Skip elements that cause errors
                    }
                });
            }
        }
        
        // Sort by distance - same as debug
        foundElements.sort((a, b) => parseFloat(a.distance) - parseFloat(b.distance));
        
        // Filter for elements within 10m - same as debug
        const nearestElements = foundElements.filter(el => parseFloat(el.distance) <= 10);
        
        // Separate into two groups: roads/streets and footpaths
        const vehicleRoads = [];
        const pedestrianPaths = [];
        
        nearestElements.forEach(el => {
            const classes = el.classes.toLowerCase();
            
            // Check if it's a footpath/pedestrian way
            if (classes.includes('footway') || classes.includes('footpath') || 
                classes.includes('pedestrian') || classes.includes('steps') || 
                classes.includes('cycleway')) {
                pedestrianPaths.push(el);
            }
            // Check if it's a vehicle road
            else if (classes.includes('primary') || classes.includes('secondary') || 
                     classes.includes('tertiary') || classes.includes('residential') ||
                     classes.includes('road')) {
                vehicleRoads.push(el);
            }
        });
        
        // For now, only use vehicle roads for descriptions
        const roads = vehicleRoads;
        
        // Group roads by base name (without directional suffixes) - same as debug
        const roadGroups = new Map();
        const directionalPattern = /\s+(North|South|East|West)$/i;
        
        roads.forEach(el => {
            const name = el.name || 'unnamed';
            const baseName = name.replace(directionalPattern, '').trim();
            
            if (!roadGroups.has(baseName)) {
                roadGroups.set(baseName, []);
            }
            roadGroups.get(baseName).push({
                ...el,
                fullName: name,
                baseName: baseName,
                hasDirectional: directionalPattern.test(name)
            });
        });
        
        // Generate description based on what we found
        let summary = '';
        const uniqueRoadNames = Array.from(roadGroups.keys());
        
        if (uniqueRoadNames.length >= 2) {
            // At intersection - same logic as debug
            const roadInfo = [];
            roadGroups.forEach((group, baseName) => {
                // Get the geometry of the first segment to determine orientation
                const firstSegment = group[0];
                let isNorthSouth = false;
                
                if (firstSegment.geometryType === 'polyline' && firstSegment.pointCount >= 2) {
                    // Need to re-parse the geometry to get the actual points
                    const element = firstSegment.element;
                    if (element) {
                        const geometry = this.geometryParser.parseElement(element);
                        if (geometry && geometry.points && geometry.points.length >= 2) {
                            // Look at the first and last points of the polyline
                            const points = geometry.points;
                            const startPoint = points[0];
                            const endPoint = points[points.length - 1];
                            
                            // Calculate the change in x and y
                            const dx = Math.abs(endPoint.x - startPoint.x);
                            const dy = Math.abs(endPoint.y - startPoint.y);
                            
                            // If dy > dx, the road runs more north-south
                            isNorthSouth = dy > dx;
                        }
                    }
                }
                
                // Remove common suffixes like Street, Road, Avenue
                const cleanName = baseName.replace(/\s+(Street|Road|Avenue|Ave|St|Rd|Drive|Dr|Boulevard|Blvd)$/i, '');
                
                roadInfo.push({
                    name: cleanName,
                    isNorthSouth: isNorthSouth,
                    group: group
                });
            });
            
            // Sort to put N-S streets first
            roadInfo.sort((a, b) => {
                if (a.isNorthSouth && !b.isNorthSouth) return -1;
                if (!a.isNorthSouth && b.isNorthSouth) return 1;
                return 0;
            });
            
            // Determine which corner of the intersection we're on
            let cornerDescription = '';
            if (roadInfo.length === 2) {
                // For a standard 2-way intersection, determine the corner
                cornerDescription = this.getIntersectionCorner(
                    area.center,
                    roadInfo,
                    tiles
                );
            }
            
            // Create flowing text
            if (roadInfo.length === 2) {
                if (cornerDescription) {
                    summary = `You are on the ${cornerDescription} corner of ${roadInfo[0].name} and ${roadInfo[1].name}`;
                } else {
                    summary = `You are at the intersection of ${roadInfo[0].name} and ${roadInfo[1].name}`;
                }
            } else {
                const names = roadInfo.map(r => r.name);
                const lastRoad = names.pop();
                summary = `You are at the intersection of ${names.join(', ')} and ${lastRoad}`;
            }
        } else if (uniqueRoadNames.length === 1) {
            // On a single street - determine which side and street direction
            const baseName = uniqueRoadNames[0];
            const cleanName = baseName.replace(/\s+(Street|Road|Avenue|Ave|St|Rd|Drive|Dr|Boulevard|Blvd)$/i, '');
            
            // Get the first road element from this group
            const roadGroup = roadGroups.get(baseName);
            if (roadGroup && roadGroup.length > 0) {
                const roadElement = roadGroup[0];
                
                // Get the geometry for side calculation
                if (roadElement.geometry && roadElement.geometry.type === 'polyline') {
                    // We need to find which tile this road is in to get correct SVG coords
                    let userPoint = null;
                    
                    // Find the tile that contains this road element
                    for (const [tileKey, tileGroup] of tiles) {
                        if (tileGroup.contains(roadElement.element)) {
                            const [tileLat, tileLng] = tileKey.split('_').map(parseFloat);
                            // Recalculate SVG coordinates for this tile
                            const tileX = ((area.center.lng - tileLng) / 0.01) * 1000;
                            const tileY = ((tileLat + 0.01 - area.center.lat) / 0.01) * 1000;
                            userPoint = { x: tileX, y: tileY };
                            break;
                        }
                    }
                    
                    if (userPoint) {
                        const polyline = roadElement.geometry.points;
                        
                        // Find which side of the street we're on
                        const closestInfo = this.geometryCalculator.closestPointOnPolyline(userPoint, polyline);
                        
                        // Get the street's compass direction
                        const streetDirection = this.geometryCalculator.getPolylineDirection(polyline);
                        
                        if (closestInfo && streetDirection) {
                            // Get the angle at the closest point to determine absolute side
                            const segmentBearing = this.geometryCalculator.bearing(
                                polyline[closestInfo.segmentIndex],
                                polyline[closestInfo.segmentIndex + 1]
                            );
                            
                            // Determine the side description based on the street's primary orientation
                            const sideDescription = this.getStreetSideDescription(
                                closestInfo.side, 
                                segmentBearing,
                                streetDirection
                            );
                            
                            // Store current user point for clock position calculations
                            this.currentUserPoint = userPoint;
                            
                            // Find nearest cross streets
                            const crossStreets = this.findNearestCrossStreets(
                                userPoint,
                                roadElement,
                                closestInfo.segmentIndex,
                                tiles
                            );
                            
                            // Build a flowing description
                            summary = `You are on the ${sideDescription} side of ${cleanName}`;
                            
                            // Add street orientation relative to user if we have heading
                            if (area.heading !== null && area.heading !== undefined) {
                                const streetOrientation = this.getStreetOrientationDescription(
                                    segmentBearing,
                                    area.heading,
                                    sideDescription
                                );
                                summary += `, ${streetOrientation}`;
                            }
                            
                            summary += '.';
                            
                            // Add cross street information as a separate sentence
                            const crossStreetInfo = this.formatCrossStreetInfo(
                                crossStreets,
                                segmentBearing,
                                streetDirection
                            );
                            
                            if (crossStreetInfo) {
                                summary += ` ${crossStreetInfo}.`;
                            }
                            
                            // Add facing direction as final sentence
                            if (area.heading !== null && area.heading !== undefined) {
                                const direction = this.headingToCardinalDirection(area.heading);
                                summary += ` You are facing ${direction}.`;
                            }
                        } else {
                            summary = `You are on ${cleanName}`;
                        }
                    } else {
                        summary = `You are on ${cleanName}`;
                    }
                } else {
                    summary = `You are on ${cleanName}`;
                }
            } else {
                summary = `You are on ${cleanName}`;
            }
        } else {
            // No streets found
            summary = `Location: ${area.center.lat.toFixed(4)}, ${area.center.lng.toFixed(4)}`;
            
            // Add heading if available
            if (area.heading !== null && area.heading !== undefined) {
                const direction = this.headingToCardinalDirection(area.heading);
                summary += `. You are facing ${direction}.`;
            }
        }
        
        // Return minimal structure
        return {
            title: 'Current Location',
            summary: summary,
            sections: []
        };
    }
    
    /**
     * Debug method to find SVG elements near a position
     */
    debugNearbyElements(center) {
        const SEARCH_RADIUS = 50; // meters
        const tiles = this.mapManager.loadedTiles;
        const foundElements = [];
        
        // Calculate our position in each tile
        for (const [tileKey, tileGroup] of tiles) {
            const [tileLat, tileLng] = tileKey.split('_').map(parseFloat);
            
            // Convert center to SVG coordinates within this tile
            const svgX = ((center.lng - tileLng) / 0.01) * 1000;
            const svgY = ((tileLat + 0.01 - center.lat) / 0.01) * 1000;
            
            // Check if we're within this tile
            if (svgX >= 0 && svgX <= 1000 && svgY >= 0 && svgY <= 1000) {
                console.log(`User position in tile ${tileKey}: SVG(${svgX.toFixed(1)}, ${svgY.toFixed(1)})`);
                
                // First, let's see what elements are present and their classes
                const testElements = tileGroup.querySelectorAll('path, polyline, polygon, g');
                console.log(`Total elements in tile: ${testElements.length}`);
                
                // Log a sample of elements with classes
                let roadCount = 0;
                testElements.forEach((el, idx) => {
                    const className = el.getAttribute('class') || '';
                    if (className && idx < 10) {
                        console.log(`  Element ${idx}: <${el.tagName}> class="${className}"`);
                    }
                    if (className.includes('road') || className.includes('highway')) {
                        roadCount++;
                    }
                });
                console.log(`Elements with road/highway in class: ${roadCount}`);
                
                // Try different selector approaches
                const allElements = tileGroup.querySelectorAll('path, polyline, polygon, g');
                
                allElements.forEach(element => {
                    try {
                        // Get element info
                        const tagName = element.tagName;
                        const classes = element.getAttribute('class') || element.getAttribute('class-') || '';
                        
                        // Only include actual road/path elements
                        const isRoad = classes.match(/\b(road|highway|street|footway|cycleway|path|pedestrian)\b/);
                        const isArtifact = classes.includes('casing') || classes.includes('outline') || classes.includes('border');
                        if (!isRoad || isArtifact) {
                            return;
                        }
                        
                        const id = element.getAttribute('id') || '';
                        // Extract name from title element if it exists
                        const titleElement = element.querySelector('title');
                        let name = '';
                        if (titleElement && titleElement.textContent) {
                            // Title often contains duplicated name, take the first part before comma
                            const titleParts = titleElement.textContent.split(',');
                            name = titleParts[0].trim();
                        }
                        if (!name) {
                            name = element.getAttribute('data-name') || 
                                   element.getAttribute('name') || '';
                        }
                        
                        // Parse geometry
                        const geometry = this.geometryParser.parseElement(element);
                        if (geometry && geometry.points.length > 0) {
                            // Calculate distance
                            const centerPoint = { x: svgX, y: svgY };
                            let distance;
                            
                            if (geometry.type === 'polygon') {
                                distance = this.geometryCalculator.pointToPolygonDistance(centerPoint, geometry.points);
                            } else if (geometry.type === 'polyline') {
                                distance = this.geometryCalculator.pointToPolylineDistance(centerPoint, geometry.points);
                            } else {
                                distance = this.geometryCalculator.pointToPointDistance(centerPoint, geometry.points[0]);
                            }
                            
                            // Convert SVG units to meters (approximately)
                            const distanceInMeters = distance * 1.11;
                            
                            if (distanceInMeters <= SEARCH_RADIUS) {
                                foundElements.push({
                                    tag: tagName,
                                    classes: classes,
                                    id: id,
                                    name: name,
                                    distance: distanceInMeters.toFixed(1),
                                    geometryType: geometry.type,
                                    pointCount: geometry.points.length,
                                    element: element,  // Store reference to the element
                                    geometry: geometry // Store parsed geometry
                                });
                            }
                        }
                    } catch (e) {
                        // Skip elements that cause errors
                    }
                });
            }
        }
        
        // Sort by distance
        foundElements.sort((a, b) => parseFloat(a.distance) - parseFloat(b.distance));
        
        // Filter for elements within 10m
        const nearestElements = foundElements.filter(el => parseFloat(el.distance) <= 10);
        
        console.log(`\nRoads within 10m:`);
        const roads = nearestElements.filter(el => {
            const classes = el.classes.toLowerCase();
            return classes.includes('primary') || classes.includes('secondary') || 
                   classes.includes('tertiary') || classes.includes('residential') ||
                   classes.includes('road');
        });
        
        if (roads.length > 0) {
            // Group roads by base name (without directional suffixes)
            const roadGroups = new Map();
            const directionalPattern = /\s+(North|South|East|West)$/i;
            
            roads.forEach(el => {
                const name = el.name || 'unnamed';
                const baseName = name.replace(directionalPattern, '').trim();
                
                if (!roadGroups.has(baseName)) {
                    roadGroups.set(baseName, []);
                }
                roadGroups.get(baseName).push({
                    ...el,
                    fullName: name,
                    baseName: baseName,
                    hasDirectional: directionalPattern.test(name)
                });
            });
            
            // Check if we're at an intersection (multiple different roads within 5m)
            const uniqueRoadNames = Array.from(roadGroups.keys());
            if (uniqueRoadNames.length >= 2) {
                // Determine road orientations to put N-S streets first
                const roadInfo = [];
                roadGroups.forEach((group, baseName) => {
                    // Get the geometry of the first segment to determine orientation
                    const firstSegment = group[0];
                    let isNorthSouth = false;
                    
                    if (firstSegment.geometryType === 'polyline' && firstSegment.pointCount >= 2) {
                        // Need to re-parse the geometry to get the actual points
                        const element = firstSegment.element;
                        if (element) {
                            const geometry = this.geometryParser.parseElement(element);
                            if (geometry && geometry.points && geometry.points.length >= 2) {
                                // Look at the first and last points of the polyline
                                const points = geometry.points;
                                const startPoint = points[0];
                                const endPoint = points[points.length - 1];
                                
                                // Calculate the change in x and y
                                const dx = Math.abs(endPoint.x - startPoint.x);
                                const dy = Math.abs(endPoint.y - startPoint.y);
                                
                                // If dy > dx, the road runs more north-south
                                isNorthSouth = dy > dx;
                            }
                        }
                    }
                    
                    // Remove common suffixes like Street, Road, Avenue
                    const cleanName = baseName.replace(/\s+(Street|Road|Avenue|Ave|St|Rd|Drive|Dr|Boulevard|Blvd)$/i, '');
                    
                    roadInfo.push({
                        name: cleanName,
                        isNorthSouth: isNorthSouth,
                        group: group
                    });
                });
                
                // Sort to put N-S streets first
                roadInfo.sort((a, b) => {
                    if (a.isNorthSouth && !b.isNorthSouth) return -1;
                    if (!a.isNorthSouth && b.isNorthSouth) return 1;
                    return 0;
                });
                
                // Create flowing text
                if (roadInfo.length === 2) {
                    console.log(`At the intersection of ${roadInfo[0].name} and ${roadInfo[1].name}`);
                } else {
                    const names = roadInfo.map(r => r.name);
                    const lastRoad = names.pop();
                    console.log(`At the intersection of ${names.join(', ')} and ${lastRoad}`);
                }
            } else {
                // Not at intersection, just display roads normally
                roadGroups.forEach((group, baseName) => {
                    if (group.length > 1) {
                        const minDistance = Math.min(...group.map(r => parseFloat(r.distance)));
                        console.log(`  ${minDistance.toFixed(1)}m: ${baseName}`);
                    } else {
                        console.log(`  ${group[0].distance}m: ${group[0].fullName}`);
                    }
                });
            }
        } else {
            console.log('  None');
        }
        
        console.log(`\nPaths within 5m:`);
        const paths = nearestElements.filter(el => {
            const classes = el.classes.toLowerCase();
            return classes.includes('footway') || classes.includes('footpath') || 
                   classes.includes('pedestrian') || classes.includes('steps') || 
                   classes.includes('cycleway');
        });
        
        if (paths.length > 0) {
            paths.forEach(el => {
                console.log(`  ${el.distance}m: ${el.name || 'unnamed'} (${el.classes})`);
            });
        } else {
            console.log('  None');
        }
    }
    
    /**
     * Determine current streets from nearby features
     */
    determineCurrentStreets(immediateFeatures) {
        // Look for street/road features with geometry
        const streets = immediateFeatures.filter(f => 
            f.type.includes('highway') && f.name && !f.name.match(/^\d/)
        ).sort((a, b) => a.distance - b.distance);
        
        // For accurate "on street" detection, only consider streets we're actually close to
        const ON_STREET_THRESHOLD = 5; // meters - you're "on" a street if within this distance
        const nearbyStreets = streets.filter(s => s.distance <= ON_STREET_THRESHOLD);
        
        if (nearbyStreets.length === 0) {
            return [];
        }
        
        // Group roads by base name (without directional suffixes)
        const roadGroups = new Map();
        const directionalPattern = /\s+(North|South|East|West)$/i;
        
        nearbyStreets.forEach(street => {
            const baseName = street.name.replace(directionalPattern, '').trim();
            if (!roadGroups.has(baseName)) {
                roadGroups.set(baseName, []);
            }
            roadGroups.get(baseName).push({
                ...street,
                fullName: street.name,
                baseName: baseName,
                hasDirectional: directionalPattern.test(street.name)
            });
        });
        
        // Check if we're at an intersection
        const uniqueBaseNames = Array.from(roadGroups.keys());
        if (uniqueBaseNames.length >= 2) {
            // We're at an intersection - determine road orientations
            const roadInfo = [];
            roadGroups.forEach((group, baseName) => {
                // Try to determine orientation from geometry
                let isNorthSouth = false;
                const firstStreet = group[0];
                
                if (firstStreet.geometry && firstStreet.geometry.points && firstStreet.geometry.points.length >= 2) {
                    const points = firstStreet.geometry.points;
                    const dx = Math.abs(points[points.length-1].x - points[0].x);
                    const dy = Math.abs(points[points.length-1].y - points[0].y);
                    isNorthSouth = dy > dx;
                }
                
                // Remove common suffixes
                const cleanName = baseName.replace(/\s+(Street|Road|Avenue|Ave|St|Rd|Drive|Dr|Boulevard|Blvd)$/i, '');
                
                roadInfo.push({
                    name: cleanName,
                    isNorthSouth: isNorthSouth,
                    hasDirectionals: group.some(s => s.hasDirectional),
                    directionals: group.filter(s => s.hasDirectional)
                        .map(s => s.fullName.match(directionalPattern)?.[1])
                        .filter(Boolean)
                });
            });
            
            // Sort to put N-S streets first
            roadInfo.sort((a, b) => {
                if (a.isNorthSouth && !b.isNorthSouth) return -1;
                if (!a.isNorthSouth && b.isNorthSouth) return 1;
                return 0;
            });
            
            // Return intersection info
            return {
                type: 'intersection',
                streets: roadInfo
            };
        } else {
            // Single street - but still clean the name
            const baseName = uniqueBaseNames[0];
            const cleanName = baseName.replace(/\s+(Street|Road|Avenue|Ave|St|Rd|Drive|Dr|Boulevard|Blvd)$/i, '');
            return [cleanName];
        }
    }
    
    /**
     * Find nearest intersections
     */
    findNearestIntersections(features) {
        const intersections = [];
        
        // Find street features with geometry
        const streets = features.filter(f => 
            f.type.includes('highway') && f.name && f.geometry && f.distance <= 200
        );
        
        
        // Group streets by name (accounting for segments)
        const streetsByName = {};
        streets.forEach(street => {
            const cleanName = street.name
                .replace(/\s+(East|West|North|South)\s*$/i, '')
                .trim();
            
            if (!streetsByName[cleanName]) {
                streetsByName[cleanName] = [];
            }
            streetsByName[cleanName].push(street);
        });
        
        const streetNames = Object.keys(streetsByName);
        
        // Check for geometric intersections between different streets
        for (let i = 0; i < streetNames.length; i++) {
            for (let j = i + 1; j < streetNames.length; j++) {
                const street1Name = streetNames[i];
                const street2Name = streetNames[j];
                const street1Features = streetsByName[street1Name];
                const street2Features = streetsByName[street2Name];
                
                // Check if any segments of street1 intersect with any segments of street2
                let foundIntersection = false;
                let intersectionPoint = null;
                let minDistance = Infinity;
                
                for (const s1 of street1Features) {
                    for (const s2 of street2Features) {
                        if (s1.geometry && s2.geometry && s1.geometryType === 'polyline' && s2.geometryType === 'polyline') {
                            const intersectionPoints = this.geometryCalculator.polylineIntersections(s1.geometry, s2.geometry);
                            
                            if (intersectionPoints.length > 0) {
                                foundIntersection = true;
                                // Calculate distance to the intersection point
                                for (const point of intersectionPoints) {
                                    // Convert intersection point to lat/lng and calculate distance
                                    const intLat = s1.tileLat + (1 - point.y / 1000) * 0.01;
                                    const intLng = s1.tileLng + (point.x / 1000) * 0.01;
                                    
                                    // Use the center from the first feature as reference
                                    const centerLat = features[0].tileLat + 0.005; // Approximate center
                                    const centerLng = features[0].tileLng + 0.005;
                                    
                                    // Simple distance calculation
                                    const distance = Math.sqrt(
                                        Math.pow((intLat - centerLat) * 111000, 2) + 
                                        Math.pow((intLng - centerLng) * 111000 * Math.cos(centerLat * Math.PI / 180), 2)
                                    );
                                    
                                    if (distance < minDistance) {
                                        minDistance = distance;
                                        intersectionPoint = point;
                                    }
                                }
                            }
                        }
                    }
                }
                
                if (foundIntersection) {
                    intersections.push({
                        name: `${street1Name} and ${street2Name}`,
                        distance: Math.round(minDistance),
                        streets: [street1Name, street2Name],
                        geometricIntersection: true
                    });
                }
            }
        }
        
        // Also check against known intersections as fallback
        const knownIntersections = [
            { streets: ['Yonge Street', 'Wellington Street'], name: 'Yonge and Wellington Streets' },
            { streets: ['Yonge Street', 'Front Street'], name: 'Yonge and Front Streets' },
            { streets: ['Yonge Street', 'King Street'], name: 'Yonge and King Streets' },
            { streets: ['Yonge Street', 'Queen Street'], name: 'Yonge and Queen Streets' },
            { streets: ['Bay Street', 'Wellington Street'], name: 'Bay and Wellington Streets' },
            { streets: ['Bay Street', 'Front Street'], name: 'Bay and Front Streets' },
            { streets: ['Bay Street', 'King Street'], name: 'Bay and King Streets' },
        ];
        
        knownIntersections.forEach(intersection => {
            // Only add if we haven't already found it geometrically
            const alreadyFound = intersections.some(i => 
                i.streets.includes(intersection.streets[0].replace(' Street', '')) &&
                i.streets.includes(intersection.streets[1].replace(' Street', ''))
            );
            
            if (!alreadyFound) {
                const hasFirst = streetNames.some(name => 
                    name.includes(intersection.streets[0].replace(' Street', ''))
                );
                const hasSecond = streetNames.some(name => 
                    name.includes(intersection.streets[1].replace(' Street', ''))
                );
                
                if (hasFirst && hasSecond) {
                    // Estimate distance based on nearest street feature
                    const relevantStreets = streets.filter(s => 
                        intersection.streets.some(st => s.name && s.name.includes(st.replace(' Street', '')))
                    );
                    const minDistance = Math.min(...relevantStreets.map(s => s.distance));
                    
                    intersections.push({
                        name: intersection.name,
                        distance: minDistance,
                        streets: intersection.streets
                    });
                }
            }
        });
        
        return intersections.sort((a, b) => a.distance - b.distance);
    }
    
    /**
     * Summarize store types
     */
    summarizeStoreTypes(stores) {
        const types = {};
        stores.forEach(store => {
            let category = 'shops';
            if (store.type.includes('restaurant') || store.type.includes('cafe')) {
                category = 'restaurants';
            } else if (store.type.includes('bank')) {
                category = 'banks';
            } else if (store.type.includes('pharmacy')) {
                category = 'pharmacies';
            }
            
            if (!types[category]) types[category] = 0;
            types[category]++;
        });
        
        const descriptions = Object.entries(types).map(([type, count]) => 
            count > 1 ? `${count} ${type}` : `a ${type.slice(0, -1)}`
        );
        
        return this.joinWithAnd(descriptions);
    }
    
    /**
     * Summarize transit options
     */
    summarizeTransit(transitFeatures) {
        // Group stations and their entrances
        const stations = this.groupStationEntrances(transitFeatures);
        const descriptions = [];
        
        // Process each station and its entrances
        Object.entries(stations).forEach(([stationName, data]) => {
            if (data.entrances.length > 0) {
                // Find nearest entrance
                const nearestEntrance = data.entrances[0]; // Already sorted by distance
                let desc = this.describeStationEntrance(stationName, nearestEntrance, data.entrances);
                descriptions.push(desc);
            } else if (data.station) {
                // Single station without separate entrances
                let desc = data.station.name || 'Transit station';
                
                // Add accessibility info
                if (data.station.element) {
                    const wheelchairAccess = data.station.element.getAttribute('data-wheelchair');
                    if (wheelchairAccess === 'no') {
                        desc += ' (not wheelchair accessible)';
                    } else if (wheelchairAccess === 'limited') {
                        desc += ' (limited wheelchair access)';
                    }
                }
                
                // Add street location if available
                const streetLocation = this.getStreetLocation(data.station);
                if (streetLocation) {
                    desc += ` on ${streetLocation}`;
                }
                
                descriptions.push(desc);
            }
        });
        
        // Handle other transit stops (bus stops, etc.)
        const otherStops = transitFeatures.filter(t => 
            !t.name?.toLowerCase().includes('station') && 
            !t.name?.toLowerCase().includes('entrance') &&
            !t.type.includes('subway_entrance')
        );
        
        if (otherStops.length > 0) {
            const busStops = otherStops.filter(s => s.type.includes('bus'));
            if (busStops.length > 0) {
                descriptions.push(this.describeBusStops(busStops));
            }
        }
        
        return descriptions.length > 0 ? 
            `Transit access includes ${this.joinWithAnd(descriptions)}.` : '';
    }
    
    /**
     * Group station entrances by their parent station
     */
    groupStationEntrances(transitFeatures) {
        const stations = {};
        
        transitFeatures.forEach(feature => {
            // Identify station name from entrance name or type
            let stationName = null;
            
            if (feature.type.includes('subway_entrance') || 
                (feature.name && feature.name.toLowerCase().includes('entrance'))) {
                // Extract station name from entrance name
                // e.g., "King Station Entrance" -> "King Station"
                if (feature.name) {
                    stationName = feature.name
                        .replace(/\s*(subway\s*)?\s*entrance\s*\d*$/i, '')
                        .replace(/\s*-\s*.*$/, '') // Remove anything after dash
                        .trim();
                    
                    if (!stationName || stationName.length < 3) {
                        stationName = 'Subway Station';
                    }
                }
            } else if (feature.type.includes('station') || 
                      (feature.name && feature.name.toLowerCase().includes('station'))) {
                stationName = feature.name || 'Transit Station';
            }
            
            if (stationName) {
                if (!stations[stationName]) {
                    stations[stationName] = {
                        station: null,
                        entrances: []
                    };
                }
                
                if (feature.type.includes('entrance')) {
                    stations[stationName].entrances.push(feature);
                } else {
                    stations[stationName].station = feature;
                }
            }
        });
        
        // Sort entrances by distance for each station
        Object.values(stations).forEach(data => {
            data.entrances.sort((a, b) => a.distance - b.distance);
        });
        
        return stations;
    }
    
    /**
     * Describe a station entrance with accessibility and alternative options
     */
    describeStationEntrance(stationName, nearestEntrance, allEntrances) {
        let desc = `${stationName}`;
        const streetLocation = this.getStreetLocation(nearestEntrance);
        
        // Check accessibility of nearest entrance
        const nearestAccessibility = nearestEntrance.element?.getAttribute('data-wheelchair');
        
        if (nearestAccessibility === 'no') {
            // Nearest is not accessible - find nearest accessible one
            const accessibleEntrances = allEntrances.filter(e => {
                const access = e.element?.getAttribute('data-wheelchair');
                return access !== 'no'; // Include 'yes', 'limited', or unmarked
            });
            
            desc += ` nearest entrance`;
            if (streetLocation) desc += ` on ${streetLocation}`;
            desc += ' (not wheelchair accessible)';
            
            if (accessibleEntrances.length > 0) {
                const altEntrance = accessibleEntrances[0];
                const altLocation = this.getStreetLocation(altEntrance);
                const altAccess = altEntrance.element?.getAttribute('data-wheelchair');
                
                desc += `, nearest accessible entrance`;
                if (altLocation && altLocation !== streetLocation) {
                    desc += ` on ${altLocation}`;
                } else {
                    desc += ` ${Math.round(altEntrance.distance)}m away`;
                }
                
                if (altAccess === 'limited') {
                    desc += ' (limited access)';
                }
            }
        } else if (nearestAccessibility === 'limited') {
            desc += ` entrance`;
            if (streetLocation) desc += ` on ${streetLocation}`;
            desc += ' (limited wheelchair access)';
        } else {
            // Entrance is accessible or unmarked
            desc += ` entrance`;
            if (streetLocation) desc += ` on ${streetLocation}`;
            
            // Check if there are any inaccessible entrances to warn about
            const inaccessibleCount = allEntrances.filter(e => 
                e.element?.getAttribute('data-wheelchair') === 'no'
            ).length;
            
            if (inaccessibleCount > 0 && allEntrances.length > 1) {
                desc += ` (${inaccessibleCount} other entrance${inaccessibleCount > 1 ? 's' : ''} not accessible)`;
            }
        }
        
        return desc;
    }
    
    /**
     * Get street location from feature
     */
    getStreetLocation(feature) {
        // Check for street address in name or attributes
        if (feature.name) {
            // Look for patterns like "123 King Street" or "King Street"
            const addressMatch = feature.name.match(/(\d+\s+)?(.+\s+(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Drive|Dr|Way|Lane|Ln|Place|Pl))(?:\s|$)/i);
            if (addressMatch) {
                return addressMatch[0].trim();
            }
        }
        
        // Check for addr:street attribute
        if (feature.element) {
            const street = feature.element.getAttribute('addr:street') || 
                          feature.element.getAttribute('data-street');
            const number = feature.element.getAttribute('addr:housenumber') || 
                          feature.element.getAttribute('data-housenumber');
            
            if (street) {
                return number ? `${number} ${street}` : street;
            }
        }
        
        // Try to infer from nearby features or position
        // This would require looking at nearby street features
        return null;
    }
    
    /**
     * Describe bus stops
     */
    describeBusStops(busStops) {
        if (busStops.length === 1) {
            let desc = busStops[0].name || 'Bus stop';
            const location = this.getStreetLocation(busStops[0]);
            if (location) desc += ` on ${location}`;
            
            const access = busStops[0].element?.getAttribute('data-wheelchair');
            if (access === 'no') desc += ' (not wheelchair accessible)';
            else if (access === 'limited') desc += ' (limited wheelchair access)';
            
            return desc;
        } else {
            const notAccessible = busStops.filter(s => 
                s.element?.getAttribute('data-wheelchair') === 'no'
            ).length;
            
            let desc = `${busStops.length} bus stops`;
            if (notAccessible > 0) {
                desc += ` (${notAccessible} not wheelchair accessible)`;
            }
            return desc;
        }
    }
    
    /**
     * Determine area character
     */
    determineAreaCharacter(categorized) {
        const buildingCount = categorized.buildings.length;
        const commercialCount = categorized.commercial.length;
        const residentialCount = categorized.residential.length;
        const hasTransit = categorized.transit.length > 0;
        const hasParks = categorized.parks.length > 0;
        
        // Check accessibility across all buildings
        const accessibleBuildings = categorized.buildings.filter(b => 
            b.element && b.element.getAttribute('data-wheelchair') === 'yes'
        );
        const inaccessibleBuildings = categorized.buildings.filter(b => 
            b.element && b.element.getAttribute('data-wheelchair') === 'no'
        );
        
        let character = '';
        
        if (commercialCount > residentialCount * 2) {
            if (buildingCount > 20) {
                character = 'busy commercial district with many office buildings';
            } else {
                character = 'commercial area with office buildings and shops';
            }
        } else if (residentialCount > commercialCount) {
            if (residentialCount > 10) {
                character = 'primarily residential area with multiple apartment buildings';
            } else if (hasParks) {
                character = 'residential neighborhood with green spaces';
            } else {
                character = 'primarily residential area';
            }
        } else if (hasTransit && commercialCount > 5) {
            character = 'mixed-use area with good transit access';
        } else if (buildingCount > 15) {
            character = 'dense urban area with multiple buildings';
        } else {
            character = 'mixed-use urban area';
        }
        
        // Accessibility is now included in individual feature descriptions
        
        return character;
    }
    
    /**
     * Join array with commas and 'and'
     */
    joinWithAnd(items, useFullStops = false) {
        if (items.length === 0) return '';
        if (items.length === 1) return items[0];
        
        // Check if any items contain accessibility info in parentheses
        const hasAccessibilityInfo = items.some(item => item.includes('(') && item.includes('accessible'));
        
        if (hasAccessibilityInfo || useFullStops) {
            // Use full stops for clearer separation when items have accessibility info
            return items.join('. ');
        }
        
        if (items.length === 2) return `${items[0]} and ${items[1]}`;
        return items.slice(0, -1).join(', ') + ', and ' + items[items.length - 1];
    }
    
    /**
     * Summarize building types for area description
     */
    summarizeBuildingTypes(buildings) {
        const types = {};
        let namedCount = 0;
        
        buildings.forEach(b => {
            if (b.name && b.name.length > 3) {
                namedCount++;
            } else {
                // Categorize unnamed buildings
                let category = 'buildings';
                if (b.type.includes('residential') || b.type.includes('apartments')) {
                    category = 'residential buildings';
                } else if (b.type.includes('office')) {
                    category = 'office buildings';
                } else if (b.type.includes('commercial') || b.type.includes('retail')) {
                    category = 'commercial buildings';
                } else if (b.type.includes('industrial')) {
                    category = 'industrial buildings';
                }
                
                if (!types[category]) types[category] = 0;
                types[category]++;
            }
        });
        
        const descriptions = [];
        Object.entries(types).forEach(([type, count]) => {
            if (count > 0) {
                descriptions.push(count === 1 ? `a ${type.slice(0, -1)}` : `${count} ${type}`);
            }
        });
        
        if (descriptions.length === 0) return null;
        
        // Determine area character based on building mix
        if (descriptions.length > 1) {
            return `This area has ${this.joinWithAnd(descriptions)}.`;
        } else {
            return `There are ${descriptions[0]} here.`;
        }
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
            console.log(`DescriptionGenerator: ${tiles.size} tiles loaded in MapManager`);
            
            // Extract features from tiles
            for (const [key, tileGroup] of tiles) {
                console.log(`DescriptionGenerator: Processing tile ${key}`);
                const tileFeatures = this.extractFeaturesFromTileNew(tileGroup, bounds, key);
                console.log(`DescriptionGenerator: Extracted ${tileFeatures.length} features from tile ${key}`);
                features.push(...tileFeatures);
            }
            
            // Calculate distances and filter by max distance
            const featuresWithDistance = features.map(feature => {
                const distance = this.calculateFeatureDistance(feature, area.center);
                return { ...feature, distance };
            }).filter(f => f.distance <= maxDistance);
            
            
            // Sort by distance
            featuresWithDistance.sort((a, b) => a.distance - b.distance);
            
            
            
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
                
                // Parse embedded accessibility info from name
                // Some tiles include accessibility in the name like "Building, Not wheelchair accessible"
                if (name.includes('Not wheelchair accessible')) {
                    name = name.replace(/,?\s*Not wheelchair accessible,?/gi, '').trim();
                    // Set the wheelchair attribute if not already set
                    if (!element.getAttribute('data-wheelchair')) {
                        element.setAttribute('data-wheelchair', 'no');
                    }
                }
                if (name.includes('Limited wheelchair access')) {
                    name = name.replace(/,?\s*Limited wheelchair access,?/gi, '').trim();
                    if (!element.getAttribute('data-wheelchair')) {
                        element.setAttribute('data-wheelchair', 'limited');
                    }
                }
                if (name.includes('Wheelchair accessible')) {
                    name = name.replace(/,?\s*Wheelchair accessible,?/gi, '').trim();
                    if (!element.getAttribute('data-wheelchair')) {
                        element.setAttribute('data-wheelchair', 'yes');
                    }
                }
                
                // Handle tactile paving info
                if (name.match(/tactile paving/i)) {
                    // This is likely a crossing feature
                    if (!type.includes('crossing')) {
                        type = 'crossing';
                    }
                    // Just mark it as a crossing, don't put tactile info in the name
                    name = 'Pedestrian crossing';
                    if (name.match(/No tactile paving/i)) {
                        element.setAttribute('data-tactile-paving', 'no');
                    } else {
                        element.setAttribute('data-tactile-paving', 'yes');
                    }
                }
                
                // Clean up feature type info that might be embedded in name
                if (name.includes('Subway Entrance')) {
                    name = name.replace(/,?\s*Subway Entrance,?/gi, '').trim();
                    if (!type.includes('entrance')) {
                        type = 'subway_entrance';
                    }
                }
                
                // Handle addresses that might be split across comma-separated parts
                // Look for patterns like "Building, at 21, Street Name"
                if (name.includes(' at ')) {
                    // Try to reassemble the address
                    const parts = name.split(',').map(p => p.trim());
                    let rebuiltName = '';
                    let currentPart = '';
                    
                    for (let i = 0; i < parts.length; i++) {
                        const part = parts[i];
                        
                        // Skip accessibility info - we already extracted it
                        if (part.match(/wheelchair accessible|not accessible/i)) continue;
                        
                        // If this part starts with "at" followed by a number, it's likely part of an address
                        if (part.match(/^at\s+\d+/)) {
                            // This should be combined with the previous and next parts
                            currentPart += ' ' + part;
                            // Look ahead for the street name
                            if (i + 1 < parts.length) {
                                currentPart += ' ' + parts[i + 1];
                                i++; // Skip the next part since we've used it
                            }
                        } else if (currentPart) {
                            // Add the accumulated part
                            rebuiltName += (rebuiltName ? ', ' : '') + currentPart.trim();
                            currentPart = part;
                        } else {
                            currentPart = part;
                        }
                    }
                    
                    // Add any remaining part
                    if (currentPart && !currentPart.match(/wheelchair accessible|not accessible/i)) {
                        rebuiltName += (rebuiltName ? ' ' : '') + currentPart.trim();
                    }
                    
                    name = rebuiltName;
                }
                
                // Remove double commas and trailing commas
                name = name.replace(/,\s*,/g, ',').replace(/,\s*$/, '').replace(/\s+/g, ' ').trim();
            }
            
            if (type) {
                // Try to get a complete address if we have address components
                if (element) {
                    const street = element.getAttribute('addr:street') || element.getAttribute('data-street');
                    const housenumber = element.getAttribute('addr:housenumber') || element.getAttribute('data-housenumber');
                    
                    // If we have address components and the name looks incomplete
                    if (street && housenumber && name && !name.includes(street)) {
                        // Build a complete address
                        name = `${name} at ${housenumber} ${street}`;
                    }
                }
                
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
                    
                    // Parse geometry for proper distance calculations
                    const geometry = this.geometryParser.parseElement(element);
                    if (geometry && geometry.points.length > 0) {
                        feature.geometryType = geometry.type;
                        feature.geometry = geometry.points;
                        
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
     * Extract features from a tile SVG (new implementation)
     */
    extractFeaturesFromTileNew(tileGroup, bounds, tileKey) {
        const features = [];
        
        // Parse tile coordinates from key (e.g., "43.648_-79.378")
        let tileLat = 0, tileLng = 0;
        if (tileKey) {
            const parts = tileKey.split('_');
            tileLat = parseFloat(parts[0]);
            tileLng = parseFloat(parts[1]);
        }
        
        // The SVG tiles have a specific structure:
        // <g id="roads" class="feature-group roads">
        //   <g><title>Street Name, road</title><path.../><path.../></g>
        // </g>
        // <g id="buildings" class="feature-group buildings">
        //   <polygon title="Building Name">...</polygon>
        // </g>
        
        // Process roads
        const roadsGroup = tileGroup.querySelector('#roads');
        console.log(`  Found roads group: ${!!roadsGroup}`);
        if (roadsGroup) {
            const roadElements = roadsGroup.querySelectorAll('g');
            console.log(`  Found ${roadElements.length} road elements`);
            roadElements.forEach(roadGroup => {
                const titleElement = roadGroup.querySelector('title');
                if (titleElement && titleElement.textContent) {
                    const titleText = titleElement.textContent.trim();
                    let name = titleText;
                    let type = 'highway';
                    
                    // Parse title like "Lake Shore Boulevard West, road" or "King Street East, road"
                    if (titleText.includes(', road')) {
                        name = titleText.replace(', road', '').trim();
                        type = 'highway:secondary'; // Default road type
                    } else if (titleText === 'Road') {
                        name = '';
                        type = 'highway:unclassified';
                    }
                    
                    // Find the path elements for this road
                    const pathElements = roadGroup.querySelectorAll('path[role="img"]');
                    pathElements.forEach(pathElement => {
                        const geometry = this.parseElementGeometry(pathElement, tileLat, tileLng);
                        if (geometry && geometry.coordinates.length > 0) {
                            features.push({
                                type: type,
                                name: name,
                                geometry: geometry.coordinates,
                                geometryType: geometry.type === 'LineString' ? 'polyline' : geometry.type.toLowerCase(),
                                element: pathElement,
                                tileKey: tileKey,
                                tileLat: tileLat,
                                tileLng: tileLng,
                                id: roadGroup.getAttribute('id') || '',
                                accessibility: { wheelchair: 'unknown' }
                            });
                        }
                    });
                }
            });
        }
        
        // Process buildings
        const buildingsGroup = tileGroup.querySelector('#buildings');
        if (buildingsGroup) {
            const buildingElements = buildingsGroup.querySelectorAll('polygon, rect');
            buildingElements.forEach(buildingElement => {
                const title = buildingElement.getAttribute('title') || 
                             buildingElement.getAttribute('aria-label') || '';
                const name = title.replace(', building', '').trim();
                
                const geometry = this.parseElementGeometry(buildingElement, tileLat, tileLng);
                if (geometry && geometry.coordinates.length > 0) {
                    features.push({
                        type: 'building',
                        name: name,
                        geometry: geometry.coordinates,
                        geometryType: geometry.type.toLowerCase(),
                        element: buildingElement,
                        tileKey: tileKey,
                        tileLat: tileLat,
                        tileLng: tileLng,
                        id: buildingElement.getAttribute('id') || '',
                        accessibility: { wheelchair: 'unknown' }
                    });
                }
            });
        }
        
        // Process other feature groups (amenities, shops, etc.)
        const featureGroups = tileGroup.querySelectorAll('g[id]');
        featureGroups.forEach(group => {
            const groupId = group.getAttribute('id');
            if (groupId === 'roads' || groupId === 'buildings') {
                return; // Already processed above
            }
            
            // Convert group ID to feature type (e.g., 'amenities' -> 'amenity')
            let featureType = groupId;
            if (featureType.endsWith('s')) {
                featureType = featureType.slice(0, -1);
            }
            
            // Process elements in this group
            const elements = group.querySelectorAll('circle, polygon, rect, path');
            elements.forEach(element => {
                const title = element.getAttribute('title') || 
                             element.getAttribute('aria-label') || '';
                const name = title.replace(new RegExp(`, ${featureType}`, 'i'), '').trim();
                
                const geometry = this.parseElementGeometry(element, tileLat, tileLng);
                if (geometry && geometry.coordinates.length > 0) {
                    features.push({
                        type: featureType,
                        name: name,
                        geometry: geometry.coordinates,
                        geometryType: geometry.type === 'LineString' ? 'polyline' : geometry.type.toLowerCase(),
                        element: element,
                        tileKey: tileKey,
                        tileLat: tileLat,
                        tileLng: tileLng,
                        id: element.getAttribute('id') || '',
                        accessibility: { wheelchair: 'unknown' }
                    });
                }
            });
        });
        
        return features;
    }
    
    /**
     * Parse element geometry for distance calculations
     */
    parseElementGeometry(element, tileLat, tileLng) {
        try {
            const tagName = element.tagName.toLowerCase();
            
            if (tagName === 'path') {
                const d = element.getAttribute('d');
                if (d) {
                    const points = this.geometryParser.parsePathData(d);
                    if (points.length > 0) {
                        return {
                            type: 'LineString',
                            coordinates: points.map(p => [p.x, p.y])
                        };
                    }
                }
            } else if (tagName === 'polygon') {
                const points = element.getAttribute('points');
                if (points) {
                    const coords = points.split(/[\s,]+/).filter(p => p).map(parseFloat);
                    const coordPairs = [];
                    for (let i = 0; i < coords.length; i += 2) {
                        if (i + 1 < coords.length) {
                            coordPairs.push([coords[i], coords[i + 1]]);
                        }
                    }
                    if (coordPairs.length > 0) {
                        return {
                            type: 'Polygon',
                            coordinates: [coordPairs]
                        };
                    }
                }
            } else if (tagName === 'circle') {
                const cx = parseFloat(element.getAttribute('cx') || 0);
                const cy = parseFloat(element.getAttribute('cy') || 0);
                return {
                    type: 'Point',
                    coordinates: [cx, cy]
                };
            } else if (tagName === 'rect') {
                const x = parseFloat(element.getAttribute('x') || 0);
                const y = parseFloat(element.getAttribute('y') || 0);
                const width = parseFloat(element.getAttribute('width') || 0);
                const height = parseFloat(element.getAttribute('height') || 0);
                
                const coords = [
                    [x, y],
                    [x + width, y],
                    [x + width, y + height],
                    [x, y + height],
                    [x, y]
                ];
                return {
                    type: 'Polygon',
                    coordinates: [coords]
                };
            }
        } catch (error) {
            console.error('Error parsing element geometry:', error);
        }
        
        return null;
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
        if (!feature.position && !feature.geometry) return 999999; // Far away if no position
        
        // Calculate feature's actual lat/lng based on its tile and position within tile
        const tileSize = 0.01; // degrees per tile (tiles are 0.01° x 0.01°)
        const svgSize = 1000; // SVG units per tile (tiles have viewBox="0 0 1000 1000")
        
        // If we have geometry, use proper geometric distance calculation
        if (feature.geometry && feature.geometryType && feature.geometry.length > 0) {
            // Convert center to global MapManager coordinate system
            const centerSVGX = center.lng * 100 * 1000;
            const centerSVGY = -center.lat * 100 * 1000;
            const centerPoint = { x: centerSVGX, y: centerSVGY };
            
            // Debug first few features to see coordinate conversion
            if (Math.random() < 0.001 && feature.name) { 
                console.log(`Distance calc for ${feature.name}:`);
                console.log(`  Center: (${center.lat}, ${center.lng}) -> SVG(${centerSVGX}, ${centerSVGY})`);
                console.log(`  Feature tile: (${feature.tileLat}, ${feature.tileLng})`);
                console.log(`  Feature geometry sample:`, feature.geometry.slice(0, 2));
            }
            
            // Convert feature geometry from tile-relative to global coordinates
            // Each tile is 1000 SVG units covering 0.01 degrees
            // Tile (43.64, -79.39) covers lat 43.64-43.65, lng -79.39 to -79.38
            const tileSVGX = feature.tileLng * 100 * 1000;  // Tile's left edge in global coords
            const tileSVGY = -(feature.tileLat + 0.01) * 100 * 1000;  // Tile's top edge in global coords (inverted Y)
            
            // Transform feature geometry to global coordinates
            const globalGeometry = feature.geometry.map(point => ({
                x: tileSVGX + point[0],
                y: tileSVGY + point[1]
            }));
            
            let distanceInSVGUnits;
            
            switch (feature.geometryType) {
                case 'polygon':
                    distanceInSVGUnits = this.geometryCalculator.pointToPolygonDistance(centerPoint, globalGeometry);
                    break;
                case 'polyline':
                    distanceInSVGUnits = this.geometryCalculator.pointToPolylineDistance(centerPoint, globalGeometry);
                    break;
                case 'point':
                default:
                    // For points, use the simple distance to the point
                    if (globalGeometry[0]) {
                        distanceInSVGUnits = this.geometryCalculator.pointToPointDistance(centerPoint, globalGeometry[0]);
                    } else {
                        return 999999;
                    }
                    break;
            }
            
            // Convert SVG units to meters
            // 1000 SVG units = 0.01 degrees ≈ 1.11 km at this latitude
            // So 1 SVG unit ≈ 1.11 meters
            const metersPerSVGUnit = 1.11;
            return Math.round(distanceInSVGUnits * metersPerSVGUnit);
        }
        
        // Fall back to center point distance using Haversine formula
        if (!feature.position) return 999999;
        
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
        // First, try to find the nearest intersection
        const intersections = this.findNearestIntersections(features);
        if (intersections.length > 0 && intersections[0].distance < 50) {
            return intersections[0].name;
        }
        
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
            const svgSize = 1000;
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
    
    /**
     * Get unique feature ID for tracking mentions
     */
    getFeatureId(feature) {
        // Use name and type for named features
        if (feature.name && feature.name.length > 3) {
            return `${feature.type}:${feature.name}`;
        }
        // Use position for unnamed features
        return `${feature.type}:${feature.tileLat}_${feature.tileLng}:${feature.position?.x || 0}_${feature.position?.y || 0}`;
    }
    
    /**
     * Determine which street the user is facing along
     */
    determineStreetOrientation(area, intersection, features) {
        if (!area.heading && area.heading !== 0) return null;
        
        // Use the streets array if available, otherwise parse from name
        const streets = intersection.streets || intersection.name.split(' and ');
        if (streets.length !== 2) return null;
        
        // Find the actual street features to determine their orientation
        const streetFeatures = features.filter(f => 
            f.type.includes('highway') && 
            f.distance < 100 &&
            streets.some(street => f.name && f.name.includes(street.replace(' Street', '').replace(' Avenue', '')))
        );
        
        // Group street segments by name and calculate their general bearing
        const streetBearings = {};
        streets.forEach(streetName => {
            const segments = streetFeatures.filter(f => 
                f.name && f.name.includes(streetName.replace(' Street', '').replace(' Avenue', ''))
            );
            
            if (segments.length >= 2) {
                // Calculate average bearing of this street
                // For now, use a simplified approach - would need more complex calculation
                // North-South streets (like Yonge) have bearings near 0° or 180°
                // East-West streets (like Front) have bearings near 90° or 270°
                const isNorthSouth = streetName.toLowerCase().includes('yonge') || 
                                   streetName.toLowerCase().includes('bay') ||
                                   streetName.toLowerCase().includes('university');
                
                const isEastWest = streetName.toLowerCase().includes('front') ||
                                 streetName.toLowerCase().includes('king') ||
                                 streetName.toLowerCase().includes('queen');
                
                if (isNorthSouth) {
                    streetBearings[streetName] = [0, 180]; // North or South
                } else if (isEastWest) {
                    streetBearings[streetName] = [90, 270]; // East or West
                }
            }
        });
        
        // Check which street the user is facing along (within 30° tolerance)
        const userHeading = area.heading;
        const tolerance = 30;
        
        for (const [streetName, bearings] of Object.entries(streetBearings)) {
            for (const bearing of bearings) {
                const diff = Math.abs((userHeading - bearing + 360) % 360);
                const minDiff = Math.min(diff, 360 - diff);
                
                if (minDiff <= tolerance) {
                    const direction = this.headingToCardinalDirection(userHeading);
                    return `Looking ${direction} along ${streetName}.`;
                }
            }
        }
        
        // If not facing along a street, just report the direction
        const direction = this.headingToCardinalDirection(userHeading);
        return `Facing ${direction}.`;
    }
    
    /**
     * Convert heading to cardinal direction
     */
    headingToCardinalDirection(heading) {
        const directions = ['north', 'northeast', 'east', 'southeast', 
                          'south', 'southwest', 'west', 'northwest'];
        const index = Math.round(heading / 45) % 8;
        return directions[index];
    }
    
    /**
     * Get a natural description of the street's orientation relative to the user
     */
    getStreetOrientationDescription(streetBearing, userHeading, sideDescription) {
        // Normalize bearings
        streetBearing = (streetBearing + 360) % 360;
        userHeading = (userHeading + 360) % 360;
        
        // The street can run in two directions (bearing and bearing + 180)
        const streetBearing1 = streetBearing;
        const streetBearing2 = (streetBearing + 180) % 360;
        
        // Calculate angle differences
        let diff1 = streetBearing1 - userHeading;
        if (diff1 > 180) diff1 -= 360;
        if (diff1 < -180) diff1 += 360;
        
        let diff2 = streetBearing2 - userHeading;
        if (diff2 > 180) diff2 -= 360;
        if (diff2 < -180) diff2 += 360;
        
        // Use the smaller absolute difference
        const diff = Math.abs(diff1) < Math.abs(diff2) ? diff1 : diff2;
        const absDiff = Math.abs(diff);
        
        // Determine relative position with simple, natural language
        if (absDiff < 22.5) {
            // User is facing along the street
            return "facing along the street";
        } else if (absDiff > 157.5) {
            // User is facing opposite to the street direction
            return "facing along the street in the opposite direction";
        } else if (absDiff >= 67.5 && absDiff <= 112.5) {
            // Street runs perpendicular to user's facing direction
            // Need to determine if user is facing toward or away from the street
            // This depends on which side they're on
            
            // Determine if street runs E-W or N-S
            const isEastWest = (streetBearing >= 45 && streetBearing < 135) || 
                               (streetBearing >= 225 && streetBearing < 315);
            
            // Determine if user is facing toward or away from street
            if (isEastWest) {
                // Street runs E-W
                if ((sideDescription === 'south' && userHeading < 90) || 
                    (sideDescription === 'south' && userHeading > 270) ||
                    (sideDescription === 'north' && userHeading >= 90 && userHeading <= 270)) {
                    return "facing the street";
                } else {
                    return "facing away from the street";
                }
            } else {
                // Street runs N-S
                if ((sideDescription === 'west' && userHeading >= 0 && userHeading < 180) ||
                    (sideDescription === 'east' && userHeading >= 180 && userHeading < 360)) {
                    return "facing the street";
                } else {
                    return "facing away from the street";
                }
            }
        } else {
            // Street is at an angle
            if (diff > 0) {
                if (absDiff < 67.5) {
                    return "facing diagonally to the street which runs ahead to your right";
                } else {
                    return "facing away from the street which runs behind you to the left";
                }
            } else {
                if (absDiff < 67.5) {
                    return "facing diagonally to the street which runs ahead to your left";
                } else {
                    return "facing away from the street which runs behind you to the right";
                }
            }
        }
    }
    
    /**
     * Get the street's position relative to the user's heading (deprecated)
     */
    getStreetRelativePosition(streetBearing, userHeading) {
        // Normalize bearings
        streetBearing = (streetBearing + 360) % 360;
        userHeading = (userHeading + 360) % 360;
        
        // The street can run in two directions (bearing and bearing + 180)
        const streetBearing1 = streetBearing;
        const streetBearing2 = (streetBearing + 180) % 360;
        
        // Calculate angle differences
        let diff1 = streetBearing1 - userHeading;
        if (diff1 > 180) diff1 -= 360;
        if (diff1 < -180) diff1 += 360;
        
        let diff2 = streetBearing2 - userHeading;
        if (diff2 > 180) diff2 -= 360;
        if (diff2 < -180) diff2 += 360;
        
        // Use the smaller absolute difference
        const diff = Math.abs(diff1) < Math.abs(diff2) ? diff1 : diff2;
        const absDiff = Math.abs(diff);
        
        // Determine relative position
        if (absDiff < 22.5) {
            // User is facing along the street
            return "running straight ahead";
        } else if (absDiff > 157.5) {
            // User is facing opposite to the street
            return "running behind you";
        } else if (diff > 0) {
            // Street is to the right
            if (absDiff < 67.5) {
                return "running ahead to your right";
            } else if (absDiff < 112.5) {
                return "running to your right";
            } else {
                return "running behind to your right";
            }
        } else {
            // Street is to the left
            if (absDiff < 67.5) {
                return "running ahead to your left";
            } else if (absDiff < 112.5) {
                return "running to your left";
            } else {
                return "running behind to your left";
            }
        }
    }
    
    /**
     * Determine which corner of an intersection the user is on
     */
    getIntersectionCorner(center, roadInfo, tiles) {
        // We need to determine which quadrant of the intersection we're in
        // First, find the approximate center of the intersection
        
        // Get the two roads
        const road1 = roadInfo[0];
        const road2 = roadInfo[1];
        
        // For each road, find the closest point to the user
        let road1Point = null;
        let road2Point = null;
        
        // Process road 1
        if (road1.group && road1.group.length > 0) {
            const roadElement = road1.group[0];
            if (roadElement.geometry && roadElement.geometry.type === 'polyline') {
                // Find which tile contains this road
                for (const [tileKey, tileGroup] of tiles) {
                    if (tileGroup.contains(roadElement.element)) {
                        const [tileLat, tileLng] = tileKey.split('_').map(parseFloat);
                        const userX = ((center.lng - tileLng) / 0.01) * 1000;
                        const userY = ((tileLat + 0.01 - center.lat) / 0.01) * 1000;
                        const userPoint = { x: userX, y: userY };
                        
                        const closestInfo = this.geometryCalculator.closestPointOnPolyline(
                            userPoint, 
                            roadElement.geometry.points
                        );
                        
                        if (closestInfo) {
                            road1Point = {
                                point: closestInfo.closestPoint,
                                segmentIndex: closestInfo.segmentIndex,
                                geometry: roadElement.geometry.points
                            };
                        }
                        break;
                    }
                }
            }
        }
        
        // Process road 2
        if (road2.group && road2.group.length > 0) {
            const roadElement = road2.group[0];
            if (roadElement.geometry && roadElement.geometry.type === 'polyline') {
                // Find which tile contains this road
                for (const [tileKey, tileGroup] of tiles) {
                    if (tileGroup.contains(roadElement.element)) {
                        const [tileLat, tileLng] = tileKey.split('_').map(parseFloat);
                        const userX = ((center.lng - tileLng) / 0.01) * 1000;
                        const userY = ((tileLat + 0.01 - center.lat) / 0.01) * 1000;
                        const userPoint = { x: userX, y: userY };
                        
                        const closestInfo = this.geometryCalculator.closestPointOnPolyline(
                            userPoint, 
                            roadElement.geometry.points
                        );
                        
                        if (closestInfo) {
                            road2Point = {
                                point: closestInfo.closestPoint,
                                segmentIndex: closestInfo.segmentIndex,
                                geometry: roadElement.geometry.points
                            };
                        }
                        break;
                    }
                }
            }
        }
        
        if (!road1Point || !road2Point) {
            return '';
        }
        
        // Now determine which side of each road we're on
        const road1Bearing = this.geometryCalculator.bearing(
            road1Point.geometry[road1Point.segmentIndex],
            road1Point.geometry[road1Point.segmentIndex + 1]
        );
        
        const road2Bearing = this.geometryCalculator.bearing(
            road2Point.geometry[road2Point.segmentIndex],
            road2Point.geometry[road2Point.segmentIndex + 1]
        );
        
        // Determine primary orientations
        const road1IsNS = road1.isNorthSouth;
        const road2IsNS = road2.isNorthSouth;
        
        // Simple corner determination for perpendicular roads
        if (road1IsNS && !road2IsNS) {
            // Road 1 is N-S, Road 2 is E-W
            // We need the user's position in SVG coordinates
            const [tileLat, tileLng] = Array.from(tiles.keys())[0].split('_').map(parseFloat);
            const userX = ((center.lng - tileLng) / 0.01) * 1000;
            const userY = ((tileLat + 0.01 - center.lat) / 0.01) * 1000;
            const userSvgPoint = { x: userX, y: userY };
            
            // Determine if we're east or west of the N-S road
            const nsRoadSide = this.getSimpleCardinalSide(userSvgPoint, road1Point.point, road1Bearing, true);
            // Determine if we're north or south of the E-W road
            const ewRoadSide = this.getSimpleCardinalSide(userSvgPoint, road2Point.point, road2Bearing, false);
            
            return `${ewRoadSide}${nsRoadSide}`;
        } else if (!road1IsNS && road2IsNS) {
            // Road 1 is E-W, Road 2 is N-S
            // We need the user's position in SVG coordinates
            const [tileLat, tileLng] = Array.from(tiles.keys())[0].split('_').map(parseFloat);
            const userX = ((center.lng - tileLng) / 0.01) * 1000;
            const userY = ((tileLat + 0.01 - center.lat) / 0.01) * 1000;
            const userSvgPoint = { x: userX, y: userY };
            
            // Determine if we're north or south of the E-W road
            const ewRoadSide = this.getSimpleCardinalSide(userSvgPoint, road1Point.point, road1Bearing, false);
            // Determine if we're east or west of the N-S road
            const nsRoadSide = this.getSimpleCardinalSide(userSvgPoint, road2Point.point, road2Bearing, true);
            
            return `${ewRoadSide}${nsRoadSide}`;
        }
        
        // For non-perpendicular intersections, return empty
        return '';
    }
    
    /**
     * Get simple cardinal side for intersection corners
     */
    getSimpleCardinalSide(userPoint, roadPoint, roadBearing, isNorthSouth) {
        // Create a vector from road point to user
        const dx = userPoint.x - roadPoint.x;
        const dy = userPoint.y - roadPoint.y;
        
        if (isNorthSouth) {
            // For N-S roads, check if user is east or west
            return dx > 0 ? 'east' : 'west';
        } else {
            // For E-W roads, check if user is north or south
            // Remember SVG Y increases downward
            return dy < 0 ? 'north' : 'south';
        }
    }
    
    /**
     * Format cross street information using clock positions and relative directions
     */
    formatCrossStreetInfo(crossStreets, segmentBearing, streetDirection) {
        if (!crossStreets.forward && !crossStreets.backward) {
            return null;
        }
        
        const parts = [];
        
        // Get user's heading
        const userHeading = this.userHeading || 0;
        
        // We need the user's position to calculate angles
        // This should be passed in, but for now we'll use the stored position
        const userPoint = this.currentUserPoint;
        
        if (!userPoint) {
            // Fallback to simple directions if we don't have user position
            return this.formatCrossStreetInfoSimple(crossStreets);
        }
        
        // Format forward cross street
        if (crossStreets.forward) {
            // Calculate actual bearing from user to cross street
            const bearing = this.geometryCalculator.bearing(userPoint, crossStreets.forward.point);
            const clockPosition = this.bearingToClockPosition(bearing, userHeading);
            
            if (crossStreets.forward.name === 'dead end') {
                parts.push(`Dead end ${crossStreets.forward.distance}m at ${clockPosition}`);
            } else {
                parts.push(`${crossStreets.forward.name} ${crossStreets.forward.distance}m at ${clockPosition}`);
            }
        }
        
        // Format backward cross street
        if (crossStreets.backward) {
            // Calculate actual bearing from user to cross street
            const bearing = this.geometryCalculator.bearing(userPoint, crossStreets.backward.point);
            const clockPosition = this.bearingToClockPosition(bearing, userHeading);
            
            if (crossStreets.backward.name === 'dead end') {
                parts.push(`Dead end ${crossStreets.backward.distance}m at ${clockPosition}`);
            } else {
                parts.push(`${crossStreets.backward.name} ${crossStreets.backward.distance}m at ${clockPosition}`);
            }
        }
        
        if (parts.length === 0) {
            return null;
        } else if (parts.length === 1) {
            return parts[0];
        } else {
            return parts.join(', ');
        }
    }
    
    /**
     * Convert bearing to clock position based on user heading
     */
    bearingToClockPosition(targetBearing, userHeading) {
        // Normalize bearings
        targetBearing = (targetBearing + 360) % 360;
        userHeading = (userHeading + 360) % 360;
        
        // Calculate relative angle (0 = straight ahead)
        let relativeAngle = targetBearing - userHeading;
        if (relativeAngle < 0) relativeAngle += 360;
        
        // Convert to clock position
        const hour = Math.round(relativeAngle / 30);
        const clockHour = hour === 0 ? 12 : hour;
        
        // Add descriptive text based on position
        if (clockHour === 12) {
            return "12 o'clock (straight ahead)";
        } else if (clockHour === 6) {
            return "6 o'clock (directly behind)";
        } else if (clockHour === 3) {
            return "3 o'clock (to your right)";
        } else if (clockHour === 9) {
            return "9 o'clock (to your left)";
        } else if (clockHour >= 1 && clockHour <= 2) {
            return `${clockHour} o'clock (ahead to your right)`;
        } else if (clockHour >= 4 && clockHour <= 5) {
            return `${clockHour} o'clock (behind to your right)`;
        } else if (clockHour >= 7 && clockHour <= 8) {
            return `${clockHour} o'clock (behind to your left)`;
        } else if (clockHour >= 10 && clockHour <= 11) {
            return `${clockHour} o'clock (ahead to your left)`;
        }
        
        return `${clockHour} o'clock`;
    }
    
    /**
     * Simple fallback formatting
     */
    formatCrossStreetInfoSimple(crossStreets) {
        const parts = [];
        
        if (crossStreets.forward) {
            if (crossStreets.forward.name === 'dead end') {
                parts.push(`Dead end ${crossStreets.forward.distance}m ahead`);
            } else {
                parts.push(`${crossStreets.forward.name} ${crossStreets.forward.distance}m ahead`);
            }
        }
        
        if (crossStreets.backward) {
            if (crossStreets.backward.name === 'dead end') {
                parts.push(`Dead end ${crossStreets.backward.distance}m behind`);
            } else {
                parts.push(`${crossStreets.backward.name} ${crossStreets.backward.distance}m behind`);
            }
        }
        
        return parts.join(', ');
    }
    
    /**
     * Get relative directions based on user heading
     */
    getRelativeDirection(streetBearing, userHeading) {
        // Normalize bearings
        streetBearing = (streetBearing + 360) % 360;
        userHeading = (userHeading + 360) % 360;
        
        // Calculate angle difference
        let angleDiff = streetBearing - userHeading;
        if (angleDiff > 180) angleDiff -= 360;
        if (angleDiff < -180) angleDiff += 360;
        
        // Determine relative directions
        let forward, backward;
        
        // User facing same direction as street
        if (Math.abs(angleDiff) < 22.5) {
            forward = "ahead (12 o'clock)";
            backward = "behind you (6 o'clock)";
        }
        // User facing opposite direction
        else if (Math.abs(angleDiff) > 157.5) {
            forward = "behind you (6 o'clock)";
            backward = "ahead (12 o'clock)";
        }
        // User facing perpendicular to street
        else if (angleDiff > 0) {
            // Street is to the right
            if (angleDiff < 67.5) {
                forward = "to your right (1-2 o'clock)";
                backward = "to your left (7-8 o'clock)";
            } else if (angleDiff < 112.5) {
                forward = "to your right (3 o'clock)";
                backward = "to your left (9 o'clock)";
            } else {
                forward = "to your right and behind (4-5 o'clock)";
                backward = "to your left and ahead (10-11 o'clock)";
            }
        } else {
            // Street is to the left
            if (angleDiff > -67.5) {
                forward = "to your left (10-11 o'clock)";
                backward = "to your right (4-5 o'clock)";
            } else if (angleDiff > -112.5) {
                forward = "to your left (9 o'clock)";
                backward = "to your right (3 o'clock)";
            } else {
                forward = "to your left and behind (7-8 o'clock)";
                backward = "to your right and ahead (1-2 o'clock)";
            }
        }
        
        return { forward, backward };
    }
    
    /**
     * Find nearest cross streets in both directions along a street
     */
    findNearestCrossStreets(userPoint, roadElement, segmentIndex, tiles) {
        const result = {
            forward: null,
            backward: null
        };
        
        if (!roadElement.geometry || roadElement.geometry.type !== 'polyline') {
            return result;
        }
        
        const polyline = roadElement.geometry.points;
        
        console.log(`\n=== Finding cross streets for ${roadElement.name} ===`);
        console.log(`Current segment index: ${segmentIndex}, Total points: ${polyline.length}`);
        
        // Check forward direction - get the last point of the polyline
        // Always check, regardless of current segment position
        const endPoint = polyline[polyline.length - 1];
        const endDistance = this.geometryCalculator.pointToPointDistance(userPoint, endPoint);
        const endDistanceInMeters = Math.round(endDistance * 1.11);
        
        console.log(`\nForward direction - checking point at end of polyline:`);
        
        // Add debug crosshair at this point
        this.addDebugCrosshair(endPoint, tiles, roadElement, 'forward-crosshair');
        
        const forwardRoads = this.findRoadsAtPoint(endPoint, tiles, roadElement);
        
        if (forwardRoads.length > 0) {
            // Prioritize actual roads over paths
            const actualRoads = forwardRoads.filter(r => !r.isPath);
            const pathsOnly = forwardRoads.filter(r => r.isPath);
            
            if (actualRoads.length > 0) {
                // Use the first actual road
                result.forward = {
                    name: actualRoads[0].name,
                    distance: endDistanceInMeters,
                    point: endPoint
                };
            } else if (pathsOnly.length > 0) {
                // Only paths available - describe them properly
                const path = pathsOnly[0];
                const pathName = path.name === 'Pedestrian' || path.name === 'unnamed' ? 
                    'pedestrian path' : path.name;
                result.forward = {
                    name: pathName,
                    distance: endDistanceInMeters,
                    point: endPoint
                };
            }
        } else {
            result.forward = {
                name: 'dead end',
                distance: endDistanceInMeters,
                point: endPoint
            };
        }
        
        // Check backward direction - get the first point of the polyline
        // Always check, regardless of current segment position
        const startPoint = polyline[0];
        const startDistance = this.geometryCalculator.pointToPointDistance(userPoint, startPoint);
        const startDistanceInMeters = Math.round(startDistance * 1.11);
        
        console.log(`\nBackward direction - checking point at start of polyline:`);
        
        // Add debug crosshair at this point
        this.addDebugCrosshair(startPoint, tiles, roadElement, 'backward-crosshair');
        
        const backwardRoads = this.findRoadsAtPoint(startPoint, tiles, roadElement);
        
        if (backwardRoads.length > 0) {
            // Prioritize actual roads over paths
            const actualRoads = backwardRoads.filter(r => !r.isPath);
            const pathsOnly = backwardRoads.filter(r => r.isPath);
            
            if (actualRoads.length > 0) {
                // Use the first actual road
                result.backward = {
                    name: actualRoads[0].name,
                    distance: startDistanceInMeters,
                    point: startPoint
                };
            } else if (pathsOnly.length > 0) {
                // Only paths available - describe them properly
                const path = pathsOnly[0];
                const pathName = path.name === 'Pedestrian' || path.name === 'unnamed' ? 
                    'pedestrian path' : path.name;
                result.backward = {
                    name: pathName,
                    distance: startDistanceInMeters,
                    point: startPoint
                };
            }
        } else {
            result.backward = {
                name: 'dead end',
                distance: startDistanceInMeters,
                point: startPoint
            };
        }
        
        return result;
    }
    
    /**
     * Add a debug crosshair at a specific point
     */
    addDebugCrosshair(point, tiles, roadElement, id) {
        // Find which tile contains this road element to get the transform
        let tileTransform = '';
        let tileKey = '';
        
        for (const [key, tileGroup] of tiles) {
            if (tileGroup.contains(roadElement.element)) {
                tileTransform = tileGroup.getAttribute('transform') || '';
                tileKey = key;
                break;
            }
        }
        
        if (!tileTransform) return;
        
        // Get the overlay container from mapManager
        const overlayContainer = this.mapManager.overlayContainer;
        if (!overlayContainer) return;
        
        // Remove any existing crosshair with this ID
        const existing = overlayContainer.querySelector(`#${id}`);
        if (existing) {
            existing.remove();
        }
        
        // Create a crosshair group with the same transform as the tile
        const crosshair = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        crosshair.setAttribute('id', id);
        crosshair.setAttribute('transform', tileTransform);
        
        // Horizontal line
        const hLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        hLine.setAttribute('x1', point.x - 20);
        hLine.setAttribute('y1', point.y);
        hLine.setAttribute('x2', point.x + 20);
        hLine.setAttribute('y2', point.y);
        hLine.setAttribute('stroke', 'blue');
        hLine.setAttribute('stroke-width', '3');
        hLine.setAttribute('opacity', '0.8');
        
        // Vertical line
        const vLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        vLine.setAttribute('x1', point.x);
        vLine.setAttribute('y1', point.y - 20);
        vLine.setAttribute('x2', point.x);
        vLine.setAttribute('y2', point.y + 20);
        vLine.setAttribute('stroke', 'blue');
        vLine.setAttribute('stroke-width', '3');
        vLine.setAttribute('opacity', '0.8');
        
        // Center circle
        const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        circle.setAttribute('cx', point.x);
        circle.setAttribute('cy', point.y);
        circle.setAttribute('r', '5');
        circle.setAttribute('fill', 'blue');
        circle.setAttribute('opacity', '0.8');
        
        // Add label showing tile key
        const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        text.setAttribute('x', point.x + 25);
        text.setAttribute('y', point.y - 25);
        text.setAttribute('fill', 'blue');
        text.setAttribute('font-size', '12');
        text.setAttribute('font-weight', 'bold');
        text.textContent = `${id} in ${tileKey}`;
        
        // Add elements to crosshair group
        crosshair.appendChild(hLine);
        crosshair.appendChild(vLine);
        crosshair.appendChild(circle);
        crosshair.appendChild(text);
        
        // Add to overlay container
        overlayContainer.appendChild(crosshair);
    }
    
    /**
     * Clear all debug crosshairs
     */
    clearDebugCrosshairs() {
        const overlayContainer = this.mapManager.overlayContainer;
        if (!overlayContainer) return;
        
        const crosshairs = overlayContainer.querySelectorAll('#forward-crosshair, #backward-crosshair');
        crosshairs.forEach(crosshair => crosshair.remove());
    }
    
    /**
     * Find roads at a specific point using the SAME logic as pin location detection
     */
    findRoadsAtPoint(point, tiles, currentRoadElement) {
        const SEARCH_RADIUS = 50; // meters - same as generateFlowingDescription
        const foundElements = [];
        
        console.log(`  Searching for roads within ${SEARCH_RADIUS}m of point (${point.x.toFixed(1)}, ${point.y.toFixed(1)})`);
        
        // Find which tile contains this road to get the proper coordinate conversion
        let currentTileKey = null;
        for (const [tileKey, tileGroup] of tiles) {
            if (tileGroup.contains(currentRoadElement.element)) {
                currentTileKey = tileKey;
                break;
            }
        }
        
        if (!currentTileKey) {
            console.log(`  Warning: Could not find tile containing the road element`);
            return [];
        }
        
        // Convert the point back to lat/lng
        const [currentTileLat, currentTileLng] = currentTileKey.split('_').map(parseFloat);
        const pointLat = currentTileLat + 0.01 - (point.y / 1000) * 0.01;
        const pointLng = currentTileLng + (point.x / 1000) * 0.01;
        
        console.log(`  Point lat/lng: ${pointLat.toFixed(6)}, ${pointLng.toFixed(6)}`);
        
        // Now use EXACT same code as generateFlowingDescription to find roads
        for (const [tileKey, tileGroup] of tiles) {
            const [tileLat, tileLng] = tileKey.split('_').map(parseFloat);
            
            // Convert point to SVG coordinates within this tile
            const svgX = ((pointLng - tileLng) / 0.01) * 1000;
            const svgY = ((tileLat + 0.01 - pointLat) / 0.01) * 1000;
            
            // Check if we're within this tile
            if (svgX >= 0 && svgX <= 1000 && svgY >= 0 && svgY <= 1000) {
                // Get all elements - same as generateFlowingDescription
                const allElements = tileGroup.querySelectorAll('path, polyline, polygon, g');
                
                allElements.forEach(element => {
                    try {
                        // Get element info - same as generateFlowingDescription
                        const tagName = element.tagName;
                        const classes = element.getAttribute('class') || element.getAttribute('class-') || '';
                        
                        // Only include actual road/path elements
                        const isRoad = classes.match(/\b(road|highway|street|footway|cycleway|path|pedestrian)\b/);
                        const isArtifact = classes.includes('casing') || classes.includes('outline') || classes.includes('border');
                        if (!isRoad || isArtifact) {
                            return;
                        }
                        
                        // Skip the current road element
                        if (element === currentRoadElement.element) return;
                        
                        const id = element.getAttribute('id') || '';
                        // Extract name from title element
                        const titleElement = element.querySelector('title');
                        let name = '';
                        if (titleElement && titleElement.textContent) {
                            const titleParts = titleElement.textContent.split(',');
                            name = titleParts[0].trim();
                        }
                        if (!name) {
                            name = element.getAttribute('data-name') || 
                                   element.getAttribute('name') || '';
                        }
                        
                        // Parse geometry
                        const geometry = this.geometryParser.parseElement(element);
                        if (geometry && geometry.points.length > 0) {
                            // Calculate distance
                            const centerPoint = { x: svgX, y: svgY };
                            let distance;
                            
                            if (geometry.type === 'polygon') {
                                distance = this.geometryCalculator.pointToPolygonDistance(centerPoint, geometry.points);
                            } else if (geometry.type === 'polyline') {
                                distance = this.geometryCalculator.pointToPolylineDistance(centerPoint, geometry.points);
                            } else {
                                distance = this.geometryCalculator.pointToPointDistance(centerPoint, geometry.points[0]);
                            }
                            
                            // Convert SVG units to meters
                            const distanceInMeters = distance * 1.11;
                            
                            if (distanceInMeters <= SEARCH_RADIUS) {
                                foundElements.push({
                                    tag: tagName,
                                    classes: classes,
                                    id: id,
                                    name: name,
                                    distance: distanceInMeters.toFixed(1),
                                    geometryType: geometry.type,
                                    pointCount: geometry.points.length,
                                    element: element,
                                    geometry: geometry
                                });
                            }
                        }
                    } catch (e) {
                        // Skip elements that cause errors
                    }
                });
            }
        }
        
        // Sort by distance
        foundElements.sort((a, b) => parseFloat(a.distance) - parseFloat(b.distance));
        
        // Filter for elements within 10m
        const nearestElements = foundElements.filter(el => parseFloat(el.distance) <= 10);
        
        // Separate into roads and paths
        const vehicleRoads = [];
        const pedestrianPaths = [];
        
        nearestElements.forEach(el => {
            const classes = el.classes.toLowerCase();
            
            // Check if it's a footpath/pedestrian way
            if (classes.includes('footway') || classes.includes('footpath') || 
                classes.includes('pedestrian') || classes.includes('steps') || 
                classes.includes('cycleway')) {
                pedestrianPaths.push(el);
            }
            // Check if it's a vehicle road
            else if (classes.includes('primary') || classes.includes('secondary') || 
                     classes.includes('tertiary') || classes.includes('residential') ||
                     classes.includes('road')) {
                vehicleRoads.push(el);
            }
        });
        
        // Log what we found
        console.log(`\nRoads within 10m:`);
        vehicleRoads.forEach(el => {
            console.log(`  [ROAD] ${el.name || 'unnamed'} - ${el.distance}m`);
        });
        
        console.log(`\nPaths within 10m:`);
        pedestrianPaths.forEach(el => {
            console.log(`  [PATH] ${el.name || 'unnamed'} - ${el.distance}m`);
        });
        
        // Get the base name of the current road (without directional suffixes)
        const currentRoadName = currentRoadElement.name || '';
        const currentBaseName = currentRoadName
            .replace(/\s+(North|South|East|West)$/i, '')
            .replace(/\s+(Street|Road|Avenue|Ave|St|Rd|Drive|Dr|Boulevard|Blvd)$/i, '')
            .trim();
        
        // Filter out segments of the same street
        const filteredRoads = [...vehicleRoads, ...pedestrianPaths].filter(el => {
            const roadBaseName = (el.name || '')
                .replace(/\s+(North|South|East|West)$/i, '')
                .replace(/\s+(Street|Road|Avenue|Ave|St|Rd|Drive|Dr|Boulevard|Blvd)$/i, '')
                .trim();
            
            // Keep the road if it has a different base name than the current road
            return roadBaseName !== currentBaseName || roadBaseName === '';
        });
        
        // Return filtered roads
        return filteredRoads.map(el => ({
            name: (el.name || 'unnamed').replace(/\s+(Street|Road|Avenue|Ave|St|Rd|Drive|Dr|Boulevard|Blvd)$/i, ''),
            distance: parseFloat(el.distance),
            element: el.element,
            isPath: el.classes.toLowerCase().includes('footway') || 
                    el.classes.toLowerCase().includes('footpath') ||
                    el.classes.toLowerCase().includes('pedestrian')
        }));
    }
    
    /**
     * [DEPRECATED] Find cross street in a specific direction along a polyline
     * This method is no longer used - replaced by findRoadsAtPoint
     */
    findCrossStreetInDirection(polyline, startIndex, endIndex, otherRoads, userPoint, reverse = false) {
        const step = reverse ? -1 : 1;
        let cumulativeDistance = 0;
        let previousPoint = polyline[startIndex];
        
        console.log(`\nSearching for cross streets ${reverse ? 'backward' : 'forward'} from segment index ${startIndex}`);
        console.log(`Total other roads to check: ${otherRoads.length}`);
        
        // Keep track of roads we find at each point
        const foundRoadsAtPoint = new Map();
        
        for (let i = startIndex; reverse ? i >= endIndex : i < endIndex; i += step) {
            const currentPoint = polyline[i];
            
            // Add distance from previous point
            if (i !== startIndex) {
                const segmentDistance = this.geometryCalculator.pointToPointDistance(previousPoint, currentPoint);
                cumulativeDistance += segmentDistance;
            }
            
            // Find all roads within 10m of this point (same as our intersection detection)
            const roadsAtPoint = [];
            for (const road of otherRoads) {
                if (road.geometry && road.geometry.type === 'polyline') {
                    const distance = this.geometryCalculator.pointToPolylineDistance(currentPoint, road.geometry.points);
                    const distanceInMeters = distance * 1.11;
                    
                    // Use same threshold as intersection detection (10m)
                    if (distanceInMeters < 10) {
                        roadsAtPoint.push({
                            road: road,
                            distance: distanceInMeters
                        });
                    }
                }
            }
            
            // Debug: Show what we found at this point
            if (roadsAtPoint.length > 0 || i === startIndex || 
                (reverse && i === 0) || (!reverse && i === polyline.length - 1)) {
                console.log(`Point ${i}: Found ${roadsAtPoint.length} roads within 10m`);
                roadsAtPoint.forEach(r => {
                    console.log(`  - ${r.road.name} at ${r.distance.toFixed(1)}m`);
                });
            }
            
            // If we found roads at this point, check for intersection
            if (roadsAtPoint.length > 0) {
                // Get unique road names
                const uniqueRoadNames = new Set(roadsAtPoint.map(r => r.road.name));
                
                console.log(`  Unique road names: ${Array.from(uniqueRoadNames).join(', ')}`);
                
                // If there's at least one road different from our current road
                if (uniqueRoadNames.size > 0) {
                    // Calculate actual distance from user to intersection
                    const userToIntersection = this.geometryCalculator.pointToPointDistance(userPoint, currentPoint);
                    const distanceInMeters = userToIntersection * 1.11; // Convert SVG units to meters
                    
                    // Get the closest/most prominent cross road
                    const closestRoad = roadsAtPoint.sort((a, b) => a.distance - b.distance)[0].road;
                    
                    // Clean the road name
                    const cleanName = closestRoad.name.replace(/\s+(Street|Road|Avenue|Ave|St|Rd|Drive|Dr|Boulevard|Blvd)$/i, '');
                    
                    console.log(`  Found intersection with ${cleanName} at ${Math.round(distanceInMeters)}m`);
                    
                    return {
                        name: cleanName,
                        distance: Math.round(distanceInMeters),
                        point: currentPoint
                    };
                }
            }
            
            previousPoint = currentPoint;
        }
        
        // No cross street found - it's a dead end
        const endPoint = polyline[reverse ? 0 : polyline.length - 1];
        const userToEnd = this.geometryCalculator.pointToPointDistance(userPoint, endPoint);
        const distanceInMeters = userToEnd * 1.11;
        
        console.log(`  No intersection found - dead end at ${Math.round(distanceInMeters)}m`);
        
        return {
            name: 'dead end',
            distance: Math.round(distanceInMeters),
            point: endPoint
        };
    }
    
    /**
     * Find all roads near a point across all tiles
     */
    findAllNearbyRoads(centerPoint, tiles, radiusMeters) {
        const foundRoads = [];
        const radiusSvg = radiusMeters / 1.11; // Convert meters to SVG units
        
        // Search all tiles
        for (const [tileKey, tileGroup] of tiles) {
            const [tileLat, tileLng] = tileKey.split('_').map(parseFloat);
            
            // Get all road elements in this tile
            const allElements = tileGroup.querySelectorAll('path, polyline, polygon');
            
            allElements.forEach(element => {
                const classes = element.getAttribute('class') || '';
                
                // Only include actual roads
                const isRoad = classes.match(/\b(road|highway|street)\b/) && 
                              !classes.match(/\b(footway|cycleway|pedestrian|steps)\b/);
                const isArtifact = classes.includes('casing') || classes.includes('outline');
                
                if (!isRoad || isArtifact) return;
                
                // Get name
                const titleElement = element.querySelector('title');
                let name = '';
                if (titleElement && titleElement.textContent) {
                    name = titleElement.textContent.split(',')[0].trim();
                }
                
                if (!name) return;
                
                // Parse geometry
                const geometry = this.geometryParser.parseElement(element);
                if (geometry && geometry.points.length > 0) {
                    foundRoads.push({
                        name: name,
                        element: element,
                        geometry: geometry,
                        classes: classes
                    });
                }
            });
        }
        
        return foundRoads;
    }
    
    /**
     * Get street side description using common parlance
     * For N-S streets: use "east" or "west" side
     * For E-W streets: use "north" or "south" side
     * For diagonal streets: use the primary cardinal direction
     */
    getStreetSideDescription(side, segmentBearing, streetDirection) {
        if (side === 'on') return 'middle';
        
        // Normalize bearing to 0-360
        const bearing = (segmentBearing + 360) % 360;
        
        // Determine if street is primarily N-S, E-W, or diagonal
        const isNorthSouth = (bearing >= 337.5 || bearing < 22.5) || (bearing >= 157.5 && bearing < 202.5);
        const isEastWest = (bearing >= 67.5 && bearing < 112.5) || (bearing >= 247.5 && bearing < 292.5);
        
        if (isNorthSouth) {
            // For north-south streets, use east/west
            if (side === 'left') {
                // If facing north, left is west; if facing south, left is east
                return (bearing < 90 || bearing > 270) ? 'west' : 'east';
            } else {
                return (bearing < 90 || bearing > 270) ? 'east' : 'west';
            }
        } else if (isEastWest) {
            // For east-west streets, use north/south
            if (side === 'left') {
                // If facing east (~90°), left is north; if facing west (~270°), left is south
                return (bearing >= 45 && bearing < 135) ? 'north' : 'south';
            } else {
                return (bearing >= 45 && bearing < 135) ? 'south' : 'north';
            }
        } else {
            // For diagonal streets, calculate the perpendicular angle and determine cardinal direction
            const perpendicularAngle = side === 'left' ? (bearing - 90 + 360) % 360 : (bearing + 90) % 360;
            
            // Convert to cardinal direction
            if (perpendicularAngle >= 315 || perpendicularAngle < 45) return 'north';
            else if (perpendicularAngle >= 45 && perpendicularAngle < 135) return 'east';
            else if (perpendicularAngle >= 135 && perpendicularAngle < 225) return 'south';
            else return 'west';
        }
    }
    
    /**
     * Describe parking areas
     */
    describeParking(parkingFeatures) {
        if (parkingFeatures.length === 0) return null;
        
        // Separate accessible and regular parking
        // Only count parking explicitly marked as accessible (wheelchair=yes)
        const accessibleParking = parkingFeatures.filter(p => 
            p.element && p.element.getAttribute('data-wheelchair') === 'yes'
        );
        
        const regularParking = parkingFeatures.filter(p => 
            !accessibleParking.includes(p)
        );
        
        const descriptions = [];
        
        // Always announce accessible parking
        if (accessibleParking.length > 0) {
            const names = accessibleParking.filter(p => p.name).map(p => p.name);
            if (names.length > 0) {
                descriptions.push(`Accessible parking available at ${this.joinWithAnd(names)}`);
            } else {
                descriptions.push(`${accessibleParking.length} accessible parking ${accessibleParking.length > 1 ? 'areas' : 'area'}`);
            }
        }
        
        // Group regular parking
        if (regularParking.length > 0) {
            const namedParking = regularParking.filter(p => p.name && p.name.length > 3);
            if (namedParking.length > 0) {
                const firstName = namedParking[0].name;
                const otherCount = regularParking.length - 1;
                if (otherCount > 0) {
                    descriptions.push(`${firstName} and ${otherCount} other parking ${otherCount > 1 ? 'areas' : 'area'}`);
                } else {
                    descriptions.push(firstName);
                }
            } else {
                descriptions.push(`${regularParking.length} parking ${regularParking.length > 1 ? 'areas' : 'area'}`);
            }
        }
        
        return descriptions.length > 0 ? descriptions.join('. ') : null;
    }
}