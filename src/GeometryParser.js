/**
 * GeometryParser - Parses SVG elements into coordinate arrays for geometric calculations
 */

export class GeometryParser {
    /**
     * Parse an SVG path's d attribute into an array of points
     * @param {string} d - The path data string
     * @returns {Array<{x: number, y: number}>} Array of points
     */
    parsePathData(d) {
        if (!d) return [];
        
        const points = [];
        const commands = this.parsePathCommands(d);
        let currentX = 0;
        let currentY = 0;
        let pathStartX = 0;
        let pathStartY = 0;
        
        for (const cmd of commands) {
            switch (cmd.type) {
                case 'M': // Move to absolute
                    currentX = cmd.x;
                    currentY = cmd.y;
                    pathStartX = currentX;
                    pathStartY = currentY;
                    points.push({ x: currentX, y: currentY });
                    break;
                    
                case 'm': // Move to relative
                    currentX += cmd.x;
                    currentY += cmd.y;
                    pathStartX = currentX;
                    pathStartY = currentY;
                    points.push({ x: currentX, y: currentY });
                    break;
                    
                case 'L': // Line to absolute
                    currentX = cmd.x;
                    currentY = cmd.y;
                    points.push({ x: currentX, y: currentY });
                    break;
                    
                case 'l': // Line to relative
                    currentX += cmd.x;
                    currentY += cmd.y;
                    points.push({ x: currentX, y: currentY });
                    break;
                    
                case 'H': // Horizontal line absolute
                    currentX = cmd.x;
                    points.push({ x: currentX, y: currentY });
                    break;
                    
                case 'h': // Horizontal line relative
                    currentX += cmd.x;
                    points.push({ x: currentX, y: currentY });
                    break;
                    
                case 'V': // Vertical line absolute
                    currentY = cmd.y;
                    points.push({ x: currentX, y: currentY });
                    break;
                    
                case 'v': // Vertical line relative
                    currentY += cmd.y;
                    points.push({ x: currentX, y: currentY });
                    break;
                    
                case 'Z': // Close path
                case 'z':
                    currentX = pathStartX;
                    currentY = pathStartY;
                    points.push({ x: currentX, y: currentY });
                    break;
                    
                // For now, approximate curves as straight lines to their endpoints
                case 'C': // Cubic bezier absolute
                    currentX = cmd.x;
                    currentY = cmd.y;
                    points.push({ x: currentX, y: currentY });
                    break;
                    
                case 'c': // Cubic bezier relative
                    currentX += cmd.x;
                    currentY += cmd.y;
                    points.push({ x: currentX, y: currentY });
                    break;
                    
                case 'S': // Smooth cubic bezier absolute
                case 'Q': // Quadratic bezier absolute
                case 'T': // Smooth quadratic bezier absolute
                    currentX = cmd.x;
                    currentY = cmd.y;
                    points.push({ x: currentX, y: currentY });
                    break;
                    
                case 's': // Smooth cubic bezier relative
                case 'q': // Quadratic bezier relative
                case 't': // Smooth quadratic bezier relative
                    currentX += cmd.x;
                    currentY += cmd.y;
                    points.push({ x: currentX, y: currentY });
                    break;
                    
                case 'A': // Arc absolute
                    currentX = cmd.x;
                    currentY = cmd.y;
                    points.push({ x: currentX, y: currentY });
                    break;
                    
                case 'a': // Arc relative
                    currentX += cmd.x;
                    currentY += cmd.y;
                    points.push({ x: currentX, y: currentY });
                    break;
            }
        }
        
        return points;
    }
    
    /**
     * Parse path commands from d attribute string
     * @param {string} d - The path data string
     * @returns {Array} Array of command objects
     */
    parsePathCommands(d) {
        const commands = [];
        const regex = /([MmLlHhVvCcSsQqTtAaZz])([^MmLlHhVvCcSsQqTtAaZz]*)/g;
        let match;
        
        while ((match = regex.exec(d)) !== null) {
            const type = match[1];
            const args = match[2].trim().split(/[\s,]+/).filter(a => a.length > 0).map(parseFloat);
            
            switch (type) {
                case 'M':
                case 'm':
                case 'L':
                case 'l':
                    for (let i = 0; i < args.length; i += 2) {
                        commands.push({ type, x: args[i], y: args[i + 1] });
                    }
                    break;
                    
                case 'H':
                case 'h':
                case 'V':
                case 'v':
                    for (let i = 0; i < args.length; i++) {
                        commands.push({ type, [type.toLowerCase() === 'h' ? 'x' : 'y']: args[i] });
                    }
                    break;
                    
                case 'C':
                case 'c':
                    for (let i = 0; i < args.length; i += 6) {
                        commands.push({ type, x: args[i + 4], y: args[i + 5] });
                    }
                    break;
                    
                case 'S':
                case 's':
                case 'Q':
                case 'q':
                    for (let i = 0; i < args.length; i += 4) {
                        commands.push({ type, x: args[i + 2], y: args[i + 3] });
                    }
                    break;
                    
                case 'T':
                case 't':
                    for (let i = 0; i < args.length; i += 2) {
                        commands.push({ type, x: args[i], y: args[i + 1] });
                    }
                    break;
                    
                case 'A':
                case 'a':
                    for (let i = 0; i < args.length; i += 7) {
                        commands.push({ type, x: args[i + 5], y: args[i + 6] });
                    }
                    break;
                    
                case 'Z':
                case 'z':
                    commands.push({ type });
                    break;
            }
        }
        
        return commands;
    }
    
