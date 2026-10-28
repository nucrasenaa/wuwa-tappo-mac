export function patchSessionBarriers(source) {
  let changes = 0;
  const patched = source.replace(
    /async function (invoke(?:\$\d+)?)\(e,t=\{\},n\)\{return window\.__TAURI_INTERNALS__\.invoke\(e,t,n\)\}/g,
    (_, name) => {
      changes += 1;
      return `async function ${name}(e,t={},n){if(e==="open_login_window"||e==="open_panel_window"||e==="plugin:event|emit"&&(t.event==="cat-auth-login-success"||t.event==="cat-auth-logout"))await window.__WUWATAPPO_SESSION__?.flush();return window.__TAURI_INTERNALS__.invoke(e,t,n)}`;
    },
  );
  if (changes !== 2) throw new Error(`Expected 2 original Tauri invoke wrappers, found ${changes}. Reconcile the app version before building.`);
  return patched;
}

export function patchLoginReady(source) {
  const original='function N(n){return o(u,t=>{n(t.payload??{})})}';
  const replacement='async function N(n){const unlisten=await o(u,t=>{n(t.payload??{})});await window.__TAURI_INTERNALS__.invoke("login_window_ready");return unlisten}';
  if(source.split(original).length!==2) throw new Error('Original login listener bridge changed; reconcile modal readiness before building.');
  return source.replace(original,replacement);
}

export function patchGlobalSdkUrls(source) {
  if (!source.includes('const APP_REGION="GLOBAL"')) {
    throw new Error('Expected the official GLOBAL frontend. Extract the GLOBAL installer before building.');
  }
  let changes = 0;
  const patched = source.replace(
    /(isdk(?:Src|Css)=")(\/\/pro-cdn-sdk\.kurogame\.com\/pro\/web-sdk\/1\.x\/(?:kr-sdk\.js|style\.css)")/g,
    (_, prefix, url) => {
      changes += 1;
      return `${prefix}https:${url}`;
    },
  );
  if (changes !== 2) throw new Error(`Expected 2 GLOBAL SDK URLs, found ${changes}. Reconcile the app version before building.`);
  return patched;
}

// Keep the old export name for small downstream scripts that still import it.
export const patchDomesticSdkUrls = patchGlobalSdkUrls;

export function patchDomesticLoginReload(source) {
  const start = 'async function we(e=!1){if(E)return E;if(!e&&$())';
  const end = 'async function me()';
  const insertion = ',document.head.appendChild(t),r=window.setTimeout(';
  const offset = source.indexOf(start);
  const limit = source.indexOf(end, offset);
  if (offset < 0 || limit < 0 || source.split(start).length !== 2) {
    throw new Error('Original CN SDK reload function changed; reconcile the login reload patch before building.');
  }
  const loader = source.slice(offset, limit);
  if (!loader.includes('t.dataset.kuroSdkRetry="true"') || loader.split(insertion).length !== 2) {
    throw new Error('Original CN SDK script insertion changed; reconcile the login reload patch before building.');
  }
  const replacement = ',e&&([...document.scripts].filter(s=>s.src===t.src).forEach(s=>s.remove()),document.getElementById("KrSDK")?.remove())' + insertion;
  return source.slice(0, offset) + loader.replace(insertion, replacement) + source.slice(limit);
}

export function patchMacUpdateFeedback(source) {
  const pattern = /([A-Za-z_$][\w$]*)\.value=n\("setting_version_check_failed"\)/g;
  const matches = [...source.matchAll(pattern)];
  if (matches.length !== 1) throw new Error('Original update feedback changed; reconcile the Mac update message before building.');
  const original = matches[0][0];
  return source.replace(original, `${matches[0][1]}.value=h.message||n("setting_version_check_failed")`);
}

export function patchMacUpdater(source) {
  const resolver = 'async function resolveUpdaterLatestJsonUrl(){const e=resolveUpdaterLatestHostJsonUrl();if(!e)return null;';
  const recovery = 'async function resolveUpdaterLatestJsonUrl(){let e=resolveUpdaterLatestHostJsonUrl();if(!e){const config=unwrapApiData(await activityInfo());const host=typeof config?.assets_host==="string"?config.assets_host.trim():"";if(!host||host===LOCAL_ROLE_ASSETS_HOST)throw new Error("官方配置缺少更新资源地址");setUpdaterAssetsHost(host,{triggerSilentCheck:!1});e=resolveUpdaterLatestHostJsonUrl()}';
  const failure = 'if(logDiagnostic("UPDATE","check_failed",{stage:"check",reason_code:diagnosticErrorCode(t),fallback:e?.interactive?"report_error":"treat_as_latest"},"warn"),e?.interactive)return{kind:"error",message:n};try{const s=await getVersion();return console.warn("[updater] check skipped (treat as latest)",t),{kind:"none",currentVersion:s}}catch{return{kind:"error",message:n}}';
  const report = 'return logDiagnostic("UPDATE","check_failed",{stage:"check",reason_code:diagnosticErrorCode(t),fallback:"report_error"},"warn"),{kind:"error",message:n}';
  for (const original of [resolver, failure]) {
    if (source.split(original).length !== 2) throw new Error('Original updater flow changed; reconcile the Mac update path before building.');
  }
  return source.replace(resolver, recovery).replace(failure, report);
}

