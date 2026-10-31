import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { patchSessionBarriers, patchLoginReady, patchGlobalSdkUrls, patchMacUpdateFeedback, patchMacAbout, patchAutoTappoChestBridge, patchDockDragHitTesting } from '../scripts/patch-frontend.mjs';

const root = new URL('../', import.meta.url);

test('every application runtime command has a macOS handler', async () => {
  const contract = JSON.parse(await readFile(new URL('tests/contracts.json', root), 'utf8'));
  const modules = ['lib', 'windows', 'storage', 'input', 'system'];
  const implementation = (await Promise.all(modules.map(name => readFile(new URL(`src-tauri/src/${name}.rs`, root), 'utf8')))).join('\n');
  const missing = contract.commands.filter(c => c.kind === 'application' && c.scopes.includes('application-runtime'))
    .filter(c => !implementation.includes(`"${c.name}"`) && !implementation.includes(`fn ${c.name}(`))
    .map(c => c.name);
  assert.deepEqual(missing, []);
});

test('session flush barriers cover both SDK invoke wrappers without changing native internals', () => {
  const wrapper = name => `async function ${name}(e,t={},n){return window.__TAURI_INTERNALS__.invoke(e,t,n)}`;
  const source = `${wrapper('invoke$1')}${wrapper('invoke')}`;
  const result = patchSessionBarriers(source);
  assert.equal((result.match(/SESSION__\?\.flush\(\)/g) || []).length, 2);
  assert.ok(result.includes('cat-auth-login-success'));
  assert.ok(result.includes('cat-auth-logout'));
  assert.ok(result.includes('open_login_window'));
  assert.ok(!result.includes('__TAURI_INTERNALS__.invoke='));
});

test('unknown upstream wrapper versions fail the build instead of dropping the barrier', () => {
  assert.throws(() => patchSessionBarriers('async function invoke(){}'), /Expected 2/);
});

test('first login waits for the Vue modal listener rather than a page-load timer', () => {
  const result=patchLoginReady('function N(n){return o(u,t=>{n(t.payload??{})})}');
  assert.ok(result.indexOf('await o(u,')<result.indexOf('invoke("login_window_ready")'));
  assert.ok(result.includes('return unlisten'));
  assert.throws(()=>patchLoginReady(''),/listener bridge changed/);
});

test('Global SDK script and stylesheet use HTTPS from the local Tauri origin', () => {
  const source = 'const APP_REGION="GLOBAL";const isdkSrc="//pro-cdn-sdk.kurogame.com/pro/web-sdk/1.x/kr-sdk.js",isdkCss="//pro-cdn-sdk.kurogame.com/pro/web-sdk/1.x/style.css";';
  const result = patchGlobalSdkUrls(source);
  assert.ok(result.includes('isdkSrc="https://pro-cdn-sdk.kurogame.com/pro/web-sdk/1.x/kr-sdk.js"'));
  assert.ok(result.includes('isdkCss="https://pro-cdn-sdk.kurogame.com/pro/web-sdk/1.x/style.css"'));
  assert.throws(() => patchGlobalSdkUrls(source.replace('"GLOBAL"', '"CN"')), /official GLOBAL frontend/);
  assert.throws(() => patchGlobalSdkUrls('const APP_REGION="GLOBAL";'), /Expected 2 GLOBAL SDK URLs/);
});

test('Mac update feedback preserves the native platform explanation', () => {
  assert.equal(patchMacUpdateFeedback('re.value=n("setting_version_check_failed")'), 're.value=h.message||n("setting_version_check_failed")');
  assert.equal(
    patchMacUpdateFeedback('if(_.kind==="error"){wt("check_failed"),le.value=t("setting_version_check_failed")}'),
    'if(_.kind==="error"){wt("check_failed"),le.value=_.message||t("setting_version_check_failed")}',
  );
  assert.throws(() => patchMacUpdateFeedback(''), /update feedback changed/);
});

