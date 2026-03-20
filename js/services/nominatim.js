// js/services/nominatim.js

export async function reverseGeocodeNominatim(lat, lon) {

  const url =
    `https://nominatim.openstreetmap.org/reverse?format=jsonv2` +
    `&lat=${encodeURIComponent(lat)}` +
    `&lon=${encodeURIComponent(lon)}` +
    `&zoom=12&addressdetails=1&accept-language=es`;

  const res = await fetch(url, {
    headers: {
      "User-Agent": "TouristMacas/1.0"
    }
  });

  if (!res.ok) {
    throw new Error("Nominatim reverse failed");
  }

  const data = await res.json();
  const a = data?.address || {};

  const provinciaRaw = a.state || a.region || "";
  const cantonRaw = a.county || "";
  const parroquiaRaw =
    a.city_district ||
    a.suburb ||
    a.city ||
    a.town ||
    a.village ||
    a.hamlet ||
    "";

  return {
    provincia: toTitleCase(provinciaRaw),
    canton: toTitleCase(cantonRaw),
    parroquia: toTitleCase(parroquiaRaw),
    raw: data
  };
}

function toTitleCase(str) {
  return String(str || "")
    .toLowerCase()
    .replace(/\b\w/g, c => c.toUpperCase());
}