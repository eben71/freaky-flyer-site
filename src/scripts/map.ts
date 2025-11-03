const container = document.getElementById('coverage-map');

if (container) {
  const loadData = async () => {
    try {
      const response = await fetch('/assets/data/coverage.json', {
        cache: 'no-store',
      });
      if (!response.ok) {
        return;
      }
      const data = await response.json();
      // TODO: Initialise Leaflet map with polygons from `data` and add a legend with coverage filters.
      console.debug('Coverage data ready', data);
    } catch (error) {
      console.warn('Coverage data unavailable', error);
    }
  };

  loadData();
}
