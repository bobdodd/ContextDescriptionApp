# ContextDescriptionApp System Design Document

## Overview

ContextDescriptionApp is an accessible web application that provides detailed location descriptions for blind and low-vision users. It combines visual map display with comprehensive audio descriptions of surroundings, using OpenStreetMap data rendered as SVG tiles.

## Current Architecture

### Core Components

1. **Frontend Application** (`web-app/`)
   - Single Page Application using vanilla JavaScript ES6 modules
   - Responsive, mobile-first design
   - WCAG 2.1 AA compliant

2. **Tile Generation System** (`tile-generation/`)
   - Python scripts to process OpenStreetMap data
   - Generates SVG tiles with embedded accessibility metadata
   - Tile size: 0.01° x 0.01° (approximately 1km x 1km)
   - SVG coordinate system: 1000 x 1000 units per tile

3. **Map Data Storage**
   - Pre-generated SVG tiles stored as compressed files (.svg.gz)
   - Tile naming convention: `{latitude}_{longitude}.svg.gz`
   - Example: `43.650_-79.380.svg.gz`

### Key JavaScript Modules

1. **app.js**
   - Main application controller
   - Manages location updates and user interactions
   - Coordinates between services

2. **MapManager.js**
   - Handles map rendering and tile loading
   - Manages pan, zoom, and pin placement
   - Current tile alignment offset: lat -0.001725°, lng +0.001225°

3. **DescriptionGenerator.js**
   - Generates natural language descriptions
   - Currently simplified to show only location and nearest intersection
   - Distance zones: immediate (0-50m), near (50-100m), vicinity (100-200m), area (200-400m)

4. **LocationService.js**
   - Manages GPS/geolocation
   - Provides distance calculations
   - Handles location permissions

5. **CompassService.js**
   - Device orientation API wrapper
   - Provides heading information
   - Fallback to simulated compass

6. **TileLoader.js**
   - Loads and caches SVG tiles
   - Handles decompression
   - Manages tile lifecycle

7. **CleanUIController.js**
   - Manages UI updates
   - Handles accessibility announcements
   - Screen reader optimizations

### Data Flow

1. **Location Update**
   ```
   GPS/User Input → LocationService → App → MapManager → Update Pin Position
                                         ↓
                                    DescriptionGenerator → Natural Language Output
   ```

2. **Tile Loading**
   ```
   Location Change → Calculate Bounds → TileLoader → Fetch SVG → Parse Features
                                                                      ↓
                                                              Extract Metadata
   ```

3. **Description Generation**
   ```
   Current Location + Tile Features → Distance Calculation → Feature Categorization
                                                                 ↓
                                                         Street/Intersection Detection
                                                                 ↓
                                                         Natural Language Generation
   ```

## Current Issues

### 1. Distance Calculation Problems

**Issue**: All features are treated as points, using simple Euclidean distance:
```javascript
const distance = Math.sqrt(Math.pow(centerX - featureX, 2) + Math.pow(centerY - featureY, 2)) / 50;
```

**Problems**:
- Streets are polylines, not points
- Buildings are polygons, not points
- Cannot accurately determine if user is "on" a street or "in" a building
- Intersection detection is unreliable

### 2. Tile Alignment

**Issue**: Tiles have a coordinate offset that must be applied consistently
- Visual pin offset: lat -0.001725°, lng +0.001225°
- This offset must be applied when generating descriptions

### 3. Intersection Detection

**Current Method**:
- Looks for multiple street names in feature list
- Matches against hardcoded intersection list
- No geometric validation

**Problems**:
- Cannot detect actual intersection points
- May report incorrect intersections
- Distance to intersection is estimated

## Proposed Architecture Improvements

### 1. Geometry Processing System

#### SVG Geometry Parser
```javascript
class SVGGeometryParser {
  parsePathData(d) // Parse SVG path commands
  parsePolygon(points) // Parse polygon points
  parseRect(x, y, width, height) // Convert rect to polygon
  parseCircle(cx, cy, r) // Convert to polygon or handle specially
}
```

#### Geometric Calculators
```javascript
class GeometryCalculator {
  pointToLineSegmentDistance(point, lineStart, lineEnd)
  pointToPolylineDistance(point, polyline)
  pointInPolygon(point, polygon)
  pointToPolygonDistance(point, polygon)
  lineIntersection(line1Start, line1End, line2Start, line2End)
}
```

### 2. Enhanced Feature Model

```javascript
class Feature {
  id: string
  type: string // building, highway, park, etc.
  name: string
  geometryType: 'point' | 'polyline' | 'polygon'
  geometry: Point[] | Polyline | Polygon
  metadata: {
    wheelchair: 'yes' | 'no' | 'limited'
    tactilePaving: boolean
    entrances: Point[]
    // ... other accessibility data
  }
  boundingBox: BoundingBox
}
```

### 3. Spatial Indexing

Implement R-tree or Quadtree for efficient spatial queries:
```javascript
class SpatialIndex {
  insert(feature)
  remove(feature)
  search(bounds) // Returns features within bounds
  nearest(point, maxDistance) // Returns nearest features
}
```

### 4. Intersection Manager

```javascript
class IntersectionManager {
  intersections: Map<string, Intersection>
  
  detectIntersections(streets) // Find where streets cross
  getNearestIntersection(point)
  getIntersectionByStreets(street1, street2)
}

class Intersection {
  id: string
  location: Point
  streets: Street[]
  type: 'T-junction' | '4-way' | 'roundabout' | etc
  crosswalks: Crosswalk[]
}
```

### 5. Enhanced Description Generator

```javascript
class EnhancedDescriptionGenerator {
  // Spatial relationship detection
  isOnStreet(point, street, threshold = 5)
  isInBuilding(point, building)
  isAtIntersection(point, intersection, threshold = 10)
  
  // Direction-aware descriptions
  getStreetOrientation(heading, street)
  getRelativeDirection(from, to, heading)
  
  // Context-aware descriptions
  describeBuildingApproach(point, building)
  describeIntersectionApproach(point, intersection)
}
```

## Detailed Implementation Plan

### Phase 1: Geometry Foundation
1. Implement SVG geometry parser
2. Implement geometric distance calculators
3. Add geometry type detection to feature extraction
4. Update Feature model to include geometry

### Phase 2: Spatial Accuracy
1. Replace point-based distance calculations
2. Implement "on street" detection
3. Improve building proximity detection
4. Add spatial indexing for performance

### Phase 3: Intersection Detection
1. Implement line intersection algorithm
2. Pre-calculate intersections during tile loading
3. Store intersection metadata
4. Update description generator to use real intersections

### Phase 4: Enhanced Descriptions
1. Add building entrance detection
2. Implement approach descriptions
3. Add relative directions
4. Improve street orientation detection

### Phase 5: Performance & Polish
1. Optimize geometric calculations
2. Implement caching strategies
3. Add comprehensive testing
4. Handle edge cases

## Technical Decisions

### Why SVG Tiles?
- Vector format allows precise feature extraction
- Smaller file sizes than raster tiles
- Can embed metadata as attributes
- Scalable without quality loss

### Why Vanilla JavaScript?
- No framework dependencies
- Faster load times
- Better accessibility control
- Simpler deployment

### Coordinate System
- Tiles: 0.01° x 0.01° (lat/lng)
- SVG: 1000 x 1000 units per tile
- Conversion: 1 SVG unit ≈ 1 meter (approximate)

## Accessibility Considerations

### Audio Descriptions
- Progressive disclosure (distance-based rings)
- Clock-face directions for spatial orientation
- Landmark-based navigation
- Clear intersection announcements

### Visual Interface
- High contrast (4.5:1 minimum)
- Large touch targets
- Clear focus indicators
- Screen reader announcements

### Performance
- Preload nearby tiles
- Cache frequently accessed data
- Minimize description generation time
- Responsive to user movement

## Future Enhancements

1. **Multi-level Support**
   - Handle bridges and tunnels
   - Elevation data
   - Indoor navigation

2. **Routing**
   - Turn-by-turn navigation
   - Accessible route planning
   - Hazard warnings

3. **Real-time Data**
   - Construction updates
   - Temporary obstacles
   - Crowd-sourced accessibility info

4. **Personalization**
   - User preferences for description detail
   - Saved locations
   - Custom landmarks

## Testing Strategy

### Unit Tests
- Geometry calculations
- Distance algorithms
- Intersection detection
- Description generation

### Integration Tests
- Tile loading and parsing
- Location updates
- Full description pipeline

### Accessibility Tests
- Screen reader compatibility
- Keyboard navigation
- Touch accessibility
- Audio clarity

### Performance Tests
- Tile loading speed
- Description generation time
- Memory usage
- Battery impact

## Deployment

### Current Setup
- Python HTTP server for development
- Static file hosting for production
- Tile storage in `toronto-svg-tiles/`
- No backend required

### Production Considerations
- CDN for tile delivery
- Service worker for offline support
- Progressive Web App capabilities
- HTTPS required for geolocation

## Known Limitations

1. **Data Quality**
   - Depends on OpenStreetMap completeness
   - Accessibility data may be sparse
   - Building entrances often missing

2. **Technical**
   - GPS accuracy in urban canyons
   - Compass reliability on different devices
   - Battery usage with continuous updates

3. **Coverage**
   - Currently Toronto-focused
   - Tile generation needed for new areas
   - Storage requirements for large areas

## Conclusion

This system design document captures the current state of ContextDescriptionApp and outlines a comprehensive plan for improving its geometric accuracy and description quality. The phased approach allows for incremental improvements while maintaining system stability.