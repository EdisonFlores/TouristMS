// api/_lib/response.js
export function sendJson(res, status, data) {
  res.status(status).json(data);
}

export function ok(res, data, meta = {}) {
  return sendJson(res, 200, {
    ok: true,
    data,
    meta
  });
}

export function fail(res, status = 500, message = "Error interno", extra = {}) {
  return sendJson(res, status, {
    ok: false,
    error: message,
    ...extra
  });
}