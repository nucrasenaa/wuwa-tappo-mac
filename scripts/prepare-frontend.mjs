import { cp, mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { patchSessionBarriers, patchLoginReady, patchGlobalSdkUrls, patchMacUpdateFeedback, patchMacUpdater, patchMacAbout } from './patch-frontend.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const source = path.join(root, 'frontend');
const output = path.join(root, 'build/frontend');
const index = await readFile(path.join(source, 'index.html'), 'utf8');
const entry = index.match(/src="\.\/([^"]+\.js)"/)?.[1];
if (!entry) throw new Error('Original frontend entry module not found.');

const entrySource = patchSessionBarriers(
  patchMacUpdater(
    patchGlobalSdkUrls(await readFile(path.join(source, entry), 'utf8')),
  ),
);
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
await cp(source, output, { recursive: true });
await writeFile(path.join(output, 'index.html'), index);
await cp(path.join(root, 'scripts', 'bootstrap.html'), path.join(output, 'bootstrap.html'));
await writeFile(path.join(output, entry), entrySource);

const assetNames = (await readdir(path.join(source, 'assets'))).filter(name => name.endsWith('.js'));
async function patchOne(predicate, patch, label) {
  const matches = [];
  for (const name of assetNames) {
    const file = path.join(source, 'assets', name);
    const sourceText = await readFile(file, 'utf8');
    if (predicate(sourceText)) matches.push({ name, sourceText });
  }
  if (matches.length !== 1) throw new Error(`Expected one ${label}, found ${matches.length}. Reconcile the app version before building.`);
  await writeFile(path.join(output, 'assets', matches[0].name), patch(matches[0].sourceText));
}

await patchOne(
  sourceText => sourceText.includes('function N(n){return o(u,t=>{n(t.payload??{})})}'),
  patchLoginReady,
  'modal event bridge',
);
await patchOne(
  sourceText => /[A-Za-z_$][\w$]*\.value=n\("setting_version_check_failed"\)/.test(sourceText),
  patchMacUpdateFeedback,
  'update feedback',
);
await patchOne(
  sourceText => /<h2 data-v-[^>]+>系统配置<\/h2>/.test(sourceText),
  patchMacAbout,
  'About system section',
);
console.log(`Prepared official GLOBAL frontend at ${output}`);
