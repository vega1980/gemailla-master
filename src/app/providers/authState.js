export const AUTH_STATES = Object.freeze({
  LOADING: 'loading',
  AUTHENTICATED: 'authenticated',
  UNAUTHENTICATED: 'unauthenticated',
});

export const INITIAL_AUTH_SESSION = Object.freeze({
  status: AUTH_STATES.LOADING,
  user: null,
  error: null,
});

export function resolvedAuthSession(user, error = null) {
  return {
    status: user ? AUTH_STATES.AUTHENTICATED : AUTH_STATES.UNAUTHENTICATED,
    user: user || null,
    error,
  };
}
