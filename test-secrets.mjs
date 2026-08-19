// Test: Pages env/secrets (CLIENT_ID, CLIENT_SECRET, REFRESH_TOKEN) override authConfig.
// Builds a valid session cookie (same AES key as the worker), then checks the
// Google token request body uses the env-provided values instead of the hardcoded ones.

const KEY = '3225f86e99e205347b4310e437253bfd';

async function enc(s) {
  const iv = crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(KEY), 'AES-CBC', false, ['encrypt']);
  const ct = await crypto.subtle.encrypt({ name: 'AES-CBC', iv }, key, new TextEncoder().encode(s));
  const combined = new Uint8Array(16 + ct.byteLength);
  combined.set(iv);
  combined.set(new Uint8Array(ct), 16);
  return Buffer.from(combined).toString('base64');
}

function jsonResponse(obj, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json' } });
}

async function makeSession() {
  const u = await enc('admin');
  const p = await enc('admin123');
  const t = await enc(String(Date.now() + 86400000));
  return `${u}|${p}|${t}`;
}

function makeFetchHarness() {
  let captured = null;
  globalThis.fetch = async (url, opts = {}) => {
    const u = String(url);
    if (/oauth2\/v[24]\/token/.test(u) && opts.method === 'POST') {
      captured = new URLSearchParams(opts.body);
      return jsonResponse({ access_token: 'fake-token', expires_in: 3600 });
    }
    if (u.includes('/drive/v3/files/root')) {
      return jsonResponse({ id: 'root', name: 'My Drive', mimeType: 'application/vnd.google-apps.folder', parents: [] });
    }
    if (u.includes('/drive/v3/files')) return jsonResponse({ files: [] });
    return new Response('unexpected fetch: ' + u, { status: 500 });
  };
  return () => captured;
}

const session = await makeSession();
const cookie = { headers: { cookie: `session=${session}` } };

let pass = 0, fail = 0;
const check = (n, c, x = '') => { c ? (pass++, console.log('  PASS ' + n + (x ? ' — ' + x : ''))) : (fail++, console.log('  FAIL ' + n + (x ? ' — ' + x : ''))); };

// --- Case 1: env provides the secrets (fresh module instance) ---
{
  const getCaptured = makeFetchHarness();
  const mod = await import('./gdi-pages/_worker.js?case=env');
  const res = await mod.default.fetch(new Request('https://demo.pages.dev/', cookie), {
    CLIENT_ID: 'ENV-CLIENT-999',
    CLIENT_SECRET: 'ENV-SECRET-888',
    REFRESH_TOKEN: 'ENV-REFRESH-777',
  }, {});
  check('C1 page loads with env secrets', res.status === 200, 'status=' + res.status);
  const c = getCaptured();
  check('C1 token request used env CLIENT_ID', c && c.get('client_id') === 'ENV-CLIENT-999', c && c.get('client_id'));
  check('C1 token request used env CLIENT_SECRET', c && c.get('client_secret') === 'ENV-SECRET-888', c && c.get('client_secret'));
  check('C1 token request used env REFRESH_TOKEN', c && c.get('refresh_token') === 'ENV-REFRESH-777', c && c.get('refresh_token'));
}

// --- Case 2: no env -> hardcoded fallbacks still work (fresh module instance) ---
{
  const getCaptured = makeFetchHarness();
  const mod = await import('./gdi-pages/_worker.js?case=fallback');
  const res = await mod.default.fetch(new Request('https://demo.pages.dev/', cookie), {}, {});
  check('C2 page loads without env', res.status === 200, 'status=' + res.status);
  const c = getCaptured();
  check('C2 fallback client_id used', c && c.get('client_id') === '58094879805-4654k2k5nqdid5bavft7fvea5u9po0t1.apps.googleusercontent.com', c && c.get('client_id'));
}

console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