test('About separates the Mac build target from official Windows requirements', () => {
  const patched = patchMacAbout('t=b(()=>k("about_content")?String(v("about_content")).trim():"");<h2 data-v-439444c8>系统配置</h2>');
  assert.ok(patched.includes('Apple Silicon'));
  assert.ok(patched.includes('Official Windows requirements'));
  assert.ok(patched.includes('html.replace("系统配置","Official Windows requirements")'));
  assert.throws(() => patchMacAbout(''), /About system section changed/);
});

test('AutoTappo chest bridge preserves the minified open handler boundary', () => {
  const source = 'async function zl(e){if(e==="left"){return "}";}return e;}function next(){}';
  const patched = patchAutoTappoChestBridge(source);
  assert.ok(patched.includes('autotappo-auto-chest'));
  assert.equal(patched.indexOf('function next()'), patched.lastIndexOf('function next()'));
  const renamed = 'async function pc(e){if(e==="left"){return "}";}console.warn("[chest] openChest failed",e);return e;}function next(){}';
  assert.match(patchAutoTappoChestBridge(renamed), /async function pc\(e\).*await pc\("left"\)/s);
  assert.throws(() => patchAutoTappoChestBridge(''), /chest-open handler changed/);
});

test('dock drag remains available in game mode and falls back to dock bounds', () => {
  const source = 'async function Ic(e,t,i,l,d){if(!pt.value||Me()||It.value)return;if(zt.value){onDockClick:()=>{np()},isInteractionLocked:()=>Me(),const z=document.elementFromPoint(I.x,I.y);if(!z)return;const ee=z.closest("button");if(ee instanceof HTMLElement){An(!0),ee.classList.contains("emotion-dot")?(Vo=ee,Rc(ee,"pointerdown",I.x,I.y)):ee.click();return}const Z=z.closest("[data-room-cat-id]");if(Z){const _e=Number(Z.dataset.roomCatId),Be=fe.value.find($e=>$e.id===_e);Be&&Qt(Be)&&al(Be,I.x,I.y,Z);return}z.closest(".pet-dock-content")&&(An(!0),Gd(I.x,I.y));return}';
  const patched = patchDockDragHitTesting(source);
  assert.ok(patched.includes('if(!pt.value||Me())return;if(It.value){'));
  assert.ok(patched.includes('if(t!=="press"||e!=="left")return'));
  assert.ok(patched.includes('if(onDock&&!z?.closest("button")){An(!0),Gd(I.x,I.y)}return}'));
  assert.ok(patched.includes('dock=ce.value?.querySelector(".pet-dock-content")'));
  assert.ok(patched.includes('onDock=!!rect&&I.x>=rect.left'));
  assert.ok(patched.includes('z?.closest("button")'));
  assert.ok(patched.includes('(onDock||z?.closest(".pet-dock-content"))'));
  assert.ok(patched.includes('onDockClick:()=>{It.value||np()}'));
  assert.throws(() => patchDockDragHitTesting(''), /game-mode interaction guard changed/);
});

test('multiple patches targeting one official asset are composable', () => {
  const chest = 'async function zl(e){if(e==="left"){return "}";}return e;}function next(){}';
  const dock = 'async function Ic(e,t,i,l,d){if(!pt.value||Me()||It.value)return;if(zt.value){onDockClick:()=>{np()},isInteractionLocked:()=>Me(),const z=document.elementFromPoint(I.x,I.y);if(!z)return;const ee=z.closest("button");if(ee instanceof HTMLElement){An(!0),ee.classList.contains("emotion-dot")?(Vo=ee,Rc(ee,"pointerdown",I.x,I.y)):ee.click();return}const Z=z.closest("[data-room-cat-id]");if(Z){const _e=Number(Z.dataset.roomCatId),Be=fe.value.find($e=>$e.id===_e);Be&&Qt(Be)&&al(Be,I.x,I.y,Z);return}z.closest(".pet-dock-content")&&(An(!0),Gd(I.x,I.y));return}';
  const patched = patchDockDragHitTesting(patchAutoTappoChestBridge(`${chest}${dock}`));
  assert.ok(patched.includes('autotappo-auto-chest'));
  assert.ok(patched.includes('onDockClick:()=>{It.value||np()}'));
});
