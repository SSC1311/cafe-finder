Cafe Finder — Leaflet + Overpass Starter

Files:
- index.html
- styles.css
- app.js

How to run:
1. Save the folder somewhere local.
2. Serve it with a static server (recommended):
   - npx serve .   (or)
   - npx http-server -c-1
3. Open the page in your browser and allow location access, or type an address and press Find.

Notes:
- Uses Overpass API (OpenStreetMap) for cafe data and Nominatim for geocoding.
- For production use, respect rate limits and consider hosting your own services or using a paid Places API.