    /**
     * Parse a polygon element's points attribute
     * @param {string} points - The points attribute value
     * @returns {Array<{x: number, y: number}>} Array of points
     */
    parsePolygon(points) {
        if (!points) return [];
        
        const coords = points.trim().split(/[\s,]+/).map(parseFloat);
        const result = [];
        
        for (let i = 0; i < coords.length; i += 2) {
            result.push({ x: coords[i], y: coords[i + 1] });
        }
        
        return result;
    }
    
    /**
     * Convert a rect to polygon points
     * @param {number} x
     * @param {number} y
     * @param {number} width
     * @param {number} height
     * @returns {Array<{x: number, y: number}>} Array of points
     */
    parseRect(x, y, width, height) {
        return [
            { x: x, y: y },
            { x: x + width, y: y },
            { x: x + width, y: y + height },
            { x: x, y: y + height },
            { x: x, y: y } // Close the polygon
        ];
    }
    
    /**
     * Convert a circle to polygon points (36-sided polygon)
     * @param {number} cx - Center x
     * @param {number} cy - Center y
     * @param {number} r - Radius
     * @returns {Array<{x: number, y: number}>} Array of points
     */
    parseCircle(cx, cy, r) {
        const points = [];
        const segments = 36; // 10-degree increments
        
        for (let i = 0; i <= segments; i++) {
            const angle = (i * 2 * Math.PI) / segments;
            points.push({
                x: cx + r * Math.cos(angle),
                y: cy + r * Math.sin(angle)
            });
        }
        
        return points;
    }
    
    /**
     * Parse any SVG element into points
     * @param {SVGElement} element
     * @returns {{type: string, points: Array<{x: number, y: number}>}}
     */
    parseElement(element) {
        const tagName = element.tagName.toLowerCase();
        
        switch (tagName) {
            case 'path':
                const d = element.getAttribute('d');
                const points = this.parsePathData(d);
                // Determine if it's a closed path (polygon) or open (polyline)
                const isClosed = d && (d.includes('Z') || d.includes('z'));
                return { type: isClosed ? 'polygon' : 'polyline', points };
                
            case 'polygon':
                return { 
                    type: 'polygon', 
                    points: this.parsePolygon(element.getAttribute('points')) 
                };
                
            case 'polyline':
                return { 
                    type: 'polyline', 
                    points: this.parsePolygon(element.getAttribute('points')) 
                };
                
            case 'rect':
                return { 
                    type: 'polygon', 
                    points: this.parseRect(
                        parseFloat(element.getAttribute('x') || 0),
                        parseFloat(element.getAttribute('y') || 0),
                        parseFloat(element.getAttribute('width') || 0),
                        parseFloat(element.getAttribute('height') || 0)
                    )
                };
                
            case 'circle':
                return { 
                    type: 'polygon', 
                    points: this.parseCircle(
                        parseFloat(element.getAttribute('cx') || 0),
                        parseFloat(element.getAttribute('cy') || 0),
                        parseFloat(element.getAttribute('r') || 0)
                    )
                };
                
            default:
                // For other elements, try to get a transform position
                const transform = element.getAttribute('transform');
                if (transform) {
                    const match = transform.match(/translate\(([^,]+),([^)]+)\)/);
                    if (match) {
                        return { 
                            type: 'point', 
                            points: [{ x: parseFloat(match[1]), y: parseFloat(match[2]) }] 
                        };
                    }
                }
                return { type: 'unknown', points: [] };
        }
    }
    
    /**
     * Check if a path is closed (forms a polygon)
     * @param {Array<{x: number, y: number}>} points
     * @returns {boolean}
     */
    isClosedPath(points) {
        if (points.length < 3) return false;
        
        const first = points[0];
        const last = points[points.length - 1];
        const tolerance = 0.001;
        
        return Math.abs(first.x - last.x) < tolerance && 
               Math.abs(first.y - last.y) < tolerance;
    }
}