import net from 'node:net';

const checks = [
  { name: 'Firestore', env: 'FIRESTORE_EMULATOR_HOST', fallback: '127.0.0.1:8080' },
  { name: 'Storage', env: 'FIREBASE_STORAGE_EMULATOR_HOST', fallback: '127.0.0.1:9199' },
];

function parseHostPort(value) {
  const [host, rawPort] = String(value).replace(/^https?:\/\//, '').split(':');
  return { host, port: Number(rawPort) };
}

function canConnect({ host, port }, timeoutMs = 1500) {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host, port });
    const done = (ok) => {
      socket.removeAllListeners();
      socket.destroy();
      resolve(ok);
    };
    socket.setTimeout(timeoutMs);
    socket.once('connect', () => done(true));
    socket.once('timeout', () => done(false));
    socket.once('error', () => done(false));
  });
}

const failures = [];

for (const check of checks) {
  const target = process.env[check.env] || check.fallback;
  const parsed = parseHostPort(target);
  const ok = parsed.host && Number.isFinite(parsed.port) && await canConnect(parsed);
  if (!ok) failures.push(`${check.name} emulator is not reachable at ${target} (${check.env}).`);
}

if (failures.length) {
  console.error('Firebase rules tests require running emulators before executing tests/rules/*.test.mjs.');
  failures.forEach((failure) => console.error(`- ${failure}`));
  console.error('\nStart them with one of:');
  console.error('- npm run test:rules:emulators');
  console.error('- npm run serve, then npm run test:rules in another terminal');
  process.exit(1);
}

console.log('Firestore and Storage emulators are reachable.');
