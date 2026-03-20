// api/lineas-rurales.js
import { db } from "./_lib/firebaseAdmin.js";
import { ok, fail } from "./_lib/response.js";
import { mapSnapshot } from "./_lib/normalize.js";

export default async function handler(req, res) {
  try {
    if (req.method !== "GET") {
      return fail(res, 405, "Método no permitido");
    }

    const snapshot = await db.collection("lineas_rurales").get();
    const data = mapSnapshot(snapshot);

    return ok(res, data, {
      collection: "lineas_rurales",
      total: data.length
    });
  } catch (error) {
    console.error("Error en /api/lineas-rurales:", error);
    return fail(res, 500, "No se pudo obtener líneas rurales");
  }
}