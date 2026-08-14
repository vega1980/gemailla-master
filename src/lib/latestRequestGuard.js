/**
 * Creates a small request-generation guard for async UI loaders.
 *
 * Network cancellation is only a resource optimisation: a promise can still
 * settle after it has been aborted. Consumers must therefore check the token
 * before committing data to state.
 */
export function createLatestRequestGuard() {
  let generation = 0;

  return {
    begin() {
      generation += 1;
      return generation;
    },
    isCurrent(token) {
      return token === generation;
    },
    invalidate() {
      generation += 1;
    },
  };
}
