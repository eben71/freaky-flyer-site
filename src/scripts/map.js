const initMap = async () => {
  const mapContainer = document.querySelector('#map');
  if (!mapContainer) return;

  const L = window.L;
  if (!L) {
    console.error('Leaflet was not loaded.');
    return;
  }

  const map = L.map(mapContainer).setView([-31.95, 115.86], 12);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 19
  }).addTo(map);

  let trackLayer;
  const defaultTrack = mapContainer.dataset.defaultTrack ?? '/assets/maps/sample.geojson';

  const lineWidthControl = document.querySelector('#line-width');
  const toggleControl = document.querySelector('#toggle-track');
  const fitButton = document.querySelector('#fit-track');
  const fileInput = document.querySelector('#track-file');
  const dropZone = document.querySelector('.map-upload');

  const renderTrack = (geojson) => {
    if (!geojson) return;
    if (trackLayer) {
      trackLayer.remove();
    }
    trackLayer = L.geoJSON(geojson, {
      style: () => ({
        color: '#1e88e5',
        weight: Number(lineWidthControl?.value || 4),
        opacity: 0.85
      })
    }).addTo(map);
    fitToTrack();
  };

  const fitToTrack = () => {
    if (trackLayer) {
      const bounds = trackLayer.getBounds();
      if (bounds.isValid()) {
        map.fitBounds(bounds, { padding: [20, 20] });
      }
    }
  };

  const loadDefault = async () => {
    try {
      const response = await fetch(defaultTrack);
      if (!response.ok) throw new Error('Unable to load default route');
      const data = await response.json();
      renderTrack(data);
    } catch (error) {
      console.error(error);
    }
  };

  const loadToGeoJSON = () => {
    if (window.toGeoJSON) {
      return Promise.resolve(window.toGeoJSON);
    }
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/@tmcw/togeojson@5.4.0/dist/togeojson.umd.js';
      script.async = true;
      script.onload = () => resolve(window.toGeoJSON);
      script.onerror = () => reject(new Error('Failed to load togeojson converter'));
      document.head.appendChild(script);
    });
  };

  const parseFile = async (file) => {
    const extension = file.name.split('.').pop()?.toLowerCase();
    const text = await file.text();

    if (extension === 'geojson' || extension === 'json') {
      return JSON.parse(text);
    }

    if (extension === 'gpx' || extension === 'kml') {
      const parser = new DOMParser();
      const xml = parser.parseFromString(text, 'text/xml');
      const converter = await loadToGeoJSON();
      if (extension === 'gpx') {
        return converter.gpx(xml);
      }
      return converter.kml(xml);
    }

    throw new Error('Unsupported file type');
  };

  const handleFileSelection = async (file) => {
    try {
      const geojson = await parseFile(file);
      renderTrack(geojson);
      if (toggleControl) {
        toggleControl.checked = true;
        toggleControl.dispatchEvent(new Event('change'));
      }
    } catch (error) {
      alert('Could not load the supplied file. Please ensure it is valid GeoJSON, GPX or KML.');
      console.error(error);
    }
  };

  if (lineWidthControl) {
    lineWidthControl.addEventListener('input', () => {
      if (trackLayer) {
        trackLayer.setStyle({ weight: Number(lineWidthControl.value || 4) });
      }
    });
  }

  if (toggleControl) {
    toggleControl.addEventListener('change', () => {
      if (!trackLayer) return;
      if (toggleControl.checked) {
        trackLayer.addTo(map);
      } else {
        trackLayer.remove();
      }
    });
  }

  if (fitButton) {
    fitButton.addEventListener('click', fitToTrack);
  }

  if (fileInput) {
    fileInput.addEventListener('change', () => {
      const [file] = fileInput.files || [];
      if (file) {
        handleFileSelection(file);
        fileInput.value = '';
      }
    });
  }

  if (dropZone) {
    ['dragenter', 'dragover'].forEach((eventName) => {
      dropZone.addEventListener(eventName, (event) => {
        event.preventDefault();
        event.stopPropagation();
        dropZone.classList.add('dragover');
      });
    });

    ['dragleave', 'drop'].forEach((eventName) => {
      dropZone.addEventListener(eventName, (event) => {
        event.preventDefault();
        event.stopPropagation();
        dropZone.classList.remove('dragover');
      });
    });

    dropZone.addEventListener('drop', (event) => {
      const file = event.dataTransfer?.files?.[0];
      if (file) {
        handleFileSelection(file);
      }
    });
  }

  await loadDefault();
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initMap);
} else {
  initMap();
}
