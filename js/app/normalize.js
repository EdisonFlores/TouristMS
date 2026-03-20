// js/app/normalize.js

export function normalizeString(str) {

  return String(str || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export function normalizeKey(str) {

  return normalizeString(str)
    .replace(/\s+/g, " ")
    .trim();
}

export function equalNormalized(a, b) {
  return normalizeKey(a) === normalizeKey(b);
}

export function includesNormalized(text, search) {

  const t = normalizeKey(text);
  const s = normalizeKey(search);

  if (!t || !s) return false;

  return t.includes(s);
}
export function getLatLngFromDoc(doc) {
  const u = doc?.ubicacion || doc?.["ubicación"] || null;

  const lat = u?.latitude ?? u?.lat ?? null;
  const lng = u?.longitude ?? u?.lng ?? null;

  if (typeof lat !== "number" || typeof lng !== "number") return null;

  return [lat, lng];
}