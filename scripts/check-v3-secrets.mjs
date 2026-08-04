import fs from 'node:fs';
import path from 'node:path';

const roots = ['apps', 'data/qingdao', 'packages'];
const extensions = new Set(['.js', '.json', '.mjs', '.ts', '.tsx']);
const forbidden = [
  { label: '高德前端密钥常量', pattern: /AMAP_(?:JS|WEB)_KEY/i },
  { label: '高德 securityJsCode', pattern: /securityJsCode/i },
  { label: '疑似 32 位十六进制密钥', pattern: /['"][a-f0-9]{32}['"]/i },
];

function filesIn(root) {
  if (!fs.existsSync(root)) return [];
  return fs.readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const target = path.join(root, entry.name);
    return entry.isDirectory() ? filesIn(target) : [target];
  });
}

const failures = [];
for (const file of roots.flatMap(filesIn).filter((item) => extensions.has(path.extname(item)))) {
  const source = fs.readFileSync(file, 'utf8');
  for (const rule of forbidden) {
    if (rule.pattern.test(source)) failures.push(`${file}: ${rule.label}`);
  }
}

if (failures.length > 0) {
  console.error(failures.join('\n'));
  process.exitCode = 1;
} else {
  console.log('v3 secret scan passed: no Legacy frontend credentials were copied.');
}
