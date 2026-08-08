import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');

function patch(pathname, transform) {
  const file = path.join(ROOT, pathname);
  const source = fs.readFileSync(file, 'utf8');
  const next = transform(source);
  if (next === source) throw new Error(`No change applied to ${pathname}`);
  fs.writeFileSync(file, next);
}

patch('apps/web/src/view.ts', (source) => {
  const pattern = /<label><span>旅行天数<\/span><select data-field="total-days">[\s\S]*?<\/select><\/label>/;
  if (!pattern.test(source)) throw new Error('Travel-day select block not found');
  return source.replace(
    pattern,
    `<label><span>旅行天数</span><span class="days-input-wrap"><input type="number" min="1" step="1" inputmode="numeric" data-field="total-days" value="\${escapeHtml(String(state.form.totalDays))}" aria-describedby="total-days-hint" /><small id="total-days-hint">正整数，不设产品上限</small></span></label>`,
  );
});

patch('apps/web/src/main.ts', (source) => {
  const oldBlock = `      if (target.dataset.field === 'total-days') {\n        this.state = {\n          ...this.state,\n          form: { ...this.state.form, totalDays: Number(target.value) },\n          status: { tone: 'info', message: '旅行天数已修改；点击“重新生成”应用设置。' },\n        };\n        this.render();\n        return;\n      }`;
  if (!source.includes(oldBlock)) throw new Error('total-days change handler not found');
  const nextBlock = `      if (target.dataset.field === 'total-days') {\n        const totalDays = Number(target.value);\n        if (!Number.isSafeInteger(totalDays) || totalDays < 1) {\n          this.setStatus({ tone: 'error', message: '旅行天数请输入 1 以上的正整数。' });\n          return;\n        }\n        this.state = {\n          ...this.state,\n          form: { ...this.state.form, totalDays },\n          status: {\n            tone: 'info',\n            message: \\`旅行天数已改为 \\${totalDays} 天；点击“重新生成”应用设置。\\`,\n          },\n        };\n        this.render();\n        return;\n      }`;
  return source.replace(oldBlock, nextBlock).replace("const PLANNER_VERSION = '0.5.0-phase4';", "const PLANNER_VERSION = '0.5.1-unlimited-days';");
});

patch('packages/schema/src/trip-request.ts', (source) => {
  const totalDays = '  totalDays: z.number().int().min(1).max(30).nullable(),';
  const effectiveDays = '  effectiveDays: z.number().int().min(1).max(30),';
  if (!source.includes(totalDays) || !source.includes(effectiveDays)) {
    throw new Error('30-day schema limits not found');
  }
  return source
    .replace(totalDays, '  totalDays: z.number().int().min(1).nullable(),')
    .replace(effectiveDays, '  effectiveDays: z.number().int().min(1),');
});

console.log('Applied unlimited planner day input and schema migration.');
