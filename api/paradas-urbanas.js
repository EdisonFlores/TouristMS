import { db } from "./_lib/firebaseAdmin.js";
import { ok, fail } from "./_lib/response.js";
import { mapSnapshot } from "./_lib/normalize.js";

export default async function handler(req, res) {
  try {
    if (req.method !== "GET") {
      return fail(res, 405, "Método no permitido");
    }

    const snapshot = await db.collection("paradas_transporte").get();
    const data = mapSnapshot(snapshot);

    return ok(res, data, {
      collection: "paradas_transporte",
      total: data.length
    });
  } catch (error) {
    console.error("Error real /api/paradas-urbanas:", error);
    return res.status(500).json({
      ok: false,
      error: error?.message || String(error),
      stack: error?.stack || null
    });
  }
}