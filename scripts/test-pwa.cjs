const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const manifest = JSON.parse(fs.readFileSync('manifest.json', 'utf8'));
assert.equal(manifest.id, '/');
for (const icon of manifest.icons) {
  const bytes = fs.readFileSync('.' + icon.src);
  const dimensions = `${bytes.readUInt32BE(16)}x${bytes.readUInt32BE(20)}`;
  assert.equal(dimensions, icon.sizes, icon.src);
}
const handlers = {};
const cache = new Map();
vm.runInNewContext(fs.readFileSync('service-worker.js', 'utf8'), {
  self: { location: { origin: 'https://example.test' }, addEventListener: (n, fn) => handlers[n] = fn,
    skipWaiting() {}, clients: { claim() {} } },
  URL, Response,
  fetch: async () => { throw new Error('Offline'); },
  caches: { match: async key => cache.get(typeof key === 'string' ? key : key.url) }
});
async function request(path, mode = 'cors') {
  let response;
  handlers.fetch({ request: { url: 'https://example.test' + path, method: 'GET', mode },
    respondWith(promise) { response = promise; } });
  return response;
}
(async () => {
  for (const path of ['/data/firestore/manifest.json', '/data/firestore/missing.json', '/api/lugares']) {
    const response = await request(path);
    assert.equal(response.status, 503);
    assert.equal((await response.json()).ok, false);
  }
  cache.set('/offline.html', new Response('offline page'));
  assert.equal(await (await request('/', 'navigate')).text(), 'offline page');
  assert.equal((await request('/missing.js')).status, 503);
  let intercepted = false;
  handlers.fetch({ request: { url: 'https://external.test/script.js', method: 'GET' },
    respondWith() { intercepted = true; } });
  assert.equal(intercepted, false);
  console.log('PWA checks passed');
})().catch(error => { console.error(error); process.exitCode = 1; });
