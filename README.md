# ContextDescriptionApp

An accessible web application that provides detailed location descriptions for blind and low-vision users, combining visual map display with comprehensive audio descriptions of surroundings.

## Features

- **Location Awareness**: Automatically detects and describes your current location
- **Directional Information**: Provides clock-face directions relative to your facing direction
- **Distance-Based Descriptions**: Prioritizes nearby features within a 400m radius
- **Accessibility First**: Full screen reader support and voice announcements
- **Interactive Map**: Visual map display with draggable location pin
- **Test Mode**: Default location at Yonge & Front Streets, Toronto for testing

## Key Capabilities

- Describes landmarks, transit stops, amenities, and accessibility features
- Provides spatial relationships using clock positions (12 o'clock = straight ahead)
- Voice announcements for location updates
- Clean, mobile-friendly interface
- Works with or without device compass

## Getting Started

1. Clone the repository
2. Run the Python server:
   ```bash
   python3 server.py
   ```
3. Open http://localhost:8000 in your browser
4. Allow location and orientation permissions when prompted

## Usage

- **Update Button**: Refresh your current location
- **Speak Button**: Hear full description of your surroundings
- **Shift+Click on map**: Move location pin
- **Shift+Drag pin**: Relocate to explore different areas
- **Menu**: Access settings, toggle between GPS and test mode

## Technologies

- Vanilla JavaScript ES6 modules
- OpenStreetMap data rendered as SVG tiles
- Web Speech API for text-to-speech
- Geolocation and Device Orientation APIs
- Python simple HTTP server for tile serving

## Accessibility

- WCAG 2.1 AA compliant
- High contrast UI with 4.5:1 minimum ratios
- Semantic HTML with ARIA labels
- Keyboard navigable interface
- Screen reader optimized

## Browser Support

- Chrome/Edge (recommended)
- Firefox
- Safari (limited compass support)
- Mobile browsers with GPS/compass

## License

MIT License - see LICENSE file for details
EOF < /dev/null