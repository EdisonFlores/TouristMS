// js/script.js

/* ================= IMPORTS ================= */
import { findNearest, updateUserLocation, setTravelMode, setActivePlaceAction } from "./app/actions.js";
import { dataList, getUserLocation, getMode } from "./app/state.js";
import {
  map,
  baseLayers,
  markersLayer,
  interprovOverlay,
  barriosOverlay,
  parroquiasOverlay,
  renderMarkers,
  selectRenderedMarker,
  clearMarkers,
  clearRoute,
  clearTerritorialLayer,
  drawRoute,
  drawRouteToPoint,
  drawRouteBetweenPoints,
  clearInterprov,
  drawTwoLegOSRM,
  renderTerritorialLayer
} from "./map/map.js";

import {
  cargarLineasTransporte,
  clearTransportLayers,
  planAndShowBusStops,
  hasBusCoverage
} from "./transport/transport_controller.js";

import { getLineasByTipoAll, isLineOperatingNow } from "./transport/core/transport_data.js";
import { getCollectionCache } from "./app/cache_db.js";

import { installMapContextMenu } from "./map/context_menu.js";
import { initLayersUI } from "./map/layers_ui.js";
import { shouldShowVisitMorona, applyVisitMorona } from "./app/virtual_visit.js";

import { detectAdminContextFromLatLng, detectPointContext } from "./app/admin_detection.js";
import { createManualRouting } from "./app/manual_route.js";

import { applyLanguageUI, initLanguageObserver, toggleLanguage } from "./app/i18n.js";
import { applyThemeUI, toggleTheme } from "./app/theme.js";
import { updateWeatherBadge, startWeatherAutoRefresh } from "./services/weather.js";
import { getTerritorialLayer, territorialFeatureToPlace } from "./services/geoportal.js";
import { initWeatherPopup } from "./app/weather_popup.js";
import { initVoiceReader } from "./app/voice_assistant.js";
import { initInteractiveTutorial } from "./app/tutorial.js";
import { initCategoryPicker } from "./app/category_picker.js";

import {
  getProvinciasFS,
  getCantonesFSByCodigoProvincia,
  getTiposComidaFromLugar
} from "./app/selects.js";

/* ================= ESTADO GLOBAL (UI) ================= */
let activePlace = null;
let userMarker = null;
let layersUI = null;
let tripTracker = {
  watchId: null,
  active: false,
  pending: false,
  lastLoc: null,
  lastRouteAt: 0,
  place: null,
  source: "",
  modeSelected: false,
  busRouteSelectionPending: false,
  busRouteReady: false,
  completed: false
};

let detectedAdmin = { provincia: "", canton: "", parroquia: "" };

let ctxGeo = {
  provincia: "",
  canton: "",
  parroquia: "",
  specialSevilla: false,
  entornoUser: "",
  busEnabled: true,
  virtualMorona: false
};

/**
 * Obtiene get ctx geo desde el estado local, la API o los datos cacheados.
 */
const getCtxGeo = () => ctxGeo;
let forceVirtualMoronaNext = false;

/* ================= ELEMENTOS DEL DOM ================= */
const category = document.getElementById("category");
const extra = document.getElementById("extra-controls");
const bannerWrap = document.getElementById("loc-banner-wrap");
const categoryPicker = initCategoryPicker(category);
// 🔹 Ocultar aviso cuando el usuario interactúa con el select
if (category) {
  category.addEventListener("focus", hideDetectedFacadeOnCategoryChange);
  category.addEventListener("click", hideDetectedFacadeOnCategoryChange);
}
document.getElementById("categoryPicker")?.addEventListener("category-picker-open", hideDetectedFacadeOnCategoryChange);
/* ================= HEADER INIT ================= */
applyThemeUI();
applyLanguageUI();
initLanguageObserver();

const btnTheme = document.getElementById("btnTheme");
const btnLang = document.getElementById("btnLang");

if (btnTheme) btnTheme.addEventListener("click", () => toggleTheme());

/**
 * Muestra show translate help modal al usuario.
 */
function showTranslateHelpModal() {
  return;
  const mobile = isMobileDevice();
  const lang = getBrowserLang();
  const isEnglish = lang.startsWith("en");

  const title = isEnglish ? "🌐 Browser translation" : "🌐 Traducción del navegador";

  const subtitle = isEnglish
    ? `Your browser language is <b>English</b> (${lang}).`
    : `Tu navegador está en <b>español</b> (${lang}).`;

  const infoText = isEnglish
    ? `This web app does not translate by itself yet (it will in the future). For now, please use your browser translator. Thank you.`
    : `Este app web de momento no traduce por sí misma (a futuro lo hará). Por ahora usa el traductor del navegador. Gracias.`;

  const stepsDesktop = isEnglish
    ? `
      <div class="mt-2">
        <b>On desktop (Chrome/Edge):</b><br>
        1️⃣ Right click anywhere on the page<br>
        2️⃣ Click <b>“Translate to English”</b> (or your language)<br>
        <div class="small opacity-75 mt-1">
          Tip: You can also open the browser menu ⋮ and look for <b>Translate…</b>
        </div>
      </div>
    `
    : `
      <div class="mt-2">
        <b>En computadora (Chrome/Edge):</b><br>
        1️⃣ Click derecho en la página<br>
        2️⃣ Selecciona <b>“Traducir al inglés”</b> (o el idioma)<br>
        <div class="small opacity-75 mt-1">
          Tip: también puedes abrir el menú ⋮ del navegador y buscar <b>Traducir…</b>
        </div>
      </div>
    `;

  const stepsMobile = isEnglish
    ? `
      <div class="mt-2">
        <b>On Android (Chrome):</b><br>
        1️⃣ Tap the menu <b>⋮</b> (top-right)<br>
        2️⃣ Tap <b>“Translate…”</b><br>
        3️⃣ Choose your language<br>

        <hr class="my-2">

        <b>On iPhone (Safari / Chrome):</b><br>
        • Safari: tap <b>aA</b> (address bar) → <b>Translate</b><br>
        • Chrome iOS: menu <b>⋯</b> → <b>Translate</b>
        <div class="small opacity-75 mt-1">
          *Some iPhones show the option only when the language is supported and you have internet.
        </div>
      </div>
    `
    : `
      <div class="mt-2">
        <b>En teléfono (Chrome Android):</b><br>
        1️⃣ Toca el menú <b>⋮</b> (arriba a la derecha)<br>
        2️⃣ Presiona <b>“Traducir…”</b><br>
        3️⃣ Elige <b>Inglés</b> u otro idioma<br>

        <hr class="my-2">

        <b>En iPhone (Safari / Chrome):</b><br>
        • Safari: toca <b>aA</b> (barra de direcciones) → <b>Traducir</b><br>
        • Chrome iOS: menú <b>⋯</b> → <b>Translate</b> / <b>Traducir</b>
        <div class="small opacity-75 mt-1">
          *En algunos iPhone la opción aparece solo si el idioma está soportado y tienes internet.
        </div>
      </div>
    `;

  showModal(
    title,
    `
      <div class="alert alert-info py-2 mb-2">
        ${subtitle}<br>
        ${infoText}
      </div>
      ${mobile ? stepsMobile : stepsDesktop}
    `
  );
}

if (btnLang) {
  btnLang.addEventListener("click", () => {
    toggleLanguage();
    setTimeout(() => {
      if (tripTracker.place) renderTripButton();
      refreshLayersOverlays();
    }, 0);
  });
}

/* ================= WEATHER HELPERS ================= */
function getMapCenterLatLng() {
  const c = map.getCenter?.();
  if (!c) return null;
  return { lat: c.lat, lng: c.lng };
}

/**
 * Gestiona refresh weather from center or user dentro del flujo principal del modulo.
 */
async function refreshWeatherFromCenterOrUser() {
  const c = getMapCenterLatLng();
  if (c) {
    await updateWeatherBadge(c.lat, c.lng);
    return;
  }
  const loc = getUserLocation?.();
  if (loc) await updateWeatherBadge(loc[0], loc[1]);
}

initWeatherPopup({
  getUserLoc: () => getUserLocation(),
  getMapCenter: () => map.getCenter()
});

/* ================= HELPERS UI ================= */
function clearRouteInfo() {
  const el = document.getElementById("route-info");
  if (el) el.innerHTML = "";
}

/**
 * Obtiene get trip actions el desde el estado local, la API o los datos cacheados.
 */
function getTripActionsEl() {
  const routeInfo = document.getElementById("route-info");
  const host = routeInfo?.parentNode || extra;
  if (!host) return null;

  let el = document.getElementById("trip-actions");
  if (el) {
    if (routeInfo && el.previousElementSibling !== routeInfo) {
      routeInfo.parentNode.insertBefore(el, routeInfo.nextSibling);
    } else if (!routeInfo && el.parentNode !== host) {
      host.appendChild(el);
    }
    return el;
  }

  el = document.createElement("div");
  el.id = "trip-actions";
  el.className = "mt-2 mb-2";
  if (routeInfo?.parentNode) routeInfo.parentNode.insertBefore(el, routeInfo.nextSibling);
  else host.appendChild(el);
  return el;
}

/**
 * Construye render trip button para mostrar contenido o preparar datos de la interfaz.
 */
function renderTripButton() {
  if (!tripTracker.place) return;
  if (getMode?.() === "bus" && !tripTracker.busRouteReady) {
    const el = document.getElementById("trip-actions");
    if (el) el.innerHTML = "";
    return;
  }
  if (!tripTracker.modeSelected) {
    const el = document.getElementById("trip-actions");
    if (el) el.innerHTML = "";
    return;
  }

  const el = getTripActionsEl();
  if (!el) return;

  el.innerHTML = `
    <button id="btn-trip-toggle" type="button" class="btn ${tripTracker.active ? "btn-danger" : "btn-success"} w-100" aria-pressed="${tripTracker.active ? "true" : "false"}" aria-label="${tripTracker.active ? "Detener trayecto" : "Iniciar trayecto"}">
      ${tripTracker.active ? "Detener trayecto" : "Iniciar trayecto"}
    </button>
    ${
      tripTracker.active
        ? `<div class="small text-muted mt-1">Trayecto activo: tu ubicación avanzará sobre la ruta calculada.</div>`
        : ""
    }
    <div id="trip-live-status" class="small mt-1"></div>
  `;

  const btn = document.getElementById("btn-trip-toggle");
  if (btn) btn.onclick = () => {
    if (tripTracker.active) stopTripTracking(false);
    else startTripTracking(tripTracker.place);
  };
}

/**
 * Obtiene get trip destination loc desde el estado local, la API o los datos cacheados.
 */
function getTripDestinationLoc() {
  const u = tripTracker.place?.ubicacion || tripTracker.place?.["ubicaci\u00f3n"];
  const lat = u?.latitude ?? u?.lat;
  const lng = u?.longitude ?? u?.lng;
  if (typeof lat !== "number" || typeof lng !== "number") return null;
  return [lat, lng];
}

/**
 * Normaliza o formatea format trip duration para usarlo de forma consistente.
 */
function formatTripDuration(seconds) {
  const s = Math.max(0, Math.round(Number(seconds) || 0));
  if (s < 60) return `${s} s`;
  const mins = Math.round(s / 60);
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}

/**
 * Calcula estimate remaining seconds para escoger la mejor opcion disponible.
 */
function estimateRemainingSeconds(distanceMeters, mode) {
  const speedKmH = {
    walking: 5,
    bicycle: 15,
    cycling: 15,
    motorcycle: 35,
    driving: 30,
    bus: 20
  }[mode] || 5;

  return (distanceMeters / 1000 / speedKmH) * 3600;
}

/**
 * Actualiza update trip live status y sincroniza la interfaz con el estado actual.
 */
function updateTripLiveStatus(loc) {
  const status = document.getElementById("trip-live-status");
  const dest = getTripDestinationLoc();
  if (!status || !dest) return;

  const distanceM = map?.distance ? map.distance(loc, dest) : Infinity;
  if (!Number.isFinite(distanceM)) return;

  const mode = getMode?.() || "walking";
  const km = distanceM / 1000;
  const seconds = estimateRemainingSeconds(distanceM, mode);

  if (mode === "bus") {
    status.innerHTML = `
      <b>Seguimiento activo</b><br>
      Se mantiene la ruta de bus calculada arriba.<br>
      Distancia directa al destino: ${km < 1 ? `${Math.round(distanceM)} m` : `${km.toFixed(2)} km`}
    `;
    return;
  }

  status.innerHTML = `
    <b>Seguimiento activo</b><br>
    Distancia directa al destino: ${km < 1 ? `${Math.round(distanceM)} m` : `${km.toFixed(2)} km`}<br>
    Tiempo aprox. según modo: ${formatTripDuration(seconds)}
  `;
}

/**
 * Gestiona complete trip tracking dentro del flujo principal del modulo.
 */
function completeTripTracking() {
  stopTripTracking(false);
  const status = document.getElementById("trip-live-status");
  if (status) {
    status.innerHTML = `<span class="text-success"><b>Trayecto finalizado.</b> Llegaste al destino.</span>`;
  }
}

/**
 * Muestra show trip start for dropdown selection al usuario.
 */
function showTripStartForDropdownSelection(place, source = "list") {
  const u = place?.ubicacion || place?.["ubicaci\u00f3n"];
  if (!u) return;

  if (!place.ubicacion) place.ubicacion = u;

  tripTracker.place = place;
  tripTracker.source = source;
  tripTracker.modeSelected = false;
  tripTracker.busRouteReady = false;
  tripTracker.completed = false;
  hideTripStart();
}

/**
 * Gestiona rebuild selected route dentro del flujo principal del modulo.
 */
function rebuildSelectedRoute({ showTripButton = false } = {}) {
  const selectedPlace = activePlace || tripTracker.place;
  const selectedLocation = selectedPlace?.ubicacion || selectedPlace?.["ubicaci\u00f3n"];
  if (selectedPlace && selectedLocation) {
    if (!selectedPlace.ubicacion) selectedPlace.ubicacion = selectedLocation;
    tripTracker.place = selectedPlace;
    tripTracker.modeSelected = true;
    tripTracker.completed = false;
    selectRenderedMarker(selectedPlace);
  }

  tripTracker.busRouteSelectionPending = getMode?.() === "bus";
  if (tripTracker.busRouteSelectionPending) tripTracker.busRouteReady = false;
  if (tripTracker.busRouteSelectionPending) hideTripStart();

  const p = manual.buildRoute();
  if (showTripButton || tripTracker.place) setTimeout(() => renderTripButton(), 80);
  Promise.resolve(p)
    .catch(err => console.warn("No se pudo recalcular la ruta:", err))
    .finally(() => {
      if (showTripButton || tripTracker.place) renderTripButton();
      if (showTripButton || tripTracker.place) setTimeout(() => renderTripButton(), 500);
      refreshLayersOverlays();
    });
}

/**
 * Oculta hide trip start cuando deja de ser necesario.
 */
function hideTripStart() {
  const el = document.getElementById("trip-actions");
  if (el) el.innerHTML = "";
}

window.addEventListener("moronabus:bus-route-options", () => {
  tripTracker.busRouteSelectionPending = true;
  tripTracker.busRouteReady = false;
  hideTripStart();
});

window.addEventListener("moronabus:bus-route-selected", event => {
  const selectedPlace = event?.detail?.place;
  const selectedLocation = selectedPlace?.ubicacion || selectedPlace?.["ubicaci\u00f3n"];
  if (selectedPlace && selectedLocation) {
    if (!selectedPlace.ubicacion) selectedPlace.ubicacion = selectedLocation;
    tripTracker.place = selectedPlace;
    tripTracker.modeSelected = true;
    tripTracker.completed = false;
  }
  tripTracker.busRouteSelectionPending = false;
  tripTracker.busRouteReady = true;
  renderTripButton();
});

/**
 * Detiene stop trip tracking y libera recursos asociados.
 */
function stopTripTracking(clearButton = true) {
  if (tripTracker.watchId !== null) {
    try { navigator.geolocation.clearWatch(tripTracker.watchId); } catch {}
  }

  tripTracker.watchId = null;
  tripTracker.active = false;
  tripTracker.pending = false;
  tripTracker.lastLoc = null;
  tripTracker.lastRouteAt = 0;
  tripTracker.source = "";
  tripTracker.modeSelected = false;
  tripTracker.completed = false;

  if (clearButton) {
    tripTracker.place = null;
    hideTripStart();
  } else {
    renderTripButton();
  }
}

/**
 * Evalua si should rebuild tracked route para decidir el flujo de la interfaz.
 */
function shouldRebuildTrackedRoute(loc) {
  const now = Date.now();
  if (!tripTracker.lastLoc) return true;
  if ((now - tripTracker.lastRouteAt) >= 2500) return true;

  try {
    return map.distance(tripTracker.lastLoc, loc) >= 8;
  } catch {
    return true;
  }
}

/**
 * Gestiona rebuild tracked route dentro del flujo principal del modulo.
 */
async function rebuildTrackedRoute(loc) {
  if (!tripTracker.active || tripTracker.pending || !tripTracker.place) return;
  if (!shouldRebuildTrackedRoute(loc)) return;

  tripTracker.pending = true;
  tripTracker.lastLoc = loc;
  tripTracker.lastRouteAt = Date.now();

  updateUserLocation(loc);
  setUserMarker(loc, false);
  updateTripLiveStatus(loc);

  try {
    const dest = getTripDestinationLoc();
    if (dest && map?.distance && map.distance(loc, dest) <= 35) {
      completeTripTracking();
      return;
    }
    refreshLayersOverlays();
  } finally {
    tripTracker.pending = false;
  }
}

/**
 * Inicializa start trip tracking y deja sus eventos o elementos listos para usarse.
 */
function startTripTracking(place) {
  if (!navigator.geolocation) {
    showModal(
      "Ubicación no disponible",
      `<div class="alert alert-warning py-2 mb-0">Tu navegador no permite seguimiento de ubicación.</div>`
    );
    return;
  }

  const u = place?.ubicacion || place?.["ubicaci\u00f3n"];
  if (!u) return;
  if (!place.ubicacion) place.ubicacion = u;

  stopTripTracking(false);
  tripTracker.place = place;
  tripTracker.active = true;
  tripTracker.modeSelected = true;
  tripTracker.completed = false;
  renderTripButton();

  const currentLoc = getUserLocation?.();
  if (currentLoc) updateTripLiveStatus(currentLoc);

  tripTracker.watchId = navigator.geolocation.watchPosition(
    pos => {
      const loc = [pos.coords.latitude, pos.coords.longitude];
      rebuildTrackedRoute(loc);
    },
    () => {
      showModal(
        "Ubicación no disponible",
        `<div class="alert alert-warning py-2 mb-0">No se pudo actualizar tu ubicación para seguir el trayecto.</div>`
      );
      stopTripTracking(false);
    },
    {
      enableHighAccuracy: true,
      maximumAge: 3000,
      timeout: 10000
    }
  );
}

/**
 * Limpia clear routing artifacts para dejar la vista o el estado listo para otro flujo.
 */
function clearRoutingArtifacts({ preserveManualDestination = false } = {}) {
  clearRoute();
  clearTransportLayers();
  clearInterprov();
  clearRouteInfo();
  if (!preserveManualDestination) {
    try { manual.clearManualDest(); } catch {}
    try { manual.clearManualStart(); } catch {}
  }
}

/**
 * Limpia reset map para dejar la vista o el estado listo para otro flujo.
 */
function resetMap() {
  stopTripTracking(true);
  clearMarkers();
  clearRoutingArtifacts();
  activePlace = null;
  setActivePlaceAction(null);
}

/**
 * Limpia clear directions para dejar la vista o el estado listo para otro flujo.
 */
function clearDirections() {
  stopTripTracking(true);
  try { manual.clearManualDest(); } catch {}
  try { manual.clearManualStart(); } catch {}

  clearRoutingArtifacts();

  const loc = getUserLocation();
  if (loc) map.setView(loc, 14);

  refreshLayersOverlays();
  if (bannerWrap) bannerWrap.innerHTML = "";
}

