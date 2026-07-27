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

console.log(`HTML length: ${html.length}`);
console.log(`Title: ${html.match(/<title>(.*?)<\/title>/i)?.[1] ?? 'unknown'}`);

const sections = [];
const add = (label, value) => {
  if (!value) return;
  sections.push(`\n===== ${label} =====\n${value}`);
};

const ids = [...html.matchAll(/id=["']([^"']+)["']/gi)].map(m => m[1]);
add('IDS containing panel/map/toggle/base/weather/search/route', [...new Set(ids.filter(id => /(panel|map|toggle|base|weather|search|route|traffic|locat)/i.test(id)))].join('\n'));

const buttons = [...html.matchAll(/<button\b[^>]*>[\s\S]*?<\/button>/gi)].map(m => m[0]);
add('BUTTONS', buttons.join('\n'));

const external = [...html.matchAll(/<(?:script|link)\b[^>]*(?:src|href)=["']([^"']+)["'][^>]*>/gi)].map(m => m[0]);
add('EXTERNAL RESOURCES', external.join('\n'));

const patterns = [
  ['CSS variables / panel layout', /:root\s*\{[^}]*\}|#app\s*\{[^}]*\}|\.app\s*\{[^}]*\}|#sidebar\s*\{[^}]*\}|#panel\s*\{[^}]*\}|\.panel\s*\{[^}]*\}/gi],
  ['Toggle CSS', /[^{}]*(?:toggle|collapse|edge)[^{}]*\{[^}]*\}/gi],
  ['Media queries', /@media[^\{]*\{[\s\S]{0,1600}?\}\s*\}/gi],
  ['Leaflet map creation', /L\.map\([^;]{0,800};/gi],
  ['Tile layers', /L\.tileLayer\([\s\S]{0,700}?\);/gi],
  ['Basemap configuration', /(?:baseMaps|basemaps|baseLayers|tileConfigs|mapLayers)\s*=\s*\{[\s\S]{0,2500}?\};/gi],
  ['Layer control', /L\.control\.layers\([\s\S]{0,1000}?\);/gi],
  ['Tile error handling', /[^;]{0,500}(?:tileerror|errorTileUrl|loading|load)[^;]{0,500};/gi],
  ['Toggle JavaScript', /[^;]{0,700}(?:toggle|collapse|panelOpen|panelCollapsed)[^;]{0,700};/gi],
  ['Map event handlers', /map\.on\([\s\S]{0,800}?\);/gi],
  ['Fetch / API functions', /(?:async\s+function|const\s+\w+\s*=\s*async|function)\s+\w*[^\{]{0,200}\{[\s\S]{0,1200}?\}/gi],
];

for (const [label, regex] of patterns) {
  const matches = [...html.matchAll(regex)].slice(0, 30).map((m, i) => `--- ${i + 1} ---\n${m[0]}`);
  add(label, matches.join('\n'));
}

const needles = [
  'panelToggle','panel-toggle','edge-toggle','sidebarToggle','desktop','mobile','subdomains','createTileLayer','baseMaps','basemaps','baseLayers','L.control.layers','tileerror','invalidateSize','map-column','mapColumn'
];
for (const needle of needles) {
  let start = 0;
  const hits = [];
  while (hits.length < 12) {
    const index = html.indexOf(needle, start);
    if (index < 0) break;
    hits.push(html.slice(Math.max(0, index - 700), Math.min(html.length, index + 1200)));
    start = index + needle.length;
  }
  add(`CONTEXT: ${needle}`, hits.map((x, i) => `--- ${i + 1} ---\n${x}`).join('\n'));
}

console.log(sections.join('\n'));
