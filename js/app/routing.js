// js/app/routing.js
import { map } from "../map/map.js";

let routeLayer = null;

function clearRouteLayer() {
  if (routeLayer) {
    try { map.removeLayer(routeLayer); } catch {}
    routeLayer = null;
  }
}

export async function drawRoute(userLoc, place, mode = "walking", infoEl = null) {

  if (!userLoc || !place?.ubicacion) return;

  clearRouteLayer();

  const dest = [
    place.ubicacion.latitude,
    place.ubicacion.longitude
  ];

  const profileMap = {
    walking: "foot",
    bicycle: "bike",
    motorcycle: "car",
    driving: "car"
  };

  const profile = profileMap[mode] || "foot";

  const url =
    `https://router.project-osrm.org/route/v1/${profile}/` +
    `${userLoc[1]},${userLoc[0]};${dest[1]},${dest[0]}` +
    `?overview=full&geometries=geojson`;

  try {

    const res = await fetch(url);
    const data = await res.json();

    if (!data.routes?.length) return;

    const route = data.routes[0];

    const coords = route.geometry.coordinates.map(c => [c[1], c[0]]);

    routeLayer = L.polyline(coords, {
      color: "#007bff",
      weight: 5,
      opacity: 0.9
    }).addTo(map);

    map.fitBounds(routeLayer.getBounds(), { padding: [30, 30] });

    if (infoEl) {

      const km = (route.distance / 1000).toFixed(2);
      const min = Math.round(route.duration / 60);

      infoEl.innerHTML = `
        <div class="alert alert-info py-2 mb-0">
          Distancia: <b>${km} km</b><br>
          Tiempo estimado: <b>${min} min</b>
        </div>
      `;
    }

  } catch (err) {
    console.error("Error OSRM:", err);
  }
}

export function clearRoute() {
  clearRouteLayer();
}