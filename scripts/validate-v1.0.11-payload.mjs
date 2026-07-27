import fs from 'node:fs';
import path from 'node:path';
import { gunzipSync } from 'node:zlib';

const names = ['payload-0.b64', 'payload-1.b64', 'payload-2.b64', 'payload-3.b64'];
const baseDir = path.resolve('assets/v1.0.11');

function cleanBase64(text) {
  return text.replace(/[^A-Za-z0-9+/=]/g, '');
}

function decodeFile(text, label) {
  const clean = cleanBase64(text);
  if (!clean) throw new Error(`${label} is empty`);
  const core = clean.replace(/=/g, '');
  const remainder = core.length % 4;
  if (remainder === 1) throw new Error(`${label} has invalid Base64 length`);
  const normalized = core + '='.repeat((4 - remainder) % 4);
  return {
    cleanLength: clean.length,
    coreLength: core.length,
    paddingCount: clean.length - core.length,
    bytes: Buffer.from(normalized, 'base64'),
  };
}

const decoded = names.map((name) => {
  const text = fs.readFileSync(path.join(baseDir, name), 'utf8');
  const result = decodeFile(text, name);
  console.log(`${name}: text=${text.length}, clean=${result.cleanLength}, core=${result.coreLength}, padding=${result.paddingCount}, bytes=${result.bytes.length}, head=${result.bytes.subarray(0,8).toString('hex')}, tail=${result.bytes.subarray(-8).toString('hex')}`);
  return result.bytes;
});

function permutations(values) {
  if (values.length <= 1) return [values];
  return values.flatMap((value, index) => permutations(values.filter((_, i) => i !== index)).map((tail) => [value, ...tail]));
}

let success = false;
for (const order of permutations([1, 2, 3])) {
  const sequence = [0, ...order];
  const gzip = Buffer.concat(sequence.map((index) => decoded[index]));
  try {
    const html = gunzipSync(gzip).toString('utf8');
    const validHtml = /^\s*(?:<!doctype html|<html)/i.test(html);
    console.log(`ORDER ${sequence.join('')} SUCCESS: gzip=${gzip.length}, html=${html.length}, validHtml=${validHtml}`);
    success ||= validHtml;
  } catch (error) {
    console.log(`ORDER ${sequence.join('')} FAIL: ${error.code ?? ''} ${error.message}`);
  }
}

for (let count = 1; count <= 4; count += 1) {
  const gzip = Buffer.concat(decoded.slice(0, count));
  try {
    const html = gunzipSync(gzip).toString('utf8');
    console.log(`PREFIX ${count} SUCCESS: html=${html.length}`);
  } catch (error) {
    console.log(`PREFIX ${count} FAIL: ${error.code ?? ''} ${error.message}`);
  }
}

if (!success) throw new Error('No payload ordering produced a valid gzip HTML document');
