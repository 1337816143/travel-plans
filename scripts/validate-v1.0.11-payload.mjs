import fs from 'node:fs';
import path from 'node:path';
import { gunzipSync } from 'node:zlib';

const assetsRoot = path.resolve('assets');

function cleanBase64(text) {
  return text.replace(/[^A-Za-z0-9+/=]/g, '');
}

function decodeSingle(text) {
  const clean = cleanBase64(text);
  const core = clean.replace(/=/g, '');
  const remainder = core.length % 4;
  if (remainder === 1) throw new Error('invalid Base64 length');
  return Buffer.from(core + '='.repeat((4 - remainder) % 4), 'base64');
}

function tryGunzip(label, bytes) {
  try {
    const html = gunzipSync(bytes).toString('utf8');
    const validHtml = /^\s*(?:<!doctype html|<html)/i.test(html);
    console.log(`${label}: SUCCESS gzip=${bytes.length}, html=${html.length}, validHtml=${validHtml}`);
    return validHtml;
  } catch (error) {
    console.log(`${label}: FAIL ${error.code ?? ''} ${error.message}`);
    return false;
  }
}

const versions = fs.readdirSync(assetsRoot, { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && /^v\d/.test(entry.name))
  .map((entry) => entry.name)
  .sort((a, b) => b.localeCompare(a, undefined, { numeric: true }));

let newestValid = null;
for (const version of versions) {
  const dir = path.join(assetsRoot, version);
  const names = fs.readdirSync(dir).filter((name) => /^payload-.*\.b64$/.test(name)).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  if (!names.length) continue;

  console.log(`VERSION ${version}: files=${names.join(',')}`);
  const texts = names.map((name) => fs.readFileSync(path.join(dir, name), 'utf8'));
  texts.forEach((text, index) => {
    const clean = cleanBase64(text);
    const core = clean.replace(/=/g, '');
    console.log(`  ${names[index]} text=${text.length} clean=${clean.length} core=${core.length} padding=${clean.length-core.length}`);
  });

  let valid = false;
  try {
    valid ||= tryGunzip(`  ${version} per-file decode`, Buffer.concat(texts.map(decodeSingle)));
  } catch (error) {
    console.log(`  ${version} per-file decode: FAIL ${error.message}`);
  }

  try {
    const joined = cleanBase64(texts.join('')).replace(/=/g, '');
    const remainder = joined.length % 4;
    if (remainder === 1) throw new Error('invalid joined Base64 length');
    valid ||= tryGunzip(`  ${version} joined-text decode`, Buffer.from(joined + '='.repeat((4-remainder)%4), 'base64'));
  } catch (error) {
    console.log(`  ${version} joined-text decode: FAIL ${error.message}`);
  }

  if (valid && !newestValid) newestValid = version;
}

if (!newestValid) throw new Error('No valid compressed HTML payload was found');
console.log(`NEWEST_VALID_VERSION=${newestValid}`);
