import assert from 'node:assert/strict';
import test from 'node:test';
import {
  AUTH_STATES,
  INITIAL_AUTH_SESSION,
  resolvedAuthSession,
} from '../../src/app/providers/authState.js';

test('la sesión comienza bloqueada mientras Firebase resuelve la autenticación', () => {
  assert.deepEqual(INITIAL_AUTH_SESSION, {
    status: AUTH_STATES.LOADING,
    user: null,
    error: null,
  });
});

test('una respuesta con usuario produce el estado autenticado', () => {
  const user = { uid: 'user-1' };

  assert.deepEqual(resolvedAuthSession(user), {
    status: AUTH_STATES.AUTHENTICATED,
    user,
    error: null,
  });
});

test('una respuesta sin usuario produce el estado no autenticado', () => {
  assert.deepEqual(resolvedAuthSession(null), {
    status: AUTH_STATES.UNAUTHENTICATED,
    user: null,
    error: null,
  });
});
