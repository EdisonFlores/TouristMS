// js/app/helpers.js

export function hidePlacesUI(extraControls) {
  extraControls.innerHTML = "";
  extraControls.classList.add("d-none");
}

export function resetCategory(categorySelect) {
  categorySelect.value = "";
  categorySelect.classList.add("d-none");
}

export function resetCanton(cantonSelect) {
  cantonSelect.value = "";
  cantonSelect.innerHTML = `<option value="">🏙️ Seleccione cantón</option>`;
  cantonSelect.disabled = true;
}

export function resetParroquia(parroquiaSelect) {
  parroquiaSelect.value = "";
  parroquiaSelect.innerHTML = `<option value="">🏘️ Seleccione parroquia</option>`;
  parroquiaSelect.classList.add("d-none");
  parroquiaSelect.disabled = true;
}

export function clearRouteInfo(infoBox) {
  infoBox.innerHTML = "";
}

export function resetAllUI({
  cantonSelect,
  parroquiaSelect,
  categorySelect,
  extraControls,
  infoBox,
  clearMarkers
}) {
  resetCanton(cantonSelect);
  resetParroquia(parroquiaSelect);
  resetCategory(categorySelect);
  hidePlacesUI(extraControls);
  clearMarkers();
  clearRouteInfo(infoBox);
}

export function timeToMinutes(t) {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

export function minutesToTime(m) {
  const h = Math.floor(m / 60) % 24;
  const min = m % 60;
  return `${h.toString().padStart(2, "0")}:${min.toString().padStart(2, "0")}`;
}

/**
 * Convierte segundos a texto realista
 */
export function formatDuration(seconds) {
  if (!Number.isFinite(seconds) || seconds <= 0) return "N/D";

  const s = Math.round(seconds);
  if (s < 60) return `${s} s`;

  const totalMin = Math.round(s / 60);
  if (totalMin < 60) return `${totalMin} min`;

  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;

  if (m === 0) return `${h} h`;
  return `${h} h ${m} min`;
}

/**
 * Parsea "06:00 a 08:00" -> { startMin, endMin }
 */
export function parseHorarioBloque(str) {
  if (!str || typeof str !== "string") return null;
  const clean = str.replace(/\s+/g, " ").trim();
  const parts = clean.split("a").map(s => s.trim());
  if (parts.length !== 2) return null;
  const start = parts[0];
  const end = parts[1];
  if (!start.includes(":") || !end.includes(":")) return null;
  return { startMin: timeToMinutes(start), endMin: timeToMinutes(end) };
}

/**
 * true si es sábado o domingo
 */
export function isWeekend(date = new Date()) {
  const d = date.getDay();
  return d === 0 || d === 6;
}

export function formatDurationFromSeconds(seconds) {
  const s = Math.max(0, Math.round(Number(seconds) || 0));

  if (s < 60) return `${s} s`;

  const totalMin = Math.round(s / 60);

  if (totalMin < 60) return `${totalMin} min`;

  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;

  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}