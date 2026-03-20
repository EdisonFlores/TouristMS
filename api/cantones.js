// api/cantones.js
import { db } from "./_lib/firebaseAdmin.js";
import { ok, fail } from "./_lib/response.js";
import { mapSnapshot } from "./_lib/normalize.js";

export default async function handler(req, res) {
  try {
    if (req.method !== "GET") {
      return fail(res, 405, "Método no permitido");
    }

    const { codigo_provincia } = req.query || {};

    let ref = db.collection("cantones");

    if (codigo_provincia) {
      ref = ref.where("codigo_provincia", "==", String(codigo_provincia).trim());
    }

    const snapshot = await ref.get();
    const data = mapSnapshot(snapshot);

    return ok(res, data, {
      collection: "cantones",
      total: data.length,
      filtro: codigo_provincia ? { codigo_provincia } : null
    });
  } catch (error) {
    console.error("Error en /api/cantones:", error);
    return fail(res, 500, "No se pudo obtener cantones");
  }
}