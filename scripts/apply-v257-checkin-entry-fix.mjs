import fs from 'node:fs';

function update(file, transform) {
  const source = fs.readFileSync(file, 'utf8');
  const next = transform(source);
  if (next === source) console.log(`No additional check-in entry change needed for ${file}`);
  else fs.writeFileSync(file, next);
}

update('src-v2.5.7/checkin-food-seaview.js', (source) => {
  source = source.replace(
    "try{history.replaceState(null,'','#checkin')}catch{}",
    "try{history.replaceState(null,'',location.pathname+location.search+'#checkin')}catch{}",
  );
  source = source.replace(
    "if(location.hash==='#checkin')setTimeout(openPanel,250)",
    "const dedicatedCheckinEntry=location.hash==='#checkin'||new URLSearchParams(location.search).get('checkin')==='1';if(dedicatedCheckinEntry){const ensureCheckin=()=>{const livePanel=document.querySelector('[data-panel=\"checkin\"]');if(!livePanel?.classList.contains('active'))openPanel()};[120,350,800,1500,2800,4500].forEach(delay=>setTimeout(ensureCheckin,delay));window.addEventListener('load',()=>setTimeout(ensureCheckin,60),{once:true})}",
  );
  return source;
});

update('apps/web/checkin.html', (source) => {
  source = source.replace(
    '../index.html?embedded=v3#checkin',
    '../index.html?embedded=v3&checkin=1#checkin',
  );
  if (source.includes('data-checkin-entry-bridge')) return source;
  const bridge = `\n  <script data-checkin-entry-bridge>\n    (() => {\n      const frame = document.querySelector('iframe.frame');\n      if (!frame) return;\n      let timer = 0;\n      const activate = () => {\n        try {\n          const child = frame.contentWindow;\n          const doc = frame.contentDocument;\n          if (!child || !doc) return false;\n          if (child.TravelCheckinSpots?.open) child.TravelCheckinSpots.open();\n          const tab = doc.querySelector('[data-tab=\"checkin\"]');\n          const panel = doc.querySelector('[data-panel=\"checkin\"]');\n          if (!tab || !panel) return false;\n          doc.querySelectorAll('.tab-btn').forEach((node) => {\n            const active = node === tab;\n            node.classList.toggle('active', active);\n            node.setAttribute('aria-selected', String(active));\n          });\n          doc.querySelectorAll('.tab-panel').forEach((node) => node.classList.toggle('active', node === panel));\n          panel.hidden = false;\n          return panel.classList.contains('active');\n        } catch {\n          return false;\n        }\n      };\n      const start = () => {\n        window.clearInterval(timer);\n        const startedAt = Date.now();\n        timer = window.setInterval(() => {\n          const active = activate();\n          if ((active && Date.now() - startedAt > 1200) || Date.now() - startedAt > 12000) {\n            window.clearInterval(timer);\n          }\n        }, 120);\n      };\n      frame.addEventListener('load', start);\n      start();\n    })();\n  <\/script>\n`;
  return source.replace('</body>', `${bridge}</body>`);
});

update('scripts/validate-v3-pages.mjs', (source) =>
  source.replace(
    '../index.html?embedded=v3#checkin',
    '../index.html?embedded=v3&checkin=1#checkin',
  ),
);

console.log('Applied same-origin parent bridge for reliable v2.5.7/v3 check-in activation.');
