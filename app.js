// app.js — Cafe Finder using Leaflet + Overpass + Nominatim
const mapEl = document.getElementById('map');
const placesEl = document.getElementById('places');
const radiusInput = document.getElementById('radiusInput');
const addressInput = document.getElementById('addressInput');
const findBtn = document.getElementById('findBtn');
const locateBtn = document.getElementById('locateBtn');
const clearBtn = document.getElementById('clearBtn');

let map, userMarker; // leaflet objects
let markers = []; // store cafe markers
let cached = {}; // simple in-memory cache keyed by lat:lng:radius

function initMap(lat=19.0760, lon=72.8777, zoom=13){
  if (!map){
    map = L.map('map').setView([lat,lon], zoom);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© OpenStreetMap contributors'
    }).addTo(map);
  } else {
    map.setView([lat,lon], zoom);
  }

  if (userMarker) userMarker.remove();
  userMarker = L.marker([lat,lon], {title:'Center location'}).addTo(map);
  userMarker.bindPopup('Search center').openPopup();
}

function setStatus(text){
  placesEl.innerHTML = `<div class="meta">${text}</div>`;
}

function clearResults(){
  markers.forEach(m=>map.removeLayer(m));
  markers = [];
  placesEl.innerHTML = '';
}

function cacheKey(lat,lon,radius){
  const k = `${lat.toFixed(4)}:${lon.toFixed(4)}:${radius}`;
  return k;
}

function fetchCafes(lat, lon, radius=1500){
  const key = cacheKey(lat,lon,radius);
  if (cached[key]){
    renderPlaces(cached[key], lat, lon);
    return;
  }

  setStatus('Searching for cafes...');
  const q = `[out:json][timeout:25];(node["amenity"="cafe"](around:${radius},${lat},${lon});way["amenity"="cafe"](around:${radius},${lat},${lon});relation["amenity"="cafe"](around:${radius},${lat},${lon}););out center;`;
  const url = 'https://overpass-api.de/api/interpreter?data=' + encodeURIComponent(q);

  fetch(url).then(r=>{
    if (!r.ok) throw new Error('Overpass request failed: ' + r.status);
    return r.json();
  }).then(data=>{
    const elems = data.elements || [];
    cached[key] = elems; // cache
    renderPlaces(elems, lat, lon);
  }).catch(err=>{
    console.error(err);
    setStatus('Error fetching data. Try again later.');
  });
}

function renderPlaces(elems, lat, lon){
  clearResults();
  if (!elems || elems.length===0){
    setStatus('No cafes found in this area. Try increasing the radius.');
    return;
  }

  // sort by distance
  const center = {lat, lon};
  elems.forEach(el=>{
    const coords = el.type==='node' ? {lat: el.lat, lon: el.lon} : {lat: el.center.lat, lon: el.center.lon};
    el._coords = coords;
    el._dist = distanceMeters(center.lat, center.lon, coords.lat, coords.lon);
  });
  elems.sort((a,b)=>a._dist - b._dist);

  const fragment = document.createDocumentFragment();
  elems.forEach((el, idx)=>{
    const coords = el._coords;
    const name = (el.tags && el.tags.name) ? el.tags.name : 'Unnamed Cafe';
    const popupContent = `<strong>${escapeHtml(name)}</strong><br/>${el.tags && el.tags['addr:street'] ? escapeHtml(el.tags['addr:street']) + '<br/>' : ''}${Math.round(el._dist)} m away`;
    const m = L.marker([coords.lat, coords.lon]).addTo(map).bindPopup(popupContent);
    markers.push(m);

    const div = document.createElement('div');
    div.className = 'place';
    div.innerHTML = `<strong>${escapeHtml(name)}</strong><div class="meta">${Math.round(el._dist)} m — ${el.tags && el.tags['opening_hours'] ? escapeHtml(el.tags['opening_hours']) : ''}</div>`;
    div.onclick = ()=>{ map.panTo([coords.lat, coords.lon]); m.openPopup(); };
    fragment.appendChild(div);
  });
  placesEl.innerHTML = '';
  placesEl.appendChild(fragment);
}

// Utility: simple Haversine distance in meters
function distanceMeters(lat1, lon1, lat2, lon2){
  const R = 6371000;
  const toRad = d => d * Math.PI/180;
  const dLat = toRad(lat2-lat1);
  const dLon = toRad(lon2-lon1);
  const a = Math.sin(dLat/2)*Math.sin(dLat/2) + Math.cos(toRad(lat1))*Math.cos(toRad(lat2))*Math.sin(dLon/2)*Math.sin(dLon/2);
  const c = 2*Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R*c;
}

// Escape helper to avoid simple HTML injection in names
function escapeHtml(s){ if(!s) return ''; return s.replace(/[&<>'\"]/g, c=>({ '&':'&amp;','<':'&lt;','>':'&gt;','\'':'&#39;','"':'&quot;' }[c]||c)); }

// Nominatim geocoding (for manual address search)
function geocodeAddress(q){
  const url = 'https://nominatim.openstreetmap.org/search?format=json&q=' + encodeURIComponent(q) + '&limit=1';
  setStatus('Geocoding address...');
  fetch(url, { headers: { 'Accept': 'application/json' } }).then(r=>r.json()).then(results=>{
    if (!results || results.length===0) { setStatus('Address not found'); return; }
    const res = results[0];
    const lat = parseFloat(res.lat), lon = parseFloat(res.lon);
    initMap(lat, lon, 15);
    fetchCafes(lat, lon, Number(radiusInput.value || 1500));
  }).catch(err=>{ console.error(err); setStatus('Geocoding failed.'); });
}

// Event handlers
findBtn.addEventListener('click', ()=>{
  const q = addressInput.value.trim();
  if (!q) {
    setStatus('Type an address or use My Location.');
    return;
  }
  geocodeAddress(q);
});

locateBtn.addEventListener('click', ()=>{
  if (!navigator.geolocation){ setStatus('Geolocation not supported.'); return; }
  setStatus('Requesting location...');
  navigator.geolocation.getCurrentPosition(pos=>{
    const lat = pos.coords.latitude, lon = pos.coords.longitude;
    initMap(lat, lon, 15);
    fetchCafes(lat, lon, Number(radiusInput.value || 1500));
  }, err=>{
    console.warn(err);
    setStatus('Failed to get location. You can type an address instead.');
  }, { timeout:10000 });
});

clearBtn.addEventListener('click', ()=>{ clearResults(); setStatus('Results cleared.'); });

// Auto-run: attempt geolocation on load
window.addEventListener('load', ()=>{
  if (navigator.geolocation){
    navigator.geolocation.getCurrentPosition(pos=>{
      const lat = pos.coords.latitude, lon = pos.coords.longitude;
      initMap(lat, lon, 13);
      fetchCafes(lat, lon, Number(radiusInput.value || 1500));
    }, err=>{
      console.log('Geolocation denied or failed, init fallback');
      initMap();
      setStatus('Allow location or type an address and press Find.');
    }, { timeout:8000 });
  } else {
    initMap(); setStatus('Geolocation not supported. Type an address and press Find.');
  }
});
