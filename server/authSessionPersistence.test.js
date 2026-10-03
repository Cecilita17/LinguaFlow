import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const source = readFileSync(new URL('../src/context/AuthContext.jsx', import.meta.url), 'utf8');
const start = source.indexOf('  const verifySessionOnMount');
const end = source.indexOf('\n  useEffect', start);
function session(fetch) {
  let token = 'saved-session', user = null;
  const ref = { current: { pending: false, retry: false } };
  const verify = runInNewContext(source.slice(start, end) + '\nverifySessionOnMount;', {
    useCallback: fn => fn, fetch, API_BASE_URL: '', STORAGE_KEY_AUTH_TOKEN: 'session',
    sessionVerificationRef: ref,
    localStorage: { getItem: () => token, removeItem: () => { token = null; } },
    setUser: value => { user = value; }, setIsLoading: () => {}, console: { warn() {} }
  });
  return { verify, ref, token: () => token, user: () => user, changeToken: value => { token = value; } };
}
for (const status of [500, 503, 429]) {
  test(`HTTP ${status} preserves the session for a later retry`, async () => {
    const state = session(async () => ({ ok: false, status }));
    await state.verify();
    assert.equal(state.token(), 'saved-session');
    assert.equal(state.user(), null);
    assert.equal(state.ref.current.retry, true);
  });
}
test('a network failure preserves the token and a later verification restores the user', async () => {
  let offline = true;
  const user = { email: 'user@example.com' };
  const state = session(async () => {
    if (offline) throw new Error('Offline');
    return { ok: true, status: 200, json: async () => ({ authenticated: true, user }) };
  });
  await state.verify();
  assert.equal(state.token(), 'saved-session');
  assert.equal(state.user(), null);
  offline = false;
  await state.verify();
  assert.equal(state.user(), user);
  assert.equal(state.ref.current.retry, false);
});
test('an expired or invalid session is removed after HTTP 401', async () => {
  const state = session(async () => ({ ok: false, status: 401 }));
  await state.verify();
  assert.equal(state.token(), null);
  assert.equal(state.ref.current.retry, false);
});
test('malformed successful responses do not destroy the saved session', async () => {
  const state = session(async () => ({ ok: true, status: 200, json: async () => { throw new Error('Invalid JSON'); } }));
  await state.verify();
  assert.equal(state.token(), 'saved-session');
  assert.equal(state.ref.current.retry, true);
});
test('an old verification cannot erase a newly issued login token', async () => {
  let resolve;
  const state = session(() => new Promise(done => { resolve = done; }));
  const pending = state.verify();
  state.changeToken('new-session');
  resolve({ ok: false, status: 401 });
  await pending;
  assert.equal(state.token(), 'new-session');
});