export function patchMacAbout(source) {
  const remote = 't=b(()=>k("about_content")?String(v("about_content")).trim():"")';
  const info = '<h2 data-v-439444c8>macOS Rebuild</h2><p data-v-439444c8>Unofficial community rebuild · Apple Silicon · macOS 13 or later</p>';
  const banner = `<section class="about-section" data-v-439444c8>${info}</section>`;
  if (source.split(remote).length === 2) {
    const original = '<h2 data-v-439444c8>系统配置</h2>';
    if (source.split(original).length !== 2) throw new Error('Original About system section changed; reconcile the Mac build information before building.');
    return source
      .replace(original, `${info}<h3 data-v-439444c8>Official Windows requirements</h3>`)
      .replace(remote, `t=b(()=>{const html=k("about_content")?String(v("about_content")).trim():"";return html?${JSON.stringify(banner)}+html.replace("系统配置","Official Windows requirements"):""})`);
  }
  const matches = [...source.matchAll(/<h2 (data-v-[^>]+)>系统配置<\/h2>/g)];
  if (matches.length !== 1) throw new Error('Original About system section changed; reconcile the Mac build information before building.');
  return source.replace(matches[0][0], `<h2 ${matches[0][1]}>macOS Rebuild</h2><p ${matches[0][1]}>Unofficial community rebuild · Apple Silicon · macOS 13 or later</p>`);
}

export function patchAutoTappoChestBridge(source) {
  const marker = 'async function zl(e){';
  const start = source.indexOf(marker);
  if (start < 0 || source.split(marker).length !== 2) {
    throw new Error('Original chest-open handler changed; reconcile the AutoTappo bridge before building.');
  }

  // Find the matching closing brace without relying on minified variable
  // names or on a fragile next-function marker.
  const open = source.indexOf('{', start);
  let depth = 0;
  let quote = null;
  let escaped = false;
  let end = -1;
  for (let i = open; i < source.length; i += 1) {
    const ch = source[i];
    if (quote) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') {
      quote = ch;
      continue;
    }
    if (ch === '{') depth += 1;
    else if (ch === '}' && --depth === 0) {
      end = i + 1;
      break;
    }
  }
  if (end < 0) throw new Error('Could not find the chest-open handler boundary.');

  const bridge = `;(()=>{const api=window.__TAURI__,eventApi=api?.event;if(!eventApi?.listen)return;let active=!1,timer=null;const run=()=>{if(!active||Co.value||!R.isLoggedIn)return;qn.value?void zl("left"):Un.value&&void zl("right")};const setActive=e=>{active=e===!0;if(active&&!timer)timer=window.setInterval(run,1000);if(!active&&timer){window.clearInterval(timer);timer=null}};eventApi.listen("autotappo-auto-chest",e=>{const p=e?.payload||{};if(p.place==="left"||p.place==="right"){if(active&&!Co.value&&R.isLoggedIn)void zl(p.place);return}setActive(p.enabled)}).catch(()=>{});api.core?.invoke?.("auto_chest_state").then(setActive).catch(()=>{})})();`;
  return source.slice(0, end) + bridge + source.slice(end);
}

export function patchDockDragHitTesting(source) {
  const interactionGuard = 'if(!pt.value||Me()||It.value)return;if(zt.value){';
  const interactionReplacement = 'if(!pt.value||Me())return;if(It.value){if(t!=="press"||e!=="left")return;let I=Ht(i,l);if(I||(await tn(!1),I=Ht(i,l)),!I)return;const z=document.elementFromPoint(I.x,I.y),dock=ce.value?.querySelector(".pet-dock-content"),rect=dock?.getBoundingClientRect(),onDock=!!rect&&I.x>=rect.left&&I.x<rect.right&&I.y>=rect.top&&I.y<rect.bottom;if(onDock&&!z?.closest("button")){An(!0),Gd(I.x,I.y)}return}if(zt.value){';
  if (source.split(interactionGuard).length !== 2) {
    throw new Error('Original game-mode interaction guard changed; reconcile the dock drag path before building.');
  }
  source = source.replace(interactionGuard, interactionReplacement);

  const original = 'const z=document.elementFromPoint(I.x,I.y);if(!z)return;const ee=z.closest("button");if(ee instanceof HTMLElement){An(!0),ee.classList.contains("emotion-dot")?(Vo=ee,Rc(ee,"pointerdown",I.x,I.y)):ee.click();return}const Z=z.closest("[data-room-cat-id]");if(Z){const _e=Number(Z.dataset.roomCatId),Be=fe.value.find($e=>$e.id===_e);Be&&Qt(Be)&&al(Be,I.x,I.y,Z);return}z.closest(".pet-dock-content")&&(An(!0),Gd(I.x,I.y));return';
  const replacement = 'const z=document.elementFromPoint(I.x,I.y),dock=ce.value?.querySelector(".pet-dock-content"),rect=dock?.getBoundingClientRect(),onDock=!!rect&&I.x>=rect.left&&I.x<rect.right&&I.y>=rect.top&&I.y<rect.bottom;if(!z&&!onDock)return;const ee=z?.closest("button");if(ee instanceof HTMLElement){An(!0),ee.classList.contains("emotion-dot")?(Vo=ee,Rc(ee,"pointerdown",I.x,I.y)):ee.click();return}const Z=z?.closest("[data-room-cat-id]");if(Z){const _e=Number(Z.dataset.roomCatId),Be=fe.value.find($e=>$e.id===_e);Be&&Qt(Be)&&al(Be,I.x,I.y,Z);return}(onDock||z?.closest(".pet-dock-content"))&&(An(!0),Gd(I.x,I.y));return';
  if (source.split(original).length !== 2) {
    throw new Error('Original dock drag hit-test changed; reconcile the drag fallback before building.');
  }
  source = source.replace(original, replacement);

  const dockClick = 'onDockClick:()=>{np()},isInteractionLocked:()=>Me(),';
  const dockClickReplacement = 'onDockClick:()=>{It.value||np()},isInteractionLocked:()=>Me(),';
  if (source.split(dockClick).length !== 2) {
    throw new Error('Original dock click handler changed; reconcile game-mode drag behavior before building.');
  }
  return source.replace(dockClick, dockClickReplacement);
}