/* ================= MODAL GENERAL ================= */
function ensureModal() {
  if (document.getElementById("tm-modal")) return;
  const wrap = document.createElement("div");
  wrap.innerHTML = `
    <div class="modal fade" id="tm-modal" tabindex="-1" aria-hidden="true">
      <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title" id="tm-modal-title">Aviso</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Cerrar"></button>
          </div>
          <div class="modal-body" id="tm-modal-body"></div>
          <div class="modal-footer">
            <button type="button" class="btn btn-primary" data-bs-dismiss="modal">Cerrar</button>
          </div>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(wrap);
}

/**
 * Muestra show modal al usuario.
 */
function showModal(title, html) {
  ensureModal();
  document.getElementById("tm-modal-title").textContent = title;
  document.getElementById("tm-modal-body").innerHTML = html;
  const modal = new bootstrap.Modal(document.getElementById("tm-modal"));
  modal.show();
}

initVoiceReader();
initInteractiveTutorial();

/* ================= Map: marker de usuario ================= */
function setUserMarker(loc, open = false) {
  try { if (userMarker) map.removeLayer(userMarker); } catch {}
  userMarker = L.marker(loc).addTo(map).bindPopup("📍 Tu ubicación");
  if (open) userMarker.openPopup();
}

function firstEmojiFromText(text) {
  const value = String(text || "").trim();
  if (!value) return "";
  const match = value.match(/^(\p{Extended_Pictographic}(?:\uFE0F|\u200D\p{Extended_Pictographic})*)/u);
  if (match?.[1]) return match[1];
  const firstToken = value.split(/\s+/)[0] || "";
  return /[^\p{L}\p{N}]/u.test(firstToken) ? firstToken : "";
}

function getCategoryOptionEmoji(value = category?.value) {
  if (!category || !value) return "";
  const option = Array.from(category.options || []).find(opt => String(opt.value) === String(value));
  return firstEmojiFromText(option?.textContent || "");
}

function withMarkerEmoji(list, emoji) {
  return (Array.isArray(list) ? list : []).map(item => ({
    ...item,
    markerEmoji: item?.markerEmoji || emoji || "\uD83D\uDCCD"
  }));
}

const territorialVisualCache = new Map();
let territorialSelectionState = null;
let activeTerritorialOverlay = "";
let territorialOverlayRequestId = 0;

async function loadTerritorialVisualData(type) {
  if (territorialVisualCache.has(type)) return territorialVisualCache.get(type);
  const data = await getTerritorialLayer(type);
  territorialVisualCache.set(type, data);
  return data;
}

async function showVisualTerritorialOverlay(type) {
  const targetOverlay = type === "parroquias" ? parroquiasOverlay : barriosOverlay;
  const otherOverlay = type === "parroquias" ? barriosOverlay : parroquiasOverlay;
  const requestId = ++territorialOverlayRequestId;
  activeTerritorialOverlay = type;

  try {
    otherOverlay.clearLayers();
    map.removeLayer(otherOverlay);
  } catch {}

  const data = await loadTerritorialVisualData(type);
  if (requestId !== territorialOverlayRequestId || activeTerritorialOverlay !== type) return;

  try { targetOverlay.addTo(map); } catch {}
  renderTerritorialLayer(data.geojson, {
    type,
    fit: false,
    onFeatureClick: (feature) => {
      if (territorialSelectionState?.type !== type) return;
      territorialSelectionState.onFeatureClick?.(feature);
    }
  });
  setTimeout(() => layersUI?.syncOverlayStates?.(), 0);
}

async function showAllRegisteredPlacesOverlay() {
  const lugares = await getCollectionCache("lugares");
  if (!map.hasLayer(markersLayer)) return;

  const allPlaces = (Array.isArray(lugares) ? lugares : [])
    .filter(place => {
      if (place?.activo === false) return false;
      const location = place?.ubicacion || place?.["ubicación"];
      const lat = location?.latitude ?? location?.lat;
      const lng = location?.longitude ?? location?.lng;
      return Number.isFinite(lat) && Number.isFinite(lng);
    })
    .sort((a, b) => String(a?.nombre || "").localeCompare(String(b?.nombre || "")));

  const placesWithCategoryEmoji = allPlaces.map(place => ({
    ...place,
    markerEmoji:
      place?.markerEmoji ||
      getCategoryOptionEmoji(place?.subcategoria) ||
      "📍"
  }));

  const selectFromOverview = async place => {
    try {
      await selectRegisteredPlaceFromMapLayer(place);
    } catch (error) {
      console.error("No se pudo seleccionar el lugar desde la capa:", error);
    } finally {
      // El flujo normal de la lista filtra los marcadores por categoría.
      // Si Lugares sigue activo, se restaura el conjunto completo y solo se
      // destaca el documento elegido.
      if (map.hasLayer(markersLayer)) {
        renderMarkers(placesWithCategoryEmoji, selectFromOverview);
        selectRenderedMarker(place);
      }
    }
  };

  renderMarkers(placesWithCategoryEmoji, selectFromOverview);

  try { markersLayer.addTo(map); } catch {}
  setTimeout(() => layersUI?.syncOverlayStates?.(), 0);
}

function isSameRegisteredPlace(a, b) {
  if (!a || !b) return false;
  if (a?.id && b?.id) return String(a.id) === String(b.id);

  const aLocation = a?.ubicacion || a?.["ubicación"];
  const bLocation = b?.ubicacion || b?.["ubicación"];
  const aLat = aLocation?.latitude ?? aLocation?.lat;
  const aLng = aLocation?.longitude ?? aLocation?.lng;
  const bLat = bLocation?.latitude ?? bLocation?.lat;
  const bLng = bLocation?.longitude ?? bLocation?.lng;

  return String(a?.nombre || "") === String(b?.nombre || "")
    && Number(aLat) === Number(bLat)
    && Number(aLng) === Number(bLng);
}

async function selectRegisteredPlaceFromMapLayer(place) {
  const subcategory = String(place?.subcategoria || "").trim();
  const categoryOption = Array.from(category?.options || []).find(option => (
    option.value && normLite(option.value) === normLite(subcategory)
  ));

  if (categoryOption) {
    category.value = categoryOption.value;
    categoryPicker?.sync?.();
    await category.onchange?.();

    if (categoryOption.value === "Alimentacion" && place?.tipocomida) {
      const foodType = document.getElementById("sel-tipo-comida");
      if (foodType) {
        foodType.value = String(place.tipocomida);
        await foodType.onchange?.();
      }
    }

    const selectedIndex = dataList.findIndex(item => isSameRegisteredPlace(item, place));
    const placesSelect = document.getElementById("lugares");
    if (selectedIndex >= 0 && placesSelect) {
      placesSelect.value = String(selectedIndex);
      await placesSelect.onchange?.();
      selectRenderedMarker(dataList[selectedIndex]);
      return;
    }
  }

  // Respaldo para documentos cuya subcategoría todavía no exista en el selector.
  stopTripTracking(true);
  clearRoutingArtifacts();
  activePlace = place;
  setActivePlaceAction(place);
  hideDetectedFacadeOnPlaceSelection();
  showTripStartForDropdownSelection(place, "map-layer");
  rebuildSelectedRoute({ showTripButton: true });
}

function initTerritorialOverlayEvents() {
  map.on("baselayerchange", event => {
    const name = String(event?.name || "");
    if (name === "Barrios") {
      showVisualTerritorialOverlay("barrios").catch(error => {
        console.error("No se pudo mostrar Barrios:", error);
      });
    }
    if (name === "Parroquias") {
      showVisualTerritorialOverlay("parroquias").catch(error => {
        console.error("No se pudo mostrar Parroquias:", error);
      });
    }
  });

  map.on("overlayadd", event => {
    const name = String(event?.name || "");
    if (name === "📌 Lugares") {
      showAllRegisteredPlacesOverlay().catch(error => {
        console.error("No se pudieron mostrar todos los lugares:", error);
      });
    }
  });
}

/* ================= Capas: overlays dinámicos ================= */
function refreshLayersOverlays() {
  if (!layersUI) return;

  const overlays = {
    "📌 Lugares": markersLayer,
    "Barrios": barriosOverlay,
    "Parroquias": parroquiasOverlay
  };

  layersUI.updateOverlays(overlays);
}

/* ================= UI banner ubicación ================= */
function showLocatingBanner() {
  if (!bannerWrap) return;
  bannerWrap.innerHTML = `
    <div id="loc-banner" class="alert alert-info py-2 mb-2">
      📡 <b>Estamos ubicándote…</b><br>
      <small>Esto puede tardar unos segundos.</small>
    </div>
  `;
}

/**
 * Gestiona enable category ui dentro del flujo principal del modulo.
 */
function enableCategoryUI() {
  if (!category) return;
  category.disabled = false;
  category.classList.remove("d-none");
  category.value = "";
}

/**
 * Muestra show detected facade al usuario.
 */
function showDetectedFacade() {
  if (!bannerWrap) return;

  let banner = bannerWrap.querySelector("#loc-banner");
  if (!banner) {
    bannerWrap.innerHTML = `<div id="loc-banner" class="alert alert-info py-2 mb-2"></div>`;
    banner = bannerWrap.querySelector("#loc-banner");
  }

  const p = String(detectedAdmin?.provincia || "").trim();
  const c = String(detectedAdmin?.canton || "").trim();
  const pa = String(detectedAdmin?.parroquia || "").trim();
  const ent = String(ctxGeo?.entornoUser || "").trim();

  /**
   * Construye render explore morona button para mostrar contenido o preparar datos de la interfaz.
   */
  const renderExploreMoronaButton = (variant = "primary") => `
    <div class="mt-2 tm-visit-box">
      <div class="small mb-2">Mientras tanto, puedes explorar Morona:</div>
      <button id="btn-explore-morona" class="btn btn-${variant} w-100">
        🧭 Explorar Morona
      </button>
    </div>
  `;

  /**
   * Gestiona wire explore morona dentro del flujo principal del modulo.
   */
  const wireExploreMorona = () => {
    const btn = document.getElementById("btn-explore-morona");
    if (!btn) return;

    btn.onclick = async () => {
      forceVirtualMoronaNext = true;

      applyVisitMorona({
        setUserLocation: updateUserLocation,
        map,
        onAfterSet: async (loc) => {
          setUserMarker(loc, true);

          const res = await detectAdminContextFromLatLng(loc);
          detectedAdmin = res.detectedAdmin;
          ctxGeo = res.ctxGeo;

          ctxGeo.entornoUser = "urbano";
          ctxGeo.virtualMorona = true;
          ctxGeo.busEnabled = true;

          showDetectedFacade();
          enableCategoryUI();
          refreshLayersOverlays();

          await refreshWeatherFromCenterOrUser();
        }
      });
    };
  };

  // Estado inicial por defecto: oculto hasta que el banner se procese
  if (category) {
    category.disabled = true;
    category.classList.add("d-none");
  }

  if (!p || !c) {
    banner.className = "alert alert-info py-2 mb-2";
    banner.innerHTML = `
      <b>📍 Sin cobertura por ahora</b><br>
      <div class="mt-1">
        De momento no hay datos registrados en la zona, pronto habrá cobertura.
      </div>
      ${renderExploreMoronaButton("primary")}
    `;

    wireExploreMorona();
    return;
  }

  banner.className = "alert alert-success py-2 mb-2";
  banner.innerHTML = `
    ✅ <b>Usted se encuentra en:</b><br>
    <b>Provincia:</b> ${p}<br>
    <b>Cantón:</b> ${c}<br>
    <b>Parroquia:</b> ${pa || "(no detectada)"}
    ${
      usesSevillaMoronaSharedCoverage(ctxGeo)
        ? `<div class="small mt-1">⚠️ Cobertura compartida Sevilla + Morona activa</div>`
        : ""
    }
    ${
      ent
        ? `<div class="small mt-1">🧭 <b>Entorno detectado:</b> ${ent}</div>`
        : `<div class="small mt-1">🧭 <b>Entorno detectado:</b> (no disponible)</div>`
    }
  `;

  if (shouldShowVisitMorona(ctxGeo)) {
    banner.innerHTML += `
      <div class="mt-2 tm-visit-box">
        <div class="small mb-2">Mientras tanto, puedes explorar Morona:</div>
        <button id="btn-explore-morona" class="btn btn-outline-primary w-100">
          🧭 Explorar Morona
        </button>
      </div>
    `;
    wireExploreMorona();
  }

  // Cuando ya hay ubicación detectada, mostrar y habilitar el select
  if (category) {
    category.disabled = false;
    category.classList.remove("d-none");
    category.value = "";
  }
}

/**
 * Oculta hide detected facade on place selection cuando deja de ser necesario.
 */
function hideDetectedFacadeOnPlaceSelection() {
  if (!bannerWrap) return;
  const banner = bannerWrap.querySelector("#loc-banner");
  if (!banner) return;
  const isSuccessBanner = banner.classList.contains("alert-success");
  if (!isSuccessBanner) return;
  bannerWrap.innerHTML = "";
}

/**
 * Oculta hide detected facade on category change cuando deja de ser necesario.
 */
function hideDetectedFacadeOnCategoryChange() {
  if (!bannerWrap) return;
  const banner = bannerWrap.querySelector("#loc-banner");
  if (!banner) return;
  if (banner.classList.contains("alert-success")) bannerWrap.innerHTML = "";
}

/* ================= Manual routing module ================= */
const manual = createManualRouting({
  map,
  extraEl: extra,

  getUserLoc: () => getUserLocation(),

  getActivePlace: () => activePlace,
  setActivePlace: (p) => { activePlace = p; setActivePlaceAction(p); },

  getMode: () => getMode(),
  setMode: (m) => setTravelMode(m),

  clearMarkers,
  clearRoute,
  clearTransportLayers,
  drawRoute,
  drawRouteToPoint,
  planAndShowBusStops,

  getCtxGeo,
  refreshLayersOverlays,
  clearRouteInfo,

  detectPointContext,

  onManualDestinationSelected: (place) => {
    stopTripTracking(true);
    activePlace = null;
    setActivePlaceAction(null);
    showTripStartForDropdownSelection(place, "manual");
  },

  onManualModeSelected: () => {
    if (!tripTracker.place) return;
    tripTracker.modeSelected = true;
    renderTripButton();
    setTimeout(() => renderTripButton(), 150);
    setTimeout(() => renderTripButton(), 700);
  }
});

/* ================= Layers UI init ================= */
function initMapControls() {
  if (layersUI) return;

  layersUI = initLayersUI({
    map,
    baseLayers,
    overlays: {
      "📌 Lugares": markersLayer,
      "Barrios": barriosOverlay,
      "Parroquias": parroquiasOverlay
    },
    onMyLocation: () => {
      const loc = getUserLocation();
      if (!loc) return;
      map.setView(loc, 14);
      if (userMarker) userMarker.openPopup();
    }
  });

  initTerritorialOverlayEvents();
  refreshLayersOverlays();

  installMapContextMenu(map, {
    onDirectionsFromHere: (latlng) => manual.setManualStartPoint(latlng),
    onDirectionsToHere: (latlng) => manual.setManualDestination(latlng),
    onClearDirections: () => clearDirections(),
     onClearMap: () => clearFullMapAndPanel(),
    onCenterHere: (latlng) => map.setView(latlng, map.getZoom())
  });
}

showLocatingBanner();
initMapControls();

/* ================= WEATHER: update on map move ================= */
let lastWeatherCenter = null;
let weatherMoveTimer = null;

/**
 * Gestiona distance meters dentro del flujo principal del modulo.
 */
function distanceMeters(a, b) {
  const R = 6371000;
  /**
   * Gestiona to rad dentro del flujo principal del modulo.
   */
  const toRad = (d) => (d * Math.PI) / 180;

  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lng - a.lng);

  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;

  return 2 * R * Math.asin(Math.sqrt(s));
}

/**
 * Inicializa install weather on map move y deja sus eventos o elementos listos para usarse.
 */
function installWeatherOnMapMove() {
  if (!map) return;

  /**
   * Gestiona handler dentro del flujo principal del modulo.
   */
  const handler = () => {
    if (weatherMoveTimer) clearTimeout(weatherMoveTimer);

    weatherMoveTimer = setTimeout(async () => {
      const c = map.getCenter();
      if (!c) return;

      if (!lastWeatherCenter) {
        lastWeatherCenter = { lat: c.lat, lng: c.lng };
        await updateWeatherBadge(c.lat, c.lng);
        return;
      }

      const moved = distanceMeters(lastWeatherCenter, { lat: c.lat, lng: c.lng });

      if (moved < 300) return;

      lastWeatherCenter = { lat: c.lat, lng: c.lng };
      await updateWeatherBadge(c.lat, c.lng);
    }, 900);
  };

  map.on("moveend", handler);
  map.on("zoomend", handler);
}

installWeatherOnMapMove();

/* ================= GEOLOC ================= */
const USE_TEST_LOCATION = false;
const TEST_LOCATION = [-2.53699, -78.16339];

/**
 * Gestiona after locate dentro del flujo principal del modulo.
 */
async function afterLocate(loc) {
  updateUserLocation(loc);

  map.setView(loc, 14);
  setUserMarker(loc, true);

  const res = await detectAdminContextFromLatLng(loc);
  detectedAdmin = res.detectedAdmin;
  ctxGeo = res.ctxGeo;

  if (forceVirtualMoronaNext) {
    forceVirtualMoronaNext = false;
    ctxGeo.virtualMorona = true;
    ctxGeo.busEnabled = true;
    ctxGeo.entornoUser = "urbano";
  } else {
    ctxGeo.virtualMorona = false;

    try {
      const okBus = await hasBusCoverage({ map, userLoc: loc, destLoc: loc });
      ctxGeo.busEnabled = !!okBus;
    } catch {
      ctxGeo.busEnabled = false;
    }
  }

  showDetectedFacade();

  if (String(detectedAdmin?.provincia || "").trim() && String(detectedAdmin?.canton || "").trim()) {
    enableCategoryUI();
  }

  refreshLayersOverlays();

  await refreshWeatherFromCenterOrUser();

  startWeatherAutoRefresh(() => {
    const c = map.getCenter?.();
    if (c && typeof c.lat === "number" && typeof c.lng === "number") return [c.lat, c.lng];
    const u = getUserLocation?.();
    return u || null;
  }, 5);
}

if (USE_TEST_LOCATION) {
  afterLocate(TEST_LOCATION);
} else {
  requestInitialLocation(
    async pos => afterLocate([pos.coords.latitude, pos.coords.longitude]),
    error => {
      if (!bannerWrap) return;
      const locationMessage = error?.code === 1
        ? "El permiso de ubicación está desactivado. Puedes habilitarlo en los permisos del sitio o explorar Morona sin GPS."
        : error?.code === 3
          ? "La ubicación tardó demasiado. Revisa que el GPS esté activo o explora Morona sin GPS."
          : "No pudimos obtener tu ubicación. Puedes explorar Morona sin GPS.";
      bannerWrap.innerHTML = `
        <div id="loc-banner" class="alert alert-info py-2 mb-2">
          <b>📍 Ubicación no disponible</b><br>
          <div class="mt-1">${locationMessage}</div>
          <div class="mt-2 tm-visit-box">
            <div class="small mb-2">Mientras tanto, puedes explorar Morona:</div>
            <button id="btn-visit-morona" class="btn btn-primary w-100">
              🧭 Visitar Morona
            </button>
          </div>
        </div>
      `;

      const btn = document.getElementById("btn-visit-morona");
      if (btn) {
        btn.onclick = async () => {
          forceVirtualMoronaNext = true;
          applyVisitMorona({
            setUserLocation: updateUserLocation,
            map,
            onAfterSet: async (loc2) => {
              await afterLocate(loc2);
            }
          });
        };
      }

      refreshWeatherFromCenterOrUser();
      startWeatherAutoRefresh(() => {
        const c = map.getCenter?.();
        if (c && typeof c.lat === "number" && typeof c.lng === "number") return [c.lat, c.lng];
        return null;
      }, 5);
    }
  );
}

/* =====================================================
   HELPERS: TERMINALES / PLACES FAKE / NORMALIZACIÓN
===================================================== */
function requestInitialLocation(onSuccess, onError) {
  if (!navigator.geolocation) {
    onError({ code: 2 });
    return;
  }
  navigator.geolocation.getCurrentPosition(onSuccess, onError, {
    enableHighAccuracy: true,
    timeout: 15000,
    maximumAge: 60000
  });
}

function normLite(s) {
  return String(s || "").trim().toLowerCase();
}

const SEVILLA_MORONA_CANTONS = ["Sevilla Don Bosco", "Morona"];

/**
 * Evalua si is sevilla morona canton para decidir el flujo de la interfaz.
 */
function isSevillaMoronaCanton(value) {
  const v = normLite(value);
  return v === "morona" || v === "sevilla don bosco" || v.includes("sevilla");
}

/**
 * Evalua si uses sevilla morona shared coverage para decidir el flujo de la interfaz.
 */
function usesSevillaMoronaSharedCoverage(ctx = {}) {
  return ctx?.specialSevilla === true || isSevillaMoronaCanton(ctx?.canton);
}

/**
 * Evalua si matches sevilla morona canton para decidir el flujo de la interfaz.
 */
function matchesSevillaMoronaCanton(value) {
  const city = String(value || "").trim();
  return SEVILLA_MORONA_CANTONS.includes(city);
}

/**
 * Gestiona ll from geo point dentro del flujo principal del modulo.
 */
function llFromGeoPoint(gp) {
  if (!gp) return null;

  const lat = gp?.latitude ?? gp?.lat;
  const lng = gp?.longitude ?? gp?.lng;

  if (typeof lat !== "number" || typeof lng !== "number") return null;
  return [lat, lng];
}

/**
 * Construye make place from lat lng para mostrar contenido o preparar datos de la interfaz.
 */
function makePlaceFromLatLng(name, locArr) {
  return {
    nombre: name,
    ubicacion: { latitude: locArr[0], longitude: locArr[1] }
  };
}

/**
 * Obtiene get terminal for canton desde el estado local, la API o los datos cacheados.
 */
async function getTerminalForCanton({ provincia, canton, userLoc } = {}) {
  const lugares = await getCollectionCache("lugares");
  const arr = Array.isArray(lugares) ? lugares : [];

  const p = String(provincia || "").trim();
  const c = String(canton || "").trim();
  const sharedCoverage = isSevillaMoronaCanton(c);

  const candidates = arr.filter(l => {
    if (l?.activo === false) return false;
    const sub = normLite(l?.subcategoria);
    if (sub !== "terminal") return false;
    if (p && String(l?.provincia || "").trim() !== p) return false;

    const city = String(l?.ciudad || "").trim();
    if (sharedCoverage) {
      if (!matchesSevillaMoronaCanton(city)) return false;
    } else if (c && city !== c) {
      return false;
    }

    return true;
  });

  if (!candidates.length) return null;

  let best = null;
  for (const t of candidates) {
    const ll = llFromGeoPoint(t?.ubicacion);
    if (!ll) continue;
    const d = (userLoc && map?.distance) ? map.distance(userLoc, ll) : Infinity;
    if (!best || d < best.distM) best = { doc: t, distM: d, ll };
  }
  return best ? { doc: best.doc, ll: best.ll } : null;
}

/**
 * Obtiene get terminal for provincia destino desde el estado local, la API o los datos cacheados.
 */
async function getTerminalForProvinciaDestino({ provinciaDestino, userLoc } = {}) {
  const lugares = await getCollectionCache("lugares");
  const arr = Array.isArray(lugares) ? lugares : [];

  const pDest = String(provinciaDestino || "").trim();
  const candidates = arr.filter(l => {
    if (l?.activo === false) return false;
    if (normLite(l?.subcategoria) !== "terminal") return false;
    if (String(l?.provincia || "").trim() !== pDest) return false;
    return true;
  });

  if (!candidates.length) return null;

  let best = null;
  for (const t of candidates) {
    const ll = llFromGeoPoint(t?.ubicacion);
    if (!ll) continue;
    const d = (userLoc && map?.distance) ? map.distance(userLoc, ll) : Infinity;
    if (!best || d < best.distM) best = { doc: t, distM: d, ll };
  }
  return best ? { doc: best.doc, ll: best.ll } : null;
}

/* =====================================================
   UI: BOTONES MODOS + LOGICA DE RUTA "IR A..."
===================================================== */
function buildModesHTML(busEnabled) {
  const busBtnHTML = (busEnabled === true)
    ? `<button type="button" class="btn btn-outline-primary" data-mode="bus" aria-label="Bus" title="Bus" aria-pressed="false">🚌</button>`
    : "";

  return `
    <div class="btn-group w-100 mb-2" role="group" aria-label="Modos de transporte">
      <button type="button" class="btn btn-outline-primary" data-mode="walking" aria-label="Caminar" title="Caminar" aria-pressed="false">🚶</button>
      <button type="button" class="btn btn-outline-primary" data-mode="bicycle" aria-label="Bicicleta" title="Bicicleta" aria-pressed="false">🚴</button>
      <button type="button" class="btn btn-outline-primary" data-mode="motorcycle" aria-label="Moto" title="Moto" aria-pressed="false">🏍️</button>
      <button type="button" class="btn btn-outline-primary" data-mode="driving" aria-label="Auto" title="Auto" aria-pressed="false">🚗</button>
      ${busBtnHTML}
    </div>
  `;
}

/**
 * Construye get mode meta para mostrar contenido o preparar datos de la interfaz.
 */
function getModeMeta(mode) {
  return {
    walking: { icon: "bi-person-walking", label: "Caminar" },
    bicycle: { icon: "bi-bicycle", label: "Bici" },
    motorcycle: { icon: "bi-scooter", label: "Moto" },
    driving: { icon: "bi-car-front-fill", label: "Auto" },
    bus: { icon: "bi-bus-front-fill", label: "Bus" }
  }[mode] || { icon: "bi-signpost-2-fill", label: "Ruta" };
}

/**
 * Actualiza decorate mode button y sincroniza la interfaz con el estado actual.
 */
function decorateModeButton(button) {
  const meta = getModeMeta(button?.dataset?.mode);
  if (!button || button.dataset.decoratedMode === "true") return;
  const group = button.closest(".btn-group");
  if (group) {
    group.classList.add("tm-mode-group");
    group.setAttribute("role", "group");
    group.setAttribute("aria-label", "Modos de transporte");
  }
  button.classList.add("tm-mode-btn");
  button.type = "button";
  button.setAttribute("aria-label", meta.label);
  button.setAttribute("title", meta.label);
  if (!button.hasAttribute("aria-pressed")) button.setAttribute("aria-pressed", "false");
  button.innerHTML = `
    <i class="bi ${meta.icon}" aria-hidden="true"></i>
    <span class="tm-mode-label">${meta.label}</span>
  `;
  button.dataset.decoratedMode = "true";
}

/**
 * Actualiza sync mode buttons y sincroniza la interfaz con el estado actual.
 */
function syncModeButtons(activeMode) {
  document.querySelectorAll("[data-mode]").forEach(button => {
    const isActive = button.dataset.mode === activeMode;
    button.classList.toggle("active", isActive);
    button.setAttribute("aria-pressed", isActive ? "true" : "false");
  });
}

/**
 * Gestiona wire mode buttons dentro del flujo principal del modulo.
 */
function wireModeButtons({ onModeChange } = {}) {
  document.querySelectorAll("[data-mode]").forEach(btn => {
    decorateModeButton(btn);
    btn.onclick = () => {
      const m = btn.dataset.mode;
      const manualTripActive = tripTracker.source === "manual";
      const activeTripLoc = manualTripActive
        ? null
        : (activePlace?.ubicacion || activePlace?.["ubicaci\u00f3n"]);
      if (activePlace && activeTripLoc && !activePlace.ubicacion) activePlace.ubicacion = activeTripLoc;
      const placeForTrip = manualTripActive
        ? tripTracker.place
        : (activeTripLoc ? activePlace : tripTracker.place);

      clearRoutingArtifacts({ preserveManualDestination: manualTripActive });

      if (m === "bus" && ctxGeo.busEnabled !== true) {
        showModal(
          "🚌 Transporte no disponible",
          `
            <div class="alert alert-info py-2 mb-0">
              En esta zona no hay datos registrados para transporte en bus.
              Puedes usar otros modos o presionar <b>Explorar Morona</b>.
            </div>
          `
        );
        setTravelMode("walking");
        onModeChange?.("walking");
        return;
      }

      setTravelMode(m);
      syncModeButtons(m);
      tripTracker.busRouteSelectionPending = m === "bus";
      tripTracker.busRouteReady = false;
      if (tripTracker.busRouteSelectionPending) hideTripStart();
      if (placeForTrip?.ubicacion || placeForTrip?.["ubicaci\u00f3n"]) {
        if (!placeForTrip.ubicacion) placeForTrip.ubicacion = placeForTrip["ubicaci\u00f3n"];
        tripTracker.place = placeForTrip;
        tripTracker.modeSelected = true;
      }
      onModeChange?.(m);
      renderTripButton();
      setTimeout(() => renderTripButton(), 120);
      setTimeout(() => renderTripButton(), 700);
    };
  });
  syncModeButtons(getMode?.() || "walking");
}

/* =====================================================
   EVENTOS: helpers
===================================================== */
function parseDDMMYYYY(s) {
  const m = String(s || "").trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return null;
  const dd = Number(m[1]);
  const mm = Number(m[2]);
  const yy = Number(m[3]);
  if (!Number.isFinite(dd) || !Number.isFinite(mm) || !Number.isFinite(yy)) return null;
  return new Date(yy, mm - 1, dd, 0, 0, 0, 0);
}

/**
 * Inicializa start of today y deja sus eventos o elementos listos para usarse.
 */
function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Evalua si is future event para decidir el flujo de la interfaz.
 */
function isFutureEvent(ev) {
  const fi = parseDDMMYYYY(ev?.fecha_inicio);
  const ff = parseDDMMYYYY(ev?.fecha_fin);
  const end = ff || fi;
  if (!end) return false;
  return end.getTime() >= startOfToday().getTime();
}

/**
 * Gestiona event to place dentro del flujo principal del modulo.
 */
function eventToPlace(ev) {
  return {
    ...ev,
    nombre: ev?.nombre || "Evento",
    telefono: ev?.organizador ? `Organizador: ${ev.organizador}` : "No disponible",
    horario: `${ev?.fecha_inicio || ""} ${ev?.hora_inicio || ""} → ${ev?.fecha_fin || ""} ${ev?.hora_fin || ""}`.trim(),
    ubicacion: ev?.ubicacion,
    popupHTML: buildEventPopupHTML(ev)
  };
}

/**
 * Construye build event popup html para mostrar contenido o preparar datos de la interfaz.
 */
function buildEventPopupHTML(ev) {
  const nombre = ev?.nombre || "Evento";
  const org = ev?.organizador || "No disponible";
  const ent = ev?.entrada || "No disponible";
  const fi = ev?.fecha_inicio || "N/D";
  const ff = ev?.fecha_fin || "N/D";
  const hi = ev?.hora_inicio || "N/D";
  const hf = ev?.hora_fin || "N/D";

  return `
    <b>📅 ${nombre}</b><br>
    👤 ${org}<br>
    🎟️ ${ent}<br>
    🗓️ ${fi} ${hi} → ${ff} ${hf}
  `;
}

/**
 * Construye render event markers para mostrar contenido o preparar datos de la interfaz.
 */
function renderEventMarkers(list, onSelect) {
  renderMarkers(list, onSelect);
}

/* ================= EVENTO CATEGORÍA ================= */
category.onchange = async () => {
  if (!category.value) {
    clearFullMapAndPanel();
    if (bannerWrap) bannerWrap.innerHTML = "";
    return;
  }

  resetMap();
  dataList.length = 0;
  territorialSelectionState = null;

  hideDetectedFacadeOnCategoryChange();


  /**
   * Gestiona current mode dentro del flujo principal del modulo.
   */
  const currentMode = () => getMode?.() || "walking";
  /**
   * Gestiona info box dentro del flujo principal del modulo.
   */
  const infoBox = () => document.getElementById("route-info");

  if (category.value === "ir_provincia") {
    extra.innerHTML = `
      <div class="mb-2">
        <select id="sel-prov-dest" class="form-select">
          <option value="">🧭 Seleccione provincia destino</option>
        </select>
      </div>

      ${buildModesHTML(ctxGeo.busEnabled)}
      <div id="route-info" class="small"></div>
      <div id="trip-actions" class="mt-2 mb-2"></div>
    `;

    const selProv = document.getElementById("sel-prov-dest");
    const provincias = await getProvinciasFS();
    const provActualName = String(ctxGeo.provincia || "").trim();
    const provIndexMap = [];

    (Array.isArray(provincias) ? provincias : []).forEach((p, i) => {
      const name = String(p?.Nombre || p?.nombre || "").trim();
      if (!name) return;
      if (provActualName && name === provActualName) return;
      provIndexMap.push(i);
      selProv.innerHTML += `<option value="${provIndexMap.length - 1}">${name}</option>`;
    });

    /**
     * Gestiona async dentro del flujo principal del modulo.
     */
    const buildIrProvinciaRoute = async () => {
      const idxSel = Number(selProv.value);
      if (!Number.isFinite(idxSel)) return;

      const idxReal = provIndexMap[idxSel];
      const doc = provincias?.[idxReal];
      if (!doc) return;

      const provName = String(doc?.Nombre || doc?.nombre || "").trim();
      const provLoc = llFromGeoPoint(doc?.ubicación || doc?.ubicacion);
      if (!provLoc) {
        showModal("⚠️ Sin ubicación", `<div class="alert alert-warning py-2 mb-0">La provincia seleccionada no tiene ubicación válida.</div>`);
        return;
      }

      const userLoc = getUserLocation();
      if (!userLoc) return;

      clearRoutingArtifacts();

      const termActual = await getTerminalForCanton({
        provincia: ctxGeo.provincia,
        canton: ctxGeo.canton,
        userLoc
      });

      if (!termActual) {
        showModal(
          "⚠️ Terminal no encontrado",
          `
            <div class="alert alert-warning py-2 mb-0">
              No se encontró un <b>Terminal</b> registrado en tu cantón (${ctxGeo.canton}).
              Para “ir a provincia” necesitas el terminal local en la colección <b>lugares</b> (subcategoria = "Terminal").
            </div>
          `
        );
        return;
      }

      const mode = currentMode();

      const termProvDest = await getTerminalForProvinciaDestino({
        provinciaDestino: provName,
        userLoc
      });

      const terminalDestino = termProvDest?.ll || null;
      const targetLoc = terminalDestino || provLoc;

      if (mode === "motorcycle" || mode === "driving") {
        await drawRouteToPoint({
          from: userLoc,
          to: targetLoc,
          mode,
          infoBox: infoBox(),
          title: `Ruta a ${provName}`
        });
        refreshLayersOverlays();
        return;
      }

      if (mode === "walking" || mode === "bicycle") {
        await drawTwoLegOSRM({
          userLoc,
          terminalLoc: termActual.ll,
          targetLoc,
          mode,
          infoBox: infoBox(),
          title: `Ruta vía Terminal → ${provName}`,
          layerTarget: "normal"
        });
        refreshLayersOverlays();
        return;
      }

      if (mode === "bus") {
        const p1 = makePlaceFromLatLng("Terminal (origen)", termActual.ll);

        await planAndShowBusStops(userLoc, p1, {
          entornoUser: ctxGeo.entornoUser,
          preserveLayers: false
        }, { infoEl: infoBox() });

        clearInterprov();

        await drawRouteBetweenPoints({
          from: termActual.ll,
          to: targetLoc,
          mode: "driving",
          layerGroup: interprovOverlay
        });

        refreshLayersOverlays();
      }
    };

    selProv.onchange = () => {
      clearRoutingArtifacts();
      buildIrProvinciaRoute();
    };

    wireModeButtons({
      onModeChange: () => buildIrProvinciaRoute()
    });

    return;
  }

  if (category.value === "ir_canton") {
    extra.innerHTML = `
      <div class="mb-2">
        <select id="sel-canton-dest" class="form-select">
          <option value="">🧭 Seleccione cantón destino</option>
        </select>
      </div>

      ${buildModesHTML(ctxGeo.busEnabled)}
      <div id="route-info" class="small"></div>
      <div id="trip-actions" class="mt-2 mb-2"></div>
    `;

    const selCanton = document.getElementById("sel-canton-dest");

    const provincias = await getProvinciasFS();
    const provActualName = String(ctxGeo.provincia || "").trim();

    const provActualDoc = (Array.isArray(provincias) ? provincias : []).find(p => {
      const nm = String(p?.Nombre || p?.nombre || "").trim();
      return nm === provActualName;
    });

    const codigoProv = String(provActualDoc?.codigo || provActualDoc?.Codigo || provActualDoc?.codigo_provincia || "").trim();

    const cantones = codigoProv
      ? await getCantonesFSByCodigoProvincia(codigoProv)
      : [];

    if (!codigoProv) {
      showModal(
        "⚠️ Falta código de provincia",
        `
          <div class="alert alert-warning py-2 mb-0">
            No se pudo determinar el <b>codigo</b> de la provincia actual (${provActualName}) desde la colección <b>provincias</b>.
            Para “ir a cantón” se necesita que los docs de provincias tengan el campo <b>codigo</b>.
          </div>
        `
      );
    }

    const cantonActualName = String(ctxGeo.canton || "").trim();

    const cantonIndexMap = [];
    (Array.isArray(cantones) ? cantones : []).forEach((c, i) => {
      const name = String(c?.nombre || c?.Nombre || "").trim();
      if (!name) return;
      if (cantonActualName && name === cantonActualName) return;
      cantonIndexMap.push(i);
      selCanton.innerHTML += `<option value="${cantonIndexMap.length - 1}">${name}</option>`;
    });

    /**
     * Gestiona async dentro del flujo principal del modulo.
     */
    const buildIrCantonRoute = async () => {
      const idxSel = Number(selCanton.value);
      if (!Number.isFinite(idxSel)) return;

      const idxReal = cantonIndexMap[idxSel];
      const doc = cantones?.[idxReal];
      if (!doc) return;

      const cantonName = String(doc?.nombre || doc?.Nombre || "").trim();
      const cantonLoc = llFromGeoPoint(doc?.ubicación || doc?.ubicacion);
      if (!cantonLoc) {
        showModal("⚠️ Sin ubicación", `<div class="alert alert-warning py-2 mb-0">El cantón seleccionado no tiene ubicación válida.</div>`);
        return;
      }

      const userLoc = getUserLocation();
      if (!userLoc) return;

      clearRoutingArtifacts();

      const termActual = await getTerminalForCanton({
        provincia: ctxGeo.provincia,
        canton: ctxGeo.canton,
        userLoc
      });

      if (!termActual) {
        showModal(
          "⚠️ Terminal no encontrado",
          `
            <div class="alert alert-warning py-2 mb-0">
              No se encontró un <b>Terminal</b> registrado en tu cantón (${ctxGeo.canton}).
              Para “ir a cantón” necesitas el terminal local en <b>lugares</b> (subcategoria="Terminal").
            </div>
          `
        );
        return;
      }

      const termCantonDest = await getTerminalForCanton({
        provincia: ctxGeo.provincia,
        canton: cantonName,
        userLoc
      });

      const terminalDestino = termCantonDest?.ll || null;
      const targetLoc = terminalDestino || cantonLoc;

      const mode = currentMode();

      if (mode === "motorcycle" || mode === "driving") {
        await drawRouteToPoint({
          from: userLoc,
          to: targetLoc,
          mode,
          infoBox: infoBox(),
          title: `Ruta a ${cantonName}`
        });
        refreshLayersOverlays();
        return;
      }

      if (mode === "walking" || mode === "bicycle") {
        await drawTwoLegOSRM({
          userLoc,
          terminalLoc: termActual.ll,
          targetLoc,
          mode,
          infoBox: infoBox(),
          title: `Ruta vía Terminal → ${cantonName}`,
          layerTarget: "normal"
        });
        refreshLayersOverlays();
        return;
      }

      if (mode === "bus") {
        const p1 = makePlaceFromLatLng("Terminal (origen)", termActual.ll);

        await planAndShowBusStops(userLoc, p1, {
          entornoUser: ctxGeo.entornoUser,
          preserveLayers: false
        }, { infoEl: infoBox() });

        clearInterprov();

        await drawRouteBetweenPoints({
          from: termActual.ll,
          to: targetLoc,
          mode: "driving",
          layerGroup: interprovOverlay
        });

        refreshLayersOverlays();
      }
    };

    selCanton.onchange = () => {
      clearRoutingArtifacts();
      buildIrCantonRoute();
    };

    wireModeButtons({
      onModeChange: () => buildIrCantonRoute()
    });

    return;
  }

  if (category.value === "barrios" || category.value === "parroquias_geoportal") {
    const territorialType = category.value === "barrios" ? "barrios" : "parroquias";
    const label = territorialType === "barrios" ? "barrio" : "parroquia";
    const labelPlural = territorialType === "barrios" ? "barrios" : "parroquias";
    const icon = territorialType === "barrios" ? "🗺️" : "🏘️";

    extra.innerHTML = `
      <div class="tm-loading mb-2" role="status" aria-live="polite">
        <span class="tm-loading__spinner" aria-hidden="true"></span>
        <span>
          <span class="tm-loading__title">Cargando ${labelPlural}</span>
          <span class="tm-loading__text">Consultando capa territorial del Geoportal Morona.</span>
        </span>
      </div>
    `;

    let territorialData = null;
    try {
      territorialData = await getTerritorialLayer(territorialType);
    } catch (error) {
      console.error(`No se pudo cargar ${labelPlural}:`, error);
      showModal(
        "Capa no disponible",
        `
          <div class="alert alert-warning py-2 mb-0">
            No se pudo cargar la capa de <b>${labelPlural}</b> desde el Geoportal Morona.
            Intenta nuevamente en unos minutos.
          </div>
        `
      );
      extra.innerHTML = "";
      return;
    }

    const places = territorialData.places || [];
    if (!places.length) {
      showModal(
        "Sin datos territoriales",
        `
          <div class="alert alert-info py-2 mb-0">
            La capa de <b>${labelPlural}</b> no devolvió elementos para mostrar.
          </div>
        `
      );
      extra.innerHTML = "";
      return;
    }

    dataList.push(...withMarkerEmoji(places, icon));

    const selectTerritorialPlace = (place, { showTripButton = true } = {}) => {
      if (!place?.ubicacion) return;
      stopTripTracking(true);
      clearRoutingArtifacts();
      activePlace = place;
      setActivePlaceAction(activePlace);
      hideDetectedFacadeOnPlaceSelection();
      showTripStartForDropdownSelection(activePlace, "territorial");
      rebuildSelectedRoute({ showTripButton });
    };

    const otherOverlay = territorialType === "barrios" ? parroquiasOverlay : barriosOverlay;
    try {
      otherOverlay.clearLayers();
      map.removeLayer(otherOverlay);
    } catch {}

    const selectTerritorialFeature = (feature) => {
      const place = territorialFeatureToPlace(feature, territorialType);
      if (!place) return;

      const code = String(place.codigo_territorial || "");
      const idx = dataList.findIndex(item => String(item.codigo_territorial || "") === code);
      const sel = document.getElementById("lugares");
      if (sel && idx >= 0) sel.value = String(idx);

      selectTerritorialPlace(idx >= 0 ? dataList[idx] : place);
    };

    territorialSelectionState = {
      type: territorialType,
      onFeatureClick: selectTerritorialFeature
    };

    renderTerritorialLayer(territorialData.geojson, {
      type: territorialType,
      onFeatureClick: selectTerritorialFeature
    });
    setTimeout(() => layersUI?.syncOverlayStates?.(), 0);

    extra.innerHTML = `
      <select id="lugares" class="form-select mb-2">
        <option value="">${icon} Seleccione ${label}</option>
      </select>

      <button id="near" class="btn btn-primary w-100 mb-2">
        📏 ${label.charAt(0).toUpperCase() + label.slice(1)} más cercano
      </button>

      ${buildModesHTML(true)}
      <div id="route-info" class="small"></div>
      <div id="trip-actions" class="mt-2 mb-2"></div>
    `;

    const sel = document.getElementById("lugares");
    dataList.forEach((place, index) => {
      sel.innerHTML += `<option value="${index}">${place.nombre || label}</option>`;
    });

    sel.onchange = () => {
      const place = dataList[sel.value];
      if (!place) return;
      selectTerritorialPlace(place, { showTripButton: true });
    };

    document.getElementById("near").onclick = () => {
      const place = findNearest(dataList);
      if (!place) return;
      const idx = dataList.indexOf(place);
      if (idx >= 0) sel.value = String(idx);
      selectTerritorialPlace(place);
    };

    wireModeButtons({
      onModeChange: () => {
        if (activePlace) rebuildSelectedRoute();
      }
    });

    refreshLayersOverlays();
    return;
  }

  if (category.value === "Alimentacion") {
    const tipos = await getTiposComidaFromLugar({
      provincia: ctxGeo.provincia,
      canton: ctxGeo.canton,
      specialSevilla: usesSevillaMoronaSharedCoverage(ctxGeo)
    });

    extra.innerHTML = `
      <select id="sel-tipo-comida" class="form-select mb-2">
        <option value="">🍴 Tipo de comida</option>
      </select>

      <select id="lugares" class="form-select mb-2" disabled>
        <option value="">📍 Seleccione lugar</option>
      </select>

      <button id="near" class="btn btn-primary w-100 mb-2" disabled>
        📏 Lugar más cercano
      </button>

      ${buildModesHTML(ctxGeo.busEnabled)}
      <div id="route-info" class="small"></div>
      <div id="trip-actions" class="mt-2 mb-2"></div>
    `;

    const selTipo = document.getElementById("sel-tipo-comida");
    const selLug = document.getElementById("lugares");
    const btnNear = document.getElementById("near");

    (Array.isArray(tipos) ? tipos : []).forEach(t => {
      const name = String(t || "").trim();
      if (!name) return;
      selTipo.innerHTML += `<option value="${name}">${name}</option>`;
    });

    /**
     * Gestiona async dentro del flujo principal del modulo.
     */
    const renderByTipo = async () => {
      const tipo = String(selTipo.value || "").trim();
      dataList.length = 0;
      clearMarkers();
      clearRoutingArtifacts();

      selLug.innerHTML = `<option value="">📍 Seleccione lugar</option>`;
      selLug.disabled = true;
      btnNear.disabled = true;

      if (!tipo) return;

      const lugares = await getCollectionCache("lugares");
      const arr = Array.isArray(lugares) ? lugares : [];

      const provSel = String(ctxGeo.provincia || "");
      const cantonSel = String(ctxGeo.canton || "");
      const tipoSel = tipo;

      const base = arr.filter(l => {
        if (!l?.activo) return false;
        if (String(l.provincia || "") !== provSel) return false;
        if (normLite(l.subcategoria) !== "alimentacion") return false;
        if (String(l.tipocomida || "").trim() !== tipoSel) return false;
        return true;
      });

      const filtered = [];

      if (usesSevillaMoronaSharedCoverage(ctxGeo)) {
        base.forEach(l => {
          const ciudad = String(l.ciudad || "");
          if (matchesSevillaMoronaCanton(ciudad)) filtered.push(l);
        });
      } else {
        base.forEach(l => {
          const ciudad = String(l.ciudad || "");
          if (ciudad === cantonSel) filtered.push(l);
        });
      }

      if (!filtered.length) {
        showModal(
          "📍 Sin resultados",
          `
            <div class="alert alert-info py-2 mb-0">
              No hay restaurantes con <b>${tipoSel}</b> registrados en esta zona.
            </div>
          `
        );
        return;
      }

      filtered.sort((a, b) => {
        const ap = String(a.parroquia || "");
        const bp = String(b.parroquia || "");
        const pc = ap.localeCompare(bp);
        if (pc !== 0) return pc;
        return String(a.nombre || "").localeCompare(String(b.nombre || ""));
      });

      dataList.push(...withMarkerEmoji(filtered, getCategoryOptionEmoji("Alimentacion") || "??"));

      dataList.forEach((l, i) => {
        const par = l.parroquia ? `(${l.parroquia})` : "(sin parroquia)";
        selLug.innerHTML += `<option value="${i}">${l.nombre || "Lugar"} ${par}</option>`;
      });

      selLug.disabled = false;
      btnNear.disabled = false;

      renderMarkers(dataList, place => {
        stopTripTracking(true);
        clearRoutingArtifacts();
        activePlace = place;
        setActivePlaceAction(place);
        hideDetectedFacadeOnPlaceSelection();
        rebuildSelectedRoute();
      });

      selLug.onchange = () => {
        stopTripTracking(true);
        clearRoutingArtifacts();
        activePlace = dataList[selLug.value];
        setActivePlaceAction(activePlace);
        if (!activePlace) return;
        hideDetectedFacadeOnPlaceSelection();
        showTripStartForDropdownSelection(activePlace);
        rebuildSelectedRoute({ showTripButton: true });
      };

      btnNear.onclick = () => {
        stopTripTracking(true);
        clearRoutingArtifacts();
        activePlace = findNearest(dataList);
        setActivePlaceAction(activePlace);
        if (!activePlace) return;
        hideDetectedFacadeOnPlaceSelection();
        rebuildSelectedRoute();
      };

      wireModeButtons({
        onModeChange: () => {
        if (activePlace) {
            rebuildSelectedRoute();
        }
        }
      });
    };

    selTipo.onchange = renderByTipo;

    wireModeButtons({
      onModeChange: () => {
        if (activePlace) {
          rebuildSelectedRoute();
        }
      }
    });

    return;
  }

  if (category.value === "eventos" || category.value === "eventosms") {
    const provSel = String(ctxGeo.provincia || "");
    const cantonSel = String(ctxGeo.canton || "");
    const parroquiaSel = String(ctxGeo.parroquia || "");

    const eventos = await getCollectionCache("eventos");
    const arr = Array.isArray(eventos) ? eventos : [];

    let filtered = arr.filter(ev => {
      if (!ev?.ubicacion) return false;
      if (String(ev.provincia || "") !== provSel) return false;

      if (usesSevillaMoronaSharedCoverage(ctxGeo)) {
        const c = String(ev.canton || ev.ciudad || "");
        if (!matchesSevillaMoronaCanton(c)) return false;
      } else {
        const c = String(ev.canton || ev.ciudad || "");
        if (c !== cantonSel) return false;
      }

      if (parroquiaSel && String(ev.parroquia || "") !== parroquiaSel) {
        // no bloquea
      }

      if (!isFutureEvent(ev)) return false;
      return true;
    });

    if (!filtered.length) {
      showModal(
        "📅 Sin eventos futuros",
        `
          <div class="alert alert-info py-2 mb-2">
            No hay <b>eventos futuros</b> registrados en esta zona.
          </div>
          <div class="small">
            Revisa que tus documentos tengan <b>fecha_inicio/fecha_fin</b> en formato <b>DD/MM/YYYY</b>.
          </div>
        `
      );
      extra.innerHTML = "";
      return;
    }

    filtered.sort((a, b) => {
      const ap = String(a.parroquia || "");
      const bp = String(b.parroquia || "");
      if (parroquiaSel) {
        const ak = (ap === parroquiaSel) ? 0 : 1;
        const bk = (bp === parroquiaSel) ? 0 : 1;
        if (ak !== bk) return ak - bk;
      }

      const afi = parseDDMMYYYY(a.fecha_inicio)?.getTime() ?? Infinity;
      const bfi = parseDDMMYYYY(b.fecha_inicio)?.getTime() ?? Infinity;
      if (afi !== bfi) return afi - bfi;

      return String(a.nombre || "").localeCompare(String(b.nombre || ""));
    });

    const places = filtered.map(eventToPlace);
    dataList.push(...withMarkerEmoji(places, "\uD83D\uDCC5"));

    const busBtnHTML = (ctxGeo.busEnabled === true)
      ? `<button class="btn btn-outline-primary" data-mode="bus">🚌</button>`
      : "";

    extra.innerHTML = `
      <select id="lugares" class="form-select mb-2">
        <option value="">📅 Seleccione evento</option>
      </select>

      <button id="near" class="btn btn-primary w-100 mb-2">
        📏 Evento más cercano
      </button>

      <div class="btn-group w-100 mb-2">
        <button class="btn btn-outline-primary" data-mode="walking">🚶</button>
        <button class="btn btn-outline-primary" data-mode="bicycle">🚴</button>
        <button class="btn btn-outline-primary" data-mode="motorcycle">🏍️</button>
        <button class="btn btn-outline-primary" data-mode="driving">🚗</button>
        ${busBtnHTML}
      </div>

      <div id="route-info" class="small"></div>
      <div id="trip-actions" class="mt-2 mb-2"></div>
    `;

    const sel = document.getElementById("lugares");
    dataList.forEach((ev, i) => {
      const when = `${ev?.fecha_inicio || ""} ${ev?.hora_inicio || ""}`.trim();
      const par = ev?.parroquia ? `(${ev.parroquia})` : "";
      sel.innerHTML += `<option value="${i}">${ev.nombre || "Evento"} ${par} ${when ? `- ${when}` : ""}</option>`;
    });

    renderEventMarkers(dataList, (ev) => {
      stopTripTracking(true);
      clearRoutingArtifacts();
      activePlace = ev;
      setActivePlaceAction(activePlace);
      hideDetectedFacadeOnPlaceSelection();
      rebuildSelectedRoute();
    });

    sel.onchange = () => {
      stopTripTracking(true);
      clearRoutingArtifacts();
      activePlace = dataList[sel.value];
      setActivePlaceAction(activePlace);
      if (!activePlace) return;
      hideDetectedFacadeOnPlaceSelection();
      showTripStartForDropdownSelection(activePlace);
      rebuildSelectedRoute({ showTripButton: true });
    };

    document.getElementById("near").onclick = () => {
      stopTripTracking(true);
      clearRoutingArtifacts();
      activePlace = findNearest(dataList);
      setActivePlaceAction(activePlace);
      if (!activePlace) return;
      hideDetectedFacadeOnPlaceSelection();
      rebuildSelectedRoute();
    };

    wireModeButtons({
      onModeChange: () => {
      if (activePlace) {
          rebuildSelectedRoute();
      }
      }
    });

    return;
  }

  if (category.value === "transporte_lineas") {
    extra.innerHTML = `
      <select id="tipo" class="form-select mb-2">
        <option value="">🚍 Tipo de transporte</option>
        <option value="urbano">Urbano</option>
        <option value="rural">Rural</option>
      </select>

      <div id="lineas"></div>
    `;

    const tipoSel = document.getElementById("tipo");
    const lineasContainer = document.getElementById("lineas");

    tipoSel.onchange = async e => {
      const tipo = e.target.value;
      lineasContainer.innerHTML = "";
      if (!tipo) return;

      clearRoutingArtifacts();

      const now = new Date();

      const allLineas = await getLineasByTipoAll(tipo, {
        provincia: ctxGeo.provincia,
        canton: ctxGeo.canton,
        parroquia: ctxGeo.parroquia,
        specialSevilla: usesSevillaMoronaSharedCoverage(ctxGeo),
        ignoreGeoFilter: (tipo === "rural" && usesSevillaMoronaSharedCoverage(ctxGeo))
      });

      const fuera = allLineas
        .filter(l => !isLineOperatingNow(l, now))
        .sort((a, b) => (Number(a.orden) || 0) - (Number(b.orden) || 0));

      if (fuera.length) {
        const hh = String(now.getHours()).padStart(2, "0");
        const mm = String(now.getMinutes()).padStart(2, "0");
        const items = fuera.map(l => `• <b>${l.codigo}</b> - ${l.nombre || ""}`).join("<br>");

        showModal(
          "⛔ Fuera de servicio ahora",
          `
            <div class="alert alert-warning py-2 mb-2">
              <b>Fuera de servicio ahora</b> (hora actual ${hh}:${mm}):<br><br>
              ${items}
              <div class="small mt-2">* Horarios referenciales (aprox.).</div>
            </div>
          `
        );
      }

      await cargarLineasTransporte(tipo, lineasContainer, {
        provincia: ctxGeo.provincia,
        canton: ctxGeo.canton,
        parroquia: ctxGeo.parroquia,
        specialSevilla: usesSevillaMoronaSharedCoverage(ctxGeo),
        ignoreGeoFilter: (tipo === "rural" && usesSevillaMoronaSharedCoverage(ctxGeo)),
        now
      });

      refreshLayersOverlays();
    };

    return;
  }

  const lugares = await getCollectionCache("lugares");
  const all = [];

  const provSel = ctxGeo.provincia;
  const cantonSel = ctxGeo.canton;
  const parroquiaSel = ctxGeo.parroquia;
  const catSel = String(category.value || "").toLowerCase();

  const base = (Array.isArray(lugares) ? lugares : []).filter(l => {
    if (!l?.activo) return false;
    if (String(l.provincia || "") !== String(provSel || "")) return false;
    if (String(l.subcategoria || "").toLowerCase() !== catSel) return false;
    return true;
  });

  if (usesSevillaMoronaSharedCoverage(ctxGeo)) {
    base.forEach(l => {
      const ciudad = String(l.ciudad || "");
      if (matchesSevillaMoronaCanton(ciudad)) all.push(l);
    });
  } else {
    base.forEach(l => {
      const ciudad = String(l.ciudad || "");
      if (ciudad === cantonSel) all.push(l);
    });
  }

  if (!all.length) {
    showModal(
      "📍 Sin cobertura por ahora",
      `
        <div class="alert alert-info py-2 mb-2">
          <b>De momento no hay datos registrados en la zona</b> para esta categoría.
        </div>
        <div class="small">
          Pronto habrá cobertura. Puedes probar otra categoría.
        </div>
      `
    );
    extra.innerHTML = "";
    return;
  }

  all.sort((a, b) => {
    const aCity = String(a.ciudad || "");
    const bCity = String(b.ciudad || "");

    if (usesSevillaMoronaSharedCoverage(ctxGeo)) {
      const aKey = (aCity === "Sevilla Don Bosco") ? 0 : 1;
      const bKey = (bCity === "Sevilla Don Bosco") ? 0 : 1;
      if (aKey !== bKey) return aKey - bKey;
    }

    const aPar = String(a.parroquia || "");
    const bPar = String(b.parroquia || "");

    if (parroquiaSel) {
      const aKey = (aPar === parroquiaSel) ? 0 : 1;
      const bKey = (bPar === parroquiaSel) ? 0 : 1;
      if (aKey !== bKey) return aKey - bKey;
    }

    const pCmp = aPar.localeCompare(bPar);
    if (pCmp !== 0) return pCmp;

    return String(a.nombre || "").localeCompare(String(b.nombre || ""));
  });

  dataList.push(...withMarkerEmoji(all, getCategoryOptionEmoji(category.value)));

  const busBtnHTML = (ctxGeo.busEnabled === true)
    ? `<button class="btn btn-outline-primary" data-mode="bus">🚌</button>`
    : "";

  extra.innerHTML = `
    <select id="lugares" class="form-select mb-2">
      <option value="">📍 Seleccione lugar</option>
    </select>

    <button id="near" class="btn btn-primary w-100 mb-2">
      📏 Lugar más cercano
    </button>

    <div class="btn-group w-100 mb-2">
      <button class="btn btn-outline-primary" data-mode="walking">🚶</button>
      <button class="btn btn-outline-primary" data-mode="bicycle">🚴</button>
      <button class="btn btn-outline-primary" data-mode="motorcycle">🏍️</button>
      <button class="btn btn-outline-primary" data-mode="driving">🚗</button>
      ${busBtnHTML}
    </div>

    <div id="route-info" class="small"></div>
    <div id="trip-actions" class="mt-2 mb-2"></div>
  `;

  const sel = document.getElementById("lugares");
  dataList.forEach((l, i) => {
    const par = l.parroquia ? `(${l.parroquia})` : "(sin parroquia)";
    sel.innerHTML += `<option value="${i}">${l.nombre || "Lugar"} ${par}</option>`;
  });

  renderMarkers(dataList, place => {
    stopTripTracking(true);
    clearRoutingArtifacts();
    activePlace = place;
    setActivePlaceAction(place);
    hideDetectedFacadeOnPlaceSelection();
    rebuildSelectedRoute();
  });

  sel.onchange = () => {
    stopTripTracking(true);
    clearRoutingArtifacts();
    activePlace = dataList[sel.value];
    setActivePlaceAction(activePlace);
    if (!activePlace) return;
    hideDetectedFacadeOnPlaceSelection();
    showTripStartForDropdownSelection(activePlace);
    rebuildSelectedRoute({ showTripButton: true });
  };

  document.getElementById("near").onclick = () => {
    stopTripTracking(true);
    clearRoutingArtifacts();
    activePlace = findNearest(dataList);
    setActivePlaceAction(activePlace);
    if (!activePlace) return;
    hideDetectedFacadeOnPlaceSelection();
    rebuildSelectedRoute();
  };

  wireModeButtons({
    onModeChange: () => {
    if (activePlace) {
        rebuildSelectedRoute();
    }
    }
  });
};
/**
 * Limpia clear full map and panel para dejar la vista o el estado listo para otro flujo.
 */
function clearFullMapAndPanel() {
  stopTripTracking(true);
  try { clearMarkers(); } catch {}
  try { clearTerritorialLayer(); } catch {}
  try { clearRoutingArtifacts(); } catch {}
  try { clearInterprov(); } catch {}
  try { manual.clearManualDest(); } catch {}
  try { manual.clearManualStart(); } catch {}

  activePlace = null;
  setActivePlaceAction(null);
  dataList.length = 0;

  if (extra) extra.innerHTML = "";

  const infoBox = document.getElementById("info-box");
  if (infoBox) infoBox.innerHTML = "";

  if (category) category.value = "";
  categoryPicker.sync();

  if (bannerWrap) bannerWrap.innerHTML = "";
  refreshLayersOverlays();
}

