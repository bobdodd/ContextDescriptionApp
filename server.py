#!/usr/bin/env python3
"""
Simple HTTP server for the Context Description App
Serves static files and proxies tile requests
"""

import http.server
import socketserver
import os
import sys
import urllib.parse
import gzip
from pathlib import Path

PORT = 8000
TILE_DIR = "../tile-generation/toronto-svg-tiles/tiles"

class CustomHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    """Custom handler to serve tiles and enable CORS"""
    
    def end_headers(self):
        """Add CORS headers to all responses"""
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        super().end_headers()
    
    def do_OPTIONS(self):
        """Handle preflight requests"""
        self.send_response(200)
        self.end_headers()
    
    def do_GET(self):
        """Handle GET requests with special handling for tiles"""
        parsed_path = urllib.parse.urlparse(self.path)
        
        # Handle tile requests
        if parsed_path.path.startswith('/maps/tiles/'):
            self.serve_tile(parsed_path.path)
        else:
            # Default file serving
            super().do_GET()
    
    def serve_tile(self, path):
        """Serve tile files with proper gzip handling"""
        # Extract tile filename
        tile_path = path.replace('/maps/tiles/', '')
        
        # Construct full path to tile
        full_path = os.path.join(TILE_DIR, tile_path)
        
        # Check if file exists
        if not os.path.exists(full_path):
            self.send_error(404, f"Tile not found: {tile_path}")
            return
        
        try:
            # Read the gzipped file
            with open(full_path, 'rb') as f:
                content = f.read()
            
            # Send response
            self.send_response(200)
            self.send_header('Content-Type', 'image/svg+xml')
            self.send_header('Content-Encoding', 'gzip')
            self.send_header('Content-Length', str(len(content)))
            self.send_header('Cache-Control', 'public, max-age=3600')
            self.end_headers()
            
            # Write content
            self.wfile.write(content)
            
        except Exception as e:
            self.send_error(500, f"Error serving tile: {str(e)}")
    
    def log_message(self, format, *args):
        """Custom log format"""
        sys.stderr.write(f"[{self.log_date_time_string()}] {format % args}\n")

def main():
    """Start the server"""
    # Change to app directory
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    
    # Check if tile directory exists
    tile_path = Path(TILE_DIR)
    if not tile_path.exists():
        print(f"Warning: Tile directory not found at {tile_path.absolute()}")
        print("Tiles will not be available until the directory is configured correctly.")
    else:
        print(f"Serving tiles from: {tile_path.absolute()}")
    
    # Create and start server
    with socketserver.TCPServer(("", PORT), CustomHTTPRequestHandler) as httpd:
        print(f"Server running at http://localhost:{PORT}/")
        print("Press Ctrl+C to stop the server")
        
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nShutting down server...")
            httpd.shutdown()

if __name__ == "__main__":
    main()