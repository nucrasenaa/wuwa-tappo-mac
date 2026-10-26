import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const entry = await readFile(new URL('../frontend/assets/index-ULLd3gpz.js', import.meta.url), 'utf8');

test('Global login uses the browser OAuth flow and the configured deep-link callback', () => {
  assert.match(entry, /APP_REGION="GLOBAL"/);
  assert.match(entry, /getOverseasAuthScheme\(\)\{return"wuwa-buddy"/);
  assert.match(entry, /plugin:deep-link\|get_current/);
  assert.match(entry, /deep-link:\/\/new-url/);
  assert.match(entry, /login-wutheringwaves-wuwatappo\.kurogames-global\.com\/login/);
});

test('Global frontend does not depend on the retired CN SDK reload patch', () => {
  assert.doesNotMatch(entry, /t\.dataset\.kuroSdkRetry="true"/);
  assert.doesNotMatch(entry, /async function we\(e=!1\)/);
});
