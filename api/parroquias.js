// api/parroquias.js
import { db } from "./_lib/firebaseAdmin.js";
import { ok, fail } from "./_lib/response.js";
import { mapSnapshot } from "./_lib/normalize.js";

export default async function handler(req, res) {
  try {
    if (req.method !== "GET") {
      return fail(res, 405, "Método no permitido");
    }

    const { canton, codigo_canton } = req.query || {};

    let ref = db.collection("parroquias");

    if (codigo_canton) {
      ref = ref.where("codigo_canton", "==", String(codigo_canton).trim());
    } else if (canton) {
      ref = ref.where("canton", "==", String(canton).trim());
    }

    const snapshot = await ref.get();
    const data = mapSnapshot(snapshot);

    return ok(res, data, {
      collection: "parroquias",
      total: data.length
    });
  } catch (error) {
    console.error("Error en /api/parroquias:", error);
    return fail(res, 500, "No se pudo obtener parroquias");
  }
}