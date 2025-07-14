/**
 * GeometryCalculator - Performs geometric calculations for distance and spatial relationships
 */

export class GeometryCalculator {
    /**
     * Calculate the distance from a point to a line segment
     * @param {Object} point - {x, y}
     * @param {Object} lineStart - {x, y}
     * @param {Object} lineEnd - {x, y}
     * @returns {number} Distance in same units as input
     */
    pointToLineSegmentDistance(point, lineStart, lineEnd) {
        // Vector from lineStart to lineEnd
        const dx = lineEnd.x - lineStart.x;
        const dy = lineEnd.y - lineStart.y;
        
        // If line segment is actually a point
        if (dx === 0 && dy === 0) {
            return this.pointToPointDistance(point, lineStart);
        }
        
        // Calculate parameter t that represents position along the line segment
        // t = 0 at lineStart, t = 1 at lineEnd
        const t = Math.max(0, Math.min(1, 
            ((point.x - lineStart.x) * dx + (point.y - lineStart.y) * dy) / 
            (dx * dx + dy * dy)
        ));
        
        // Find the closest point on the line segment
        const closestPoint = {
            x: lineStart.x + t * dx,
            y: lineStart.y + t * dy
        };
        
        // Return distance from point to closest point on segment
        return this.pointToPointDistance(point, closestPoint);
    }
    
    /**
     * Calculate the distance between two points
     * @param {Object} p1 - {x, y}
     * @param {Object} p2 - {x, y}
     * @returns {number} Distance
     */
    pointToPointDistance(p1, p2) {
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        return Math.sqrt(dx * dx + dy * dy);
    }
    
    /**
     * Calculate the distance from a point to a polyline
     * @param {Object} point - {x, y}
     * @param {Array<Object>} polyline - Array of {x, y} points
     * @returns {number} Minimum distance to any segment of the polyline
     */
    pointToPolylineDistance(point, polyline) {
        if (polyline.length === 0) return Infinity;
        if (polyline.length === 1) return this.pointToPointDistance(point, polyline[0]);
        
        let minDistance = Infinity;
        
        // Check distance to each line segment
        for (let i = 0; i < polyline.length - 1; i++) {
            const distance = this.pointToLineSegmentDistance(
                point, 
                polyline[i], 
                polyline[i + 1]
            );
            minDistance = Math.min(minDistance, distance);
        }
        
        return minDistance;
    }
    
    /**
     * Test if a point is inside a polygon using ray casting algorithm
     * @param {Object} point - {x, y}
     * @param {Array<Object>} polygon - Array of {x, y} points forming a closed polygon
     * @returns {boolean} True if point is inside polygon
     */
    pointInPolygon(point, polygon) {
        if (polygon.length < 3) return false;
        
        let inside = false;
        const x = point.x;
        const y = point.y;
        
        // Ray casting algorithm
        for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
            const xi = polygon[i].x;
            const yi = polygon[i].y;
            const xj = polygon[j].x;
            const yj = polygon[j].y;
            
            const intersect = ((yi > y) !== (yj > y)) &&
                (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
                
            if (intersect) inside = !inside;
        }
        
        return inside;
    }
    
    /**
     * Calculate the distance from a point to a polygon
     * @param {Object} point - {x, y}
     * @param {Array<Object>} polygon - Array of {x, y} points forming a closed polygon
     * @returns {number} Distance (0 if inside, distance to nearest edge if outside)
     */
    pointToPolygonDistance(point, polygon) {
        // If point is inside polygon, distance is 0
        if (this.pointInPolygon(point, polygon)) {
            return 0;
        }
        
        // Otherwise, find distance to nearest edge
        return this.pointToPolylineDistance(point, polygon);
    }
    
    /**
     * Find intersection point of two line segments
     * @param {Object} line1Start - {x, y}
     * @param {Object} line1End - {x, y}
     * @param {Object} line2Start - {x, y}
     * @param {Object} line2End - {x, y}
     * @returns {Object|null} Intersection point {x, y} or null if no intersection
     */
    lineIntersection(line1Start, line1End, line2Start, line2End) {
        const x1 = line1Start.x;
        const y1 = line1Start.y;
        const x2 = line1End.x;
        const y2 = line1End.y;
        const x3 = line2Start.x;
        const y3 = line2Start.y;
        const x4 = line2End.x;
        const y4 = line2End.y;
        
        const denom = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
        
        // Lines are parallel
        if (Math.abs(denom) < 0.0001) return null;
        
        const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / denom;
        const u = -((x1 - x2) * (y1 - y3) - (y1 - y2) * (x1 - x3)) / denom;
        
        // Check if intersection point is within both line segments
        if (t >= 0 && t <= 1 && u >= 0 && u <= 1) {
            return {
                x: x1 + t * (x2 - x1),
                y: y1 + t * (y2 - y1)
            };
        }
        
        return null;
    }
    
    /**
     * Find all intersections between two polylines
     * @param {Array<Object>} polyline1 - Array of {x, y} points
     * @param {Array<Object>} polyline2 - Array of {x, y} points
     * @returns {Array<Object>} Array of intersection points
     */
    polylineIntersections(polyline1, polyline2) {
        const intersections = [];
        
        // Check each segment of polyline1 against each segment of polyline2
        for (let i = 0; i < polyline1.length - 1; i++) {
            for (let j = 0; j < polyline2.length - 1; j++) {
                const intersection = this.lineIntersection(
                    polyline1[i], polyline1[i + 1],
                    polyline2[j], polyline2[j + 1]
                );
                
                if (intersection) {
                    intersections.push(intersection);
                }
            }
        }
        
        return intersections;
    }
    
    /**
     * Calculate the bearing (direction) from one point to another
     * @param {Object} from - {x, y}
     * @param {Object} to - {x, y}
     * @returns {number} Bearing in degrees (0-360, where 0 is north)
     */
    bearing(from, to) {
        const dx = to.x - from.x;
        const dy = from.y - to.y; // Inverted because SVG Y increases downward
        
        let angle = Math.atan2(dx, dy) * 180 / Math.PI;
        return (angle + 360) % 360;
    }
    
    /**
     * Get the general direction of a polyline at a specific point
     * @param {Object} point - {x, y}
     * @param {Array<Object>} polyline - Array of {x, y} points
     * @returns {number|null} Direction in degrees at the closest point, or null
     */
    polylineDirectionAtPoint(point, polyline) {
        if (polyline.length < 2) return null;
        
        // Find the closest segment
        let minDistance = Infinity;
        let closestSegmentIndex = 0;
        
        for (let i = 0; i < polyline.length - 1; i++) {
            const distance = this.pointToLineSegmentDistance(
                point, 
                polyline[i], 
                polyline[i + 1]
            );
            
            if (distance < minDistance) {
                minDistance = distance;
                closestSegmentIndex = i;
            }
        }
        
        // Calculate bearing of the closest segment
        return this.bearing(
            polyline[closestSegmentIndex], 
            polyline[closestSegmentIndex + 1]
        );
    }
    
    /**
     * Calculate the bounding box of a set of points
     * @param {Array<Object>} points - Array of {x, y} points
     * @returns {Object} {minX, minY, maxX, maxY}
     */
    getBoundingBox(points) {
        if (points.length === 0) {
            return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
        }
        
        let minX = points[0].x;
        let maxX = points[0].x;
        let minY = points[0].y;
        let maxY = points[0].y;
        
        for (const point of points) {
            minX = Math.min(minX, point.x);
            maxX = Math.max(maxX, point.x);
            minY = Math.min(minY, point.y);
            maxY = Math.max(maxY, point.y);
        }
        
        return { minX, minY, maxX, maxY };
    }
    
    /**
     * Check if a point is within a threshold distance of a polyline
     * @param {Object} point - {x, y}
     * @param {Array<Object>} polyline - Array of {x, y} points
     * @param {number} threshold - Distance threshold
     * @returns {boolean} True if within threshold distance
     */
    isNearPolyline(point, polyline, threshold) {
        return this.pointToPolylineDistance(point, polyline) <= threshold;
    }
    
    /**
     * Check if a point is within a threshold distance of a polygon edge
     * (but not inside the polygon)
     * @param {Object} point - {x, y}
     * @param {Array<Object>} polygon - Array of {x, y} points
     * @param {number} threshold - Distance threshold
     * @returns {boolean} True if near edge but not inside
     */
    isNearPolygonEdge(point, polygon, threshold) {
        // If inside polygon, not "near edge"
        if (this.pointInPolygon(point, polygon)) {
            return false;
        }
        
        return this.pointToPolygonDistance(point, polygon) <= threshold;
    }
}