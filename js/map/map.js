// js/map/map.js
import { formatDurationFromSeconds } from "../app/helpers.js";
import { fetchOsrmRoute } from "../services/api.js";

export const map = L.map("map").setView([-2.309948, -78.124482], 13);

// ===== Base layers =====
export const baseLayers = {
  "OSM (Standard)": L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "© OpenStreetMap"
  }),
  "OpenTopoMap": L.tileLayer("https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png", {
    attribution: "© OpenTopoMap (CC-BY-SA) / © OpenStreetMap"
  })
};

baseLayers["OSM (Standard)"].addTo(map);

// ===== Overlays principales =====
export const markersLayer = L.layerGroup().addTo(map);
export const routeOverlay = L.layerGroup().addTo(map);
export const transportOverlay = L.layerGroup().addTo(map);
export const interprovOverlay = L.layerGroup().addTo(map);
export const barriosOverlay = L.layerGroup();
export const parroquiasOverlay = L.layerGroup();

/**
 * Limpia clear interprov para dejar la vista o el estado listo para otro flujo.
 */
export function clearInterprov() {
  try { interprovOverlay.clearLayers(); } catch {}
}

export function clearTerritorialLayer() {
  try {
    barriosOverlay.clearLayers();
    map.removeLayer(barriosOverlay);
  } catch {}
  try {
    parroquiasOverlay.clearLayers();
    map.removeLayer(parroquiasOverlay);
  } catch {}
}

function getTerritorialOverlay(type) {
  return type === "parroquias" ? parroquiasOverlay : barriosOverlay;
}

let routeLine = null;
let routeLines = [];
let markerSelected = null;
let renderedPlaceMarkers = [];
let routeRenderVersion = 0;

let transportLines = [];

/* ================= POPUP HELPERS ================= */
function escapePopupText(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function buildPopupHTML(p) {
  if (!p) return `<div class="tm-place-popup"><b>Lugar</b></div>`;
  if (p.popupHTML && String(p.popupHTML).trim()) return String(p.popupHTML);

  const nombre = escapePopupText(p.nombre || "Lugar");
  const ciudad = escapePopupText(p.ciudad || p.canton || "");
  const categoria = escapePopupText(p.subcategoria || "");
  const tel = escapePopupText(p.telefono || "No disponible");
  const horario = escapePopupText(p.horario || "No disponible");
  const telMissing = !String(p.telefono || "").trim();
  const horarioMissing = !String(p.horario || "").trim();
  const emoji = escapePopupText(markerEmoji(p));

  return `
    <article class="tm-place-popup">
      <header class="tm-place-popup__header">
        <span class="tm-place-popup__emoji" aria-hidden="true">${emoji}</span>
        <span class="tm-place-popup__heading">
          <strong>${nombre}</strong>
          ${categoria ? `<small>${categoria}</small>` : ""}
        </span>
      </header>
      <div class="tm-place-popup__details">
        ${ciudad ? `
          <div class="tm-place-popup__row">
            <span class="tm-place-popup__icon" aria-hidden="true">📍</span>
            <span><small>Ciudad</small><b>${ciudad}</b></span>
          </div>` : ""}
        <div class="tm-place-popup__row${telMissing ? " is-missing" : ""}">
          <span class="tm-place-popup__icon" aria-hidden="true">📞</span>
          <span><small>Teléfono</small><b>${tel}</b></span>
        </div>
        <div class="tm-place-popup__row${horarioMissing ? " is-missing" : ""}">
          <span class="tm-place-popup__icon" aria-hidden="true">🕒</span>
          <span><small>Horario</small><b>${horario}</b></span>
        </div>
      </div>
    </article>
  `;
}
/**
 * Dibuja o resalta draw fallback polyline sobre el mapa o la interfaz.
 */
function drawFallbackPolyline(points, {
  color = "#ff9800",
  weight = 4,
  dashed = true,
  target = routeOverlay,
  popupText = `
    <b>Ruta aproximada</b><br>
    OSRM no respondió correctamente o tardó demasiado.<br>
    Se muestra una línea recta referencial.
  `
} = {}) {
  const line = L.polyline(points, {
    color,
    weight,
    opacity: 0.85,
    dashArray: dashed ? "8,10" : null
  }).addTo(target);

  if (popupText) {
    line.bindPopup(popupText);
  }

  return line;
}
/* ================= LIMPIEZA ================= */
export function clearMarkers() {
  markersLayer.clearLayers();
  renderedPlaceMarkers = [];
}

/**
 * Limpia clear route para dejar la vista o el estado listo para otro flujo.
 */
export function clearRoute() {
  // Invalida consultas OSRM pendientes para impedir que una respuesta antigua
  // vuelva a dibujar una ruta después de limpiar el mapa.
  routeRenderVersion += 1;
  if (routeLine) {
    try { routeOverlay.removeLayer(routeLine); } catch {}
    routeLine = null;
  }
  if (routeLines.length) {
    routeLines.forEach(l => {
      try { routeOverlay.removeLayer(l); } catch {}
    });
    routeLines = [];
  }
  if (markerSelected) {
    try { routeOverlay.removeLayer(markerSelected); } catch {}
    markerSelected = null;
  }
  try { routeOverlay.clearLayers(); } catch {}
}

/**
 * Limpia clear transport route para dejar la vista o el estado listo para otro flujo.
 */
export function clearTransportRoute() {
  if (transportLines.length) {
    transportLines.forEach(l => {
      try { transportOverlay.removeLayer(l); } catch {}
    });
    transportLines = [];
  }
  try { transportOverlay.clearLayers(); } catch {}
}

/* ================= MARKERS ================= */
function markerEmoji(place) {
  const emoji = String(place?.markerEmoji || place?.emoji || place?.icono || "📍").trim();
  return emoji || "📍";
}

function emojiMarkerIcon(emoji, state = "default") {
  const dimensions = {
    default: { size: 34, anchorX: 17, anchorY: 30, popupY: -28 },
    muted: { size: 25, anchorX: 13, anchorY: 22, popupY: -20 },
    selected: { size: 46, anchorX: 23, anchorY: 41, popupY: -39 }
  }[state] || { size: 34, anchorX: 17, anchorY: 30, popupY: -28 };

  return L.divIcon({
    className: `tm-emoji-marker tm-emoji-marker--${state}`,
    html: `<span>${emoji}</span>`,
    iconSize: [dimensions.size, dimensions.size],
    iconAnchor: [dimensions.anchorX, dimensions.anchorY],
    popupAnchor: [0, dimensions.popupY]
  });
}

function placeCoordinates(place) {
  const location = place?.ubicacion || place?.["ubicaciÃ³n"];
  return {
    lat: location?.latitude ?? location?.lat,
    lng: location?.longitude ?? location?.lng
  };
}

function isSamePlace(candidate, selected) {
  if (candidate === selected) return true;

  const a = placeCoordinates(candidate);
  const b = placeCoordinates(selected);
  return Number.isFinite(a.lat) && Number.isFinite(a.lng)
    && a.lat === b.lat && a.lng === b.lng
    && String(candidate?.nombre || "") === String(selected?.nombre || "");
}

/** Resalta el lugar elegido, reduce los demás marcadores y abre su información. */
export function selectRenderedMarker(place, { openPopup = true } = {}) {
  let selectedMarker = null;

  renderedPlaceMarkers.forEach(entry => {
    const selected = isSamePlace(entry.place, place);
    entry.marker.setIcon(emojiMarkerIcon(markerEmoji(entry.place), selected ? "selected" : "muted"));
    entry.marker.setZIndexOffset(selected ? 1200 : 0);
    if (selected) selectedMarker = entry.marker;
  });

  if (selectedMarker && openPopup) {
    selectedMarker.openPopup();
  }

  return Boolean(selectedMarker);
}

export function renderMarkers(list, onSelect) {
  clearMarkers();

  list.forEach(p => {
    const u = p?.ubicacion || p?.["ubicación"];
    const lat = u?.latitude ?? u?.lat;
    const lng = u?.longitude ?? u?.lng;

    if (typeof lat !== "number" || typeof lng !== "number") return;

    const marker = L.marker([lat, lng], { icon: emojiMarkerIcon(markerEmoji(p)) })
      .addTo(markersLayer)
      .bindPopup(buildPopupHTML(p), {
        className: "tm-place-popup-shell",
        minWidth: 210,
        maxWidth: 280
      })
      .on("click", () => {
        selectRenderedMarker(p);
        onSelect(p);
      });

    renderedPlaceMarkers.push({ place: p, marker });
  });
}

const TERRITORIAL_COLORS = [
  "#0d6efd",
  "#dc3545",
  "#198754",
  "#fd7e14",
  "#6f42c1",
  "#20c997",
  "#d63384",
  "#0dcaf0",
  "#ffc107",
  "#6610f2",
  "#2f9e44",
  "#e03131",
  "#1971c2",
  "#f08c00",
  "#5f3dc4",
  "#087f5b"
];

function featureColor(feature, type) {
  const props = feature?.properties || {};
  const key = type === "barrios"
    ? String(props.cod_barrio || props.des_barrio || "")
    : String(props.dpa_parroq || props.dpa_despar || "");

  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    hash = ((hash << 5) - hash) + key.charCodeAt(i);
    hash |= 0;
  }

  return TERRITORIAL_COLORS[Math.abs(hash) % TERRITORIAL_COLORS.length];
}

function territorialStyle(feature, type) {
  const color = featureColor(feature, type);

  return {
    color,
    weight: 2,
    opacity: 0.95,
    fillColor: color,
    fillOpacity: type === "barrios" ? 0.2 : 0.14
  };
}

function territorialPopupHTML(feature, type) {
  const props = feature?.properties || {};
  if (type === "barrios") {
    const name = props.des_barrio || "Barrio";
    return `<b>${name}</b>`;
  }

  const name = props.dpa_despar || "Parroquia";
  return `<b>${name}</b>`;
}

function territorialName(feature, type) {
  const props = feature?.properties || {};
  return type === "barrios"
    ? String(props.des_barrio || "Barrio").trim()
    : String(props.dpa_despar || "Parroquia").trim();
}

export function renderTerritorialLayer(geojson, {
  type = "barrios",
  onFeatureClick = null,
  fit = true
} = {}) {
  const overlay = getTerritorialOverlay(type);
  try {
    overlay.clearLayers();
    overlay.addTo(map);
  } catch {}

  const layer = L.geoJSON(geojson, {
    style: feature => territorialStyle(feature, type),
    onEachFeature(feature, polygon) {
      const name = territorialName(feature, type);
      polygon.bindPopup(territorialPopupHTML(feature, type));
      polygon.bindTooltip(name, {
        permanent: true,
        direction: "center",
        className: "tm-territorial-label"
      });
      polygon.on("mouseover", () => {
        polygon.setStyle({
          weight: 4,
          fillOpacity: 0.24
        });
      });
      polygon.on("mouseout", () => {
        polygon.setStyle(territorialStyle(feature, type));
      });
      polygon.on("click", () => {
        polygon.openPopup();
        if (typeof onFeatureClick === "function") onFeatureClick(feature);
      });
    }
  }).addTo(overlay);

  if (fit) {
    try {
      const bounds = layer.getBounds();
      if (bounds?.isValid?.()) map.fitBounds(bounds.pad(0.08));
    } catch {}
  }

  return layer;
}

/* ================= RUTAS (1 tramo - normal) ================= */
export async function drawRoute(userLoc, place, mode, infoBox) {
  if (!userLoc || !place?.ubicacion) return;

  clearRoute();
  const renderVersion = routeRenderVersion;

  const { latitude, longitude } = place.ubicacion;
  const dest = [latitude, longitude];

  const usesRenderedMarker = selectRenderedMarker(place);
  if (!usesRenderedMarker) {
    markerSelected = L.marker(dest, {
      icon: emojiMarkerIcon(markerEmoji(place), "selected"),
      zIndexOffset: 1200
    })
      .addTo(routeOverlay)
      .bindPopup(buildPopupHTML(place), {
        className: "tm-place-popup-shell",
        minWidth: 210,
        maxWidth: 280
      })
      .openPopup();
  }

  const profile = {
    walking: "foot",
    driving: "car",
    cycling: "bike",
    bicycle: "bike",
    motorcycle: "car",
    bus: "car"
  }[mode] || "foot";

  const coordinates = `${userLoc[1]},${userLoc[0]};${longitude},${latitude}`;

  try {
    const data = await fetchOsrmRoute({
      profile,
      coordinates,
      overview: "full",
      geometries: "geojson",
      timeoutMs: 8000
    });

    if (renderVersion !== routeRenderVersion) return { cancelled: true };

    if (!data.routes?.length) {
      throw new Error("OSRM no devolvió rutas");
    }

    const route = data.routes[0];

    routeLine = L.polyline(
      route.geometry.coordinates.map(c => [c[1], c[0]]),
      { color: "#1e88e5", weight: 5 }
    ).addTo(routeOverlay);

    map.fitBounds(routeLine.getBounds());

    const distanciaKm = route.distance / 1000;

    const velocidadPorModo = {
      walking: 5,
      cycling: 15,
      bicycle: 15,
      motorcycle: 35,
      driving: 30
    };

    const usaTiempoOsrm = mode === "bus" || !velocidadPorModo[mode];

    const tiempoSeg = usaTiempoOsrm
      ? Math.round(route.duration)
      : Math.round((distanciaKm / velocidadPorModo[mode]) * 3600);

    if (infoBox) {
      infoBox.innerHTML = `
        <b>Ruta (${mode})</b><br>
        ⏱ ${formatDurationFromSeconds(tiempoSeg)}<br>
        📏 ${distanciaKm.toFixed(2)} km
      `;
    }

    return {
      fallback: false,
      route,
      line: routeLine
    };

  } catch (err) {
    if (renderVersion !== routeRenderVersion) return { cancelled: true };
    console.error("OSRM falló en drawRoute, usando fallback:", err);

    routeLine = drawFallbackPolyline([userLoc, dest], {
      target: routeOverlay
    });

    map.fitBounds(routeLine.getBounds());

    const distanciaKm = map.distance(userLoc, dest) / 1000;

    if (infoBox) {
      infoBox.innerHTML = `
        <b>Ruta (${mode})</b><br>
        ⚠️ Ruta aproximada por fallo de OSRM<br>
        📏 ${distanciaKm.toFixed(2)} km referenciales
      `;
    }

    return {
      fallback: true,
      distance: distanciaKm * 1000,
      line: routeLine
    };
  }
}

/* ================= ruta hacia un punto ================= */
export async function drawRouteToPoint({
  from,
  to,
  mode = "walking",
  infoBox = null,
  title = "Ruta",
  layerTarget = "normal",
  layerGroup = null,
  clearFirst = true
}) {
  if (!from || !to) return null;

  if (layerGroup) {
    if (clearFirst) {
      try { layerGroup.clearLayers(); } catch {}
    }
  } else {
    if (clearFirst) clearRoute();
  }

  const tracksNormalRoute = !layerGroup && layerTarget !== "transport";
  const renderVersion = tracksNormalRoute ? routeRenderVersion : null;

  const profile = {
    walking: "foot",
    driving: "car",
    cycling: "bike",
    bicycle: "bike",
    motorcycle: "car",
    bus: "car"
  }[mode] || "foot";

  const coordinates = `${from[1]},${from[0]};${to[1]},${to[0]}`;

  const target =
    layerGroup
      ? layerGroup
      : (layerTarget === "transport" ? transportOverlay : routeOverlay);

  try {
    const data = await fetchOsrmRoute({
      profile,
      coordinates,
      overview: "full",
      geometries: "geojson",
      timeoutMs: 8000
    });

    if (tracksNormalRoute && renderVersion !== routeRenderVersion) {
      return { cancelled: true };
    }

    if (!data.routes?.length) {
      throw new Error("OSRM no devolvió rutas");
    }

    const r = data.routes[0];

    const line = L.polyline(
      r.geometry.coordinates.map(c => [c[1], c[0]]),
      { color: "#1e88e5", weight: 5 }
    ).addTo(target);

    if (!layerGroup && layerTarget !== "transport") {
      routeLine = line;
    }

    map.fitBounds(line.getBounds());

    const distanciaKm = (Number(r.distance) || 0) / 1000;

    const velocidadPorModo = {
      walking: 5,
      cycling: 15,
      bicycle: 15,
      motorcycle: 35,
      driving: 30
    };

    const usaTiempoOsrm = mode === "bus" || !velocidadPorModo[mode];

    const tiempoSeg = usaTiempoOsrm
      ? Math.round(Number(r.duration) || 0)
      : Math.round((distanciaKm / velocidadPorModo[mode]) * 3600);

    if (infoBox) {
      infoBox.innerHTML = `
        <b>${title} (${mode})</b><br>
        ⏱ ${formatDurationFromSeconds(tiempoSeg)}<br>
        📏 ${distanciaKm.toFixed(2)} km
      `;
    }

    return r;

  } catch (err) {
    if (tracksNormalRoute && renderVersion !== routeRenderVersion) {
      return { cancelled: true };
    }
    console.error("OSRM falló en drawRouteToPoint, usando fallback:", err);

    const line = drawFallbackPolyline([from, to], {
      target
    });

    if (!layerGroup && layerTarget !== "transport") {
      routeLine = line;
    }

    map.fitBounds(line.getBounds());

    const distanciaKm = map.distance(from, to) / 1000;

    if (infoBox) {
      infoBox.innerHTML = `
        <b>${title} (${mode})</b><br>
        ⚠️ Ruta aproximada por fallo de OSRM<br>
        📏 ${distanciaKm.toFixed(2)} km referenciales
      `;
    }

    return {
      fallback: true,
      distance: distanciaKm * 1000,
      duration: null,
      line
    };
  }
}
/* ================= utilidades OSRM ================= */
function modeToProfile(mode) {
  return ({
    walking: "foot",
    bicycle: "bike",
    driving: "car"
  }[mode] || "car");
}

/**
 * Obtiene fetch osrmroute desde el estado local, la API o los datos cacheados.
 */
async function fetchOSRMRoute(from, to, profile) {
  const coordinates = `${from[1]},${from[0]};${to[1]},${to[0]}`;

  try {
    const data = await fetchOsrmRoute({
      profile,
      coordinates,
      overview: "full",
      geometries: "geojson",
      timeoutMs: 8000
    });

    if (!data.routes?.length) return null;
    return data.routes[0];

  } catch (err) {
    console.warn("OSRM falló en fetchOSRMRoute:", err);
    return null;
  }
}
/**
 * Dibuja o resalta draw route between points sobre el mapa o la interfaz.
 */
export async function drawRouteBetweenPoints({
  from,
  to,
  mode = "driving",
  color = "#0d6efd",
  dashed = false,
  weight = 5,
  layerTarget = "normal",
  layerGroup = null
}) {
  if (!from || !to) return null;

  const target =
    layerGroup
      ? layerGroup
      : (layerTarget === "transport" ? transportOverlay : routeOverlay);

  const r = await fetchOSRMRoute(from, to, modeToProfile(mode));

  let line;

  if (r) {
    const coords = r.geometry.coordinates.map(c => [c[1], c[0]]);
    line = L.polyline(coords, {
      color,
      weight,
      dashArray: dashed ? "8 10" : null
    }).addTo(target);
  } else {
    line = drawFallbackPolyline([from, to], {
      target,
      color: "#ff9800",
      weight,
      dashed: true
    });
  }

  if (!layerGroup && layerTarget === "transport") transportLines.push(line);
  if (!layerGroup && layerTarget !== "transport") routeLines.push(line);

  return {
    fallback: !r,
    route: r,
    line
  };
}
/**
 * Dibuja o resalta draw two leg osrm sobre el mapa o la interfaz.
 */
export async function drawTwoLegOSRM({
  userLoc,
  terminalLoc,
  targetLoc,
  mode = "driving",
  color1 = "#6c757d",
  color2 = "#0d6efd",
  infoBox = null,
  title = "Ruta vía Terminal",
  layerTarget = "normal",
  layerGroup = null,
  clearFirst = true
}) {
  if (!userLoc || !terminalLoc || !targetLoc) return null;

  if (layerGroup) {
    if (clearFirst) {
      try { layerGroup.clearLayers(); } catch {}
    }
  } else {
    if (clearFirst) {
      if (layerTarget === "transport") clearTransportRoute();
      else clearRoute();
    }
  }

  const target =
    layerGroup
      ? layerGroup
      : (layerTarget === "transport" ? transportOverlay : routeOverlay);

  const r1 = await fetchOSRMRoute(userLoc, terminalLoc, modeToProfile(mode));
  const r2 = await fetchOSRMRoute(terminalLoc, targetLoc, modeToProfile(mode));

  let line1;
  let line2;

  if (r1) {
    line1 = L.polyline(
      r1.geometry.coordinates.map(c => [c[1], c[0]]),
      { color: color1, weight: 5, dashArray: "8 10" }
    ).addTo(target);
  } else {
    line1 = drawFallbackPolyline([userLoc, terminalLoc], {
      target,
      color: "#ff9800",
      dashed: true,
      popupText: `
        <b>Tramo aproximado</b><br>
        OSRM falló en el tramo hacia el terminal.
      `
    });
  }

  if (r2) {
    line2 = L.polyline(
      r2.geometry.coordinates.map(c => [c[1], c[0]]),
      { color: color2, weight: 5 }
    ).addTo(target);
  } else {
    line2 = drawFallbackPolyline([terminalLoc, targetLoc], {
      target,
      color: "#ff9800",
      dashed: true,
      popupText: `
        <b>Tramo aproximado</b><br>
        OSRM falló en el tramo desde el terminal hacia el destino.
      `
    });
  }

  if (!layerGroup && layerTarget === "transport") transportLines = [line1, line2];
  if (!layerGroup && layerTarget !== "transport") routeLines = [line1, line2];

  const dist1 = r1 ? Number(r1.distance) || 0 : map.distance(userLoc, terminalLoc);
  const dist2 = r2 ? Number(r2.distance) || 0 : map.distance(terminalLoc, targetLoc);

  const dur1 = r1 ? Number(r1.duration) || 0 : 0;
  const dur2 = r2 ? Number(r2.duration) || 0 : 0;

  const usedFallback = !r1 || !r2;

  if (infoBox) {
    infoBox.innerHTML = `
      <b>${title}</b><br>
      ${usedFallback ? "⚠️ Ruta parcialmente aproximada por fallo de OSRM<br>" : ""}
      ${!usedFallback ? `⏱ ${formatDurationFromSeconds(Math.round(dur1 + dur2))}<br>` : ""}
      📏 ${((dist1 + dist2) / 1000).toFixed(2)} km ${usedFallback ? "referenciales" : ""}
    `;
  }

  map.fitBounds(L.latLngBounds([userLoc, terminalLoc, targetLoc]).pad(0.2));

  return {
    fallback: usedFallback,
    r1,
    r2,
    line1,
    line2
  };
}
