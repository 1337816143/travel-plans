import fs from 'node:fs';
import path from 'node:path';
import { gunzipSync } from 'node:zlib';

const names = ['payload-0.b64', 'payload-1.b64', 'payload-2.b64', 'payload-3.b64'];
const baseDir = path.resolve('assets/v1.0.11');

function splitBase64Units(text, label) {
  const clean = text.replace(/[^A-Za-z0-9+/=]/g, '');
  if (!clean) throw new Error(`${label} is empty`);

  const units = [];
  let start = 0;
  for (let i = 0; i < clean.length; i += 1) {
    if (clean[i] === '=') {
      let end = i + 1;
      while (end < clean.length && clean[end] === '=') end += 1;
      units.push(clean.slice(start, end));
      start = end;
      i = end - 1;
    }
  }
  if (start < clean.length) units.push(clean.slice(start));
  return units.filter(Boolean);
}

function decodeUnit(unit, label, index) {
  const core = unit.replace(/=/g, '');
  if (!core) return Buffer.alloc(0);
  const remainder = core.length % 4;
  if (remainder === 1) {
    throw new Error(`${label} segment ${index + 1} has invalid Base64 length`);
  }
  const normalized = core + '='.repeat((4 - remainder) % 4);
  return Buffer.from(normalized, 'base64');
}

const decodedFiles = names.map((name) => {
  const text = fs.readFileSync(path.join(baseDir, name), 'utf8');
  const units = splitBase64Units(text, name);
  const bytes = Buffer.concat(units.map((unit, index) => decodeUnit(unit, name, index)));
  console.log(`${name}: ${text.length} chars, ${units.length} Base64 unit(s), ${bytes.length} decoded bytes`);
  return bytes;
});

const gzip = Buffer.concat(decodedFiles);
if (gzip[0] !== 0x1f || gzip[1] !== 0x8b) {
  throw new Error('Decoded payload does not start with the gzip signature');
}

const html = gunzipSync(gzip).toString('utf8');
if (!/^\s*(?:<!doctype html|<html)/i.test(html)) {
  throw new Error('Decompressed payload is not an HTML document');
}

console.log(`Validated gzip payload: ${gzip.length} compressed bytes -> ${html.length} HTML characters`);
