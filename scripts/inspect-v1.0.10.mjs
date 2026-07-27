import fs from 'node:fs';
import path from 'node:path';
import { gunzipSync } from 'node:zlib';

const baseDir = path.resolve('assets/v1.0.10');
const names = ['payload-0.b64','payload-1.b64','payload-2.b64','payload-3.b64'];
const parts = names.map((name) => {
  const text = fs.readFileSync(path.join(baseDir, name), 'utf8').replace(/[^A-Za-z0-9+/=]/g, '');
  const core = text.replace(/=/g, '');
  const padded = core + '='.repeat((4 - (core.length % 4)) % 4);
  return Buffer.from(padded, 'base64');
});
const html = gunzipSync(Buffer.concat(parts)).toString('utf8');

const sections = [];
const add = (label, lines) => {
  const values = Array.isArray(lines) ? lines : [lines];
  if (!values.some(Boolean)) return;
  sections.push(`===== ${label} =====`, ...values.filter(Boolean), '');
};
const compact = (value, limit = 1800) => value.replace(/\s+/g, ' ').trim().slice(0, limit);

add('SUMMARY', [
  `HTML length: ${html.length}`,
  `Title: ${html.match(/<title>(.*?)<\/title>/i)?.[1] ?? 'unknown'}`,
]);

const ids = [...html.matchAll(/id=["']([^"']+)["']/gi)].map(m => m[1]);
add('RELEVANT IDS', [...new Set(ids.filter(id => /(panel|map|toggle|base|weather|search|route|traffic|locat|toolbar|control)/i.test(id)))]);

const tags = [...html.matchAll(/<(?:button|select|input|aside|main|section|div)\b[^>]*(?:id|class)=["'][^"']*(?:panel|map|toggle|base|weather|search|route|traffic|locat|toolbar|control)[^"']*["'][^>]*>/gi)]
  .map(m => compact(m[0], 1200));
add('RELEVANT DOM TAGS', [...new Set(tags)]);

const external = [...html.matchAll(/<(?:script|link)\b[^>]*(?:src|href)=["']([^"']+)["'][^>]*>/gi)].map(m => compact(m[0], 1200));
add('EXTERNAL RESOURCES', external);

const styles = [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)].map(m => m[1]).join('\n');
const cssRules = [...styles.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
  .map(m => `${compact(m[1], 500)} { ${compact(m[2], 1300)} }`)
  .filter(rule => /(panel|toggle|edge|map-shell|map-wrap|map-column|sidebar|@media|--panel|desktop|mobile)/i.test(rule));
add('RELEVANT CSS RULES', cssRules);

const scripts = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)].map(m => m[1]).join('\n');
const needles = [
  'panelToggle','panel-toggle','edge-toggle','sidebarToggle','togglePanel','collapse','desktop','mobile',
  'createTileLayer','tileConfigs','baseMaps','basemaps','baseLayers','L.control.layers','tileerror','invalidateSize',
  'L.map','L.tileLayer','map.on','layerControl','subdomains'
];
for (const needle of needles) {
  const hits = [];
  let start = 0;
  while (hits.length < 8) {
    const index = scripts.indexOf(needle, start);
    if (index < 0) break;
    hits.push(compact(scripts.slice(Math.max(0, index - 900), Math.min(scripts.length, index + 1800)), 2700));
    start = index + needle.length;
  }
  add(`SCRIPT CONTEXT: ${needle}`, [...new Set(hits)]);
}

const functionNames = [...scripts.matchAll(/(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(|(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?\([^)]*\)\s*=>/g)]
  .map(m => m[1] || m[2])
  .filter(name => /(map|tile|layer|panel|route|search|weather|traffic|geo|locat|base|poi)/i.test(name));
add('RELEVANT FUNCTION NAMES', [...new Set(functionNames)]);

fs.mkdirSync('diagnostics', { recursive: true });
fs.writeFileSync('diagnostics/v1.0.10-report.txt', sections.join('\n'));
console.log(`Wrote diagnostics/v1.0.10-report.txt (${sections.length} lines/entries)`);
