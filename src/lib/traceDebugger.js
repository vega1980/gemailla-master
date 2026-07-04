const TRACE_HISTORY = new Map();

function nowMs() {
  return typeof performance !== 'undefined' && typeof performance.now === 'function'
    ? performance.now()
    : Date.now();
}

export function registerTrace(correlationId, parentId, operation) {
  if (!correlationId || TRACE_HISTORY.has(correlationId)) return;

  TRACE_HISTORY.set(correlationId, {
    parent: parentId || null,
    operation,
    startTime: nowMs(),
    children: [],
  });

  if (parentId && TRACE_HISTORY.has(parentId)) {
    TRACE_HISTORY.get(parentId).children.push(correlationId);
  }
}

export function printTraceTree(rootId, indent = 0) {
  const node = TRACE_HISTORY.get(rootId);
  if (!node) return;

  const duration = nowMs() - node.startTime;
  console.log(`${'  '.repeat(indent)}└─ ${node.operation} (${duration.toFixed(2)}ms)`);
  node.children.forEach((childId) => printTraceTree(childId, indent + 1));
}

export function clearTraceHistory() {
  TRACE_HISTORY.clear();
}
