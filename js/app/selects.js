// js/app/selects.js
import { getCollectionCache } from "./cache_db.js";

/* =========================
   LEGACY: PROVINCIAS desde "lugares"
========================= */
export async function getProvinciasConDatos() {
  const docs = await getCollectionCache("lugares");
  const provincias = new Set();

  (Array.isArray(docs) ? docs : []).forEach(d => {
    if (!d?.activo) return;
    if (d.provincia?.trim()) provincias.add(d.provincia.trim());
  });

  return [...provincias].sort((a, b) => a.localeCompare(b));
}

/* =========================
   LEGACY: CANTONES desde "lugares"
========================= */
export async function getCantonesConDatos(provincia) {
  const docs = await getCollectionCache("lugares");
  const cantones = new Set();

  (Array.isArray(docs) ? docs : []).forEach(d => {
    if (!d?.activo) return;
    if (d.provincia === provincia && d.ciudad?.trim()) cantones.add(d.ciudad.trim());
  });

  return [...cantones].sort((a, b) => a.localeCompare(b));
}

/* =========================
   LEGACY: PARROQUIAS desde "lugares"
========================= */
export async function getParroquiasConDatos(provincia, canton) {
  const docs = await getCollectionCache("lugares");
  const parroquias = new Set();

  (Array.isArray(docs) ? docs : []).forEach(d => {
    if (!d?.activo) return;
    if (d.provincia === provincia && d.ciudad === canton && d.parroquia?.trim()) {
      parroquias.add(d.parroquia.trim());
    }
  });

  return [...parroquias].sort((a, b) => a.localeCompare(b));
}

/* =====================================================
   PROVINCIAS desde colección "provincias"
===================================================== */
export async function getProvinciasFS() {
  const docs = await getCollectionCache("provincias");
  const arr = Array.isArray(docs) ? [...docs] : [];

  arr.sort((a, b) => {
    const an = String(a?.Nombre || a?.nombre || "").trim();
    const bn = String(b?.Nombre || b?.nombre || "").trim();
    return an.localeCompare(bn);
  });

  return arr;
}

/* =====================================================
   CANTONES por código de provincia
===================================================== */
export async function getCantonesFSByCodigoProvincia(codigo_provincia) {
  const docs = await getCollectionCache("cantones");
  const arr = Array.isArray(docs) ? docs : [];
  const cp = String(codigo_provincia || "").trim();

  const filtered = arr.filter(c => String(c?.codigo_provincia || "").trim() === cp);

  filtered.sort((a, b) => {
    const an = String(a?.nombre || a?.Nombre || "").trim();
    const bn = String(b?.nombre || b?.Nombre || "").trim();
    return an.localeCompare(bn);
  });

  return filtered;
}

/* =====================================================
   Tipos de comida desde colección "lugares"
===================================================== */
export async function getTiposComidaFromLugar({ provincia, canton, specialSevilla } = {}) {
  const docs = await getCollectionCache("lugares");
  const arr = Array.isArray(docs) ? docs : [];

  const provSel = String(provincia || "").trim();
  const cantonSel = String(canton || "").trim();

  const set = new Set();

  arr.forEach(l => {
    if (!l?.activo) return;
    if (String(l?.provincia || "").trim() !== provSel) return;

    const sub = String(l?.subcategoria || "").trim().toLowerCase();
    if (sub !== "alimentacion") return;

    const ciudad = String(l?.ciudad || "").trim();

    if (specialSevilla) {
      if (ciudad !== "Sevilla Don Bosco" && ciudad !== "Morona") return;
    } else {
      if (ciudad !== cantonSel) return;
    }

    const tc = String(l?.tipocomida || "").trim();
    if (tc) set.add(tc);
  });

  return [...set].sort((a, b) => a.localeCompare(b));
}