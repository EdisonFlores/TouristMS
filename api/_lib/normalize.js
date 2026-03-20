// api/_lib/normalize.js

function normalizeValue(value) {
  if (value === null || value === undefined) return value;

  // GeoPoint de Firestore Admin
  if (
    typeof value === "object" &&
    value !== null &&
    typeof value.latitude === "number" &&
    typeof value.longitude === "number"
  ) {
    return {
      latitude: value.latitude,
      longitude: value.longitude
    };
  }

  // Algunos casos serializados con _latitude/_longitude
  if (
    typeof value === "object" &&
    value !== null &&
    typeof value._latitude === "number" &&
    typeof value._longitude === "number"
  ) {
    return {
      latitude: value._latitude,
      longitude: value._longitude
    };
  }

  if (Array.isArray(value)) {
    return value.map(normalizeValue);
  }

  if (typeof value === "object") {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      out[k] = normalizeValue(v);
    }
    return out;
  }

  return value;
}

export function withId(doc) {
  return {
    id: doc.id,
    ...normalizeValue(doc.data())
  };
}

export function mapSnapshot(snapshot) {
  return snapshot.docs.map(withId);
}