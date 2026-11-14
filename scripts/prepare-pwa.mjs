import { readdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const files = await readdir('dist', { recursive: true });
const assets = files.filter(f => /\.(js|css|html|png|svg|woff2|webmanifest)$/.test(f) && f !== 'sw.js').map(f => './' + f.replaceAll('\\', '/'));
const version = createHash('sha256').update(assets.join('|')).update(await readFile('dist/index.html')).digest('hex').slice(0,12);
let worker = await readFile('public/sw.js', 'utf8');
worker = worker.replace("'mis-inversiones-v1'", `'mis-inversiones-${version}'`).replace("['./', './index.html', './manifest.webmanifest', './icon.svg', './icon-192.png', './icon-512.png']", JSON.stringify(['./', ...assets]));
await writeFile('dist/sw.js', worker);
console.log(`PWA: ${assets.length} recursos preparados para uso sin conexión.`);
