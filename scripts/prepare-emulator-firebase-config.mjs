import { readFile, writeFile } from 'node:fs/promises';

const config = JSON.parse(await readFile('firebase.json', 'utf8'));
const policy = "default-src 'self'; script-src 'self' https://www.gstatic.com https://www.google.com/recaptcha/ https://www.recaptcha.net/recaptcha/; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https://*.googleusercontent.com; font-src 'self' data:; connect-src 'self' https://*.googleapis.com https://*.firebaseio.com https://*.firebaseapp.com https://www.google.com/recaptcha/ https://www.recaptcha.net/recaptcha/ wss://*.firebaseio.com; frame-src https://accounts.google.com https://*.firebaseapp.com https://www.google.com/recaptcha/ https://recaptcha.google.com/recaptcha/ https://www.recaptcha.net/recaptcha/; worker-src 'self' blob:; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'";
config.hosting.headers.unshift({ source: '**', headers: [{ key: 'Content-Security-Policy-Report-Only', value: policy }] });
await writeFile('.firebase.emulator.generated.json', `${JSON.stringify(config, null, 2)}\n`);
