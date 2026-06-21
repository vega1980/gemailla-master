#!/usr/bin/env node

const DEFAULT_TIMEOUT_MS = 30000;
const DEFAULT_INTERVAL_MS = 250;

function parseArgs(argv) {
  const options = {
    timeout: DEFAULT_TIMEOUT_MS,
    interval: DEFAULT_INTERVAL_MS,
    resources: [],
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === '--timeout' || arg === '-t') {
      options.timeout = Number(argv[index + 1]);
      index += 1;
      continue;
    }

    if (arg === '--interval' || arg === '-i') {
      options.interval = Number(argv[index + 1]);
      index += 1;
      continue;
    }

    if (arg === '--help' || arg === '-h') {
      options.help = true;
      continue;
    }

    options.resources.push(arg);
  }

  return options;
}

function printHelp() {
  console.log(`Usage: wait-on [--timeout ms] [--interval ms] <http-url> [...http-url]

Waits until all provided HTTP(S) resources respond before exiting.`);
}

async function canConnect(resource) {
  const response = await fetch(resource, { method: 'GET' });
  response.body?.cancel();
  return true;
}

async function waitForResources(resources, { timeout, interval }) {
  const deadline = Date.now() + timeout;
  const pending = new Set(resources);

  while (pending.size > 0) {
    await Promise.all(
      [...pending].map(async (resource) => {
        try {
          await canConnect(resource);
          pending.delete(resource);
        } catch {
          // Keep waiting until the timeout expires.
        }
      }),
    );

    if (pending.size === 0) {
      return;
    }

    if (Date.now() >= deadline) {
      throw new Error(`Timed out waiting for: ${[...pending].join(', ')}`);
    }

    await new Promise((resolve) => setTimeout(resolve, interval));
  }
}

const options = parseArgs(process.argv.slice(2));

if (options.help) {
  printHelp();
  process.exit(0);
}

if (options.resources.length === 0 || !Number.isFinite(options.timeout) || !Number.isFinite(options.interval)) {
  printHelp();
  process.exit(1);
}

waitForResources(options.resources, options).catch((error) => {
  console.error(error.message);
  process.exit(1);
});
