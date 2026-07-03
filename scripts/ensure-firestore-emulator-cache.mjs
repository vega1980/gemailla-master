import { existsSync, mkdirSync, readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { homedir } from 'node:os';
import { join } from 'node:path';

const emulatorCacheDir = process.env.FIREBASE_EMULATORS_CACHE_DIR || join(homedir(), '.cache', 'firebase', 'emulators');
const requiredPattern = /^cloud-firestore-emulator-v[\w.-]+\.jar$/;

function findCachedJars() {
  if (!existsSync(emulatorCacheDir)) return [];
  return readdirSync(emulatorCacheDir).filter((name) => requiredPattern.test(name));
}

function printCacheMissHelp() {
  console.error(`No cached Firestore emulator JAR found in ${emulatorCacheDir}.`);
  console.error('Expected a file like cloud-firestore-emulator-vX.Y.Z.jar before starting emulators.');
  console.error('If CI cannot download Firebase artifacts, restore/cache ~/.cache/firebase/emulators between jobs.');
}

mkdirSync(emulatorCacheDir, { recursive: true });

let jars = findCachedJars();
if (jars.length > 0) {
  console.log(`Firestore emulator cache OK: ${jars.join(', ')}`);
  process.exit(0);
}

console.log(`Firestore emulator cache is empty at ${emulatorCacheDir}; running Firebase setup to install Firestore emulator...`);
const setup = spawnSync('npx', ['firebase', 'setup:emulators:firestore'], {
  stdio: 'inherit',
  shell: process.platform === 'win32',
});

jars = findCachedJars();
if (setup.status === 0 && jars.length > 0) {
  console.log(`Firestore emulator cache OK after setup: ${jars.join(', ')}`);
  process.exit(0);
}

printCacheMissHelp();
if (setup.status !== 0) {
  console.error(`Firebase setup failed with exit code ${setup.status ?? 'unknown'}.`);
  console.error('This commonly appears as `download failed, status 403: Forbidden` in restricted runners.');
}
process.exit(setup.status || 1);
