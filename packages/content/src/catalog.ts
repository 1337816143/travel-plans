import { ContentCatalogSchema, type ItineraryModule, type PresetPlan } from '@qingdao/schema';

import { QINGDAO_PHASE4_CANDIDATE_CATALOG } from '../../../data/qingdao/content/phase4-candidate.v1.js';

export const QINGDAO_CONTENT_CATALOG = ContentCatalogSchema.parse(QINGDAO_PHASE4_CANDIDATE_CATALOG);

const moduleById = new Map(
  QINGDAO_CONTENT_CATALOG.itineraryModules.map((entry) => [entry.id, entry]),
);
const presetById = new Map(QINGDAO_CONTENT_CATALOG.presetPlans.map((entry) => [entry.id, entry]));

export function qingdaoItineraryModuleById(id: string): ItineraryModule | undefined {
  return moduleById.get(id);
}

export function qingdaoPresetById(id: string): PresetPlan | undefined {
  return presetById.get(id);
}

export function qingdaoModulesForPreset(preset: PresetPlan): readonly ItineraryModule[] {
  return preset.moduleIds.map((moduleId) => {
    const module = qingdaoItineraryModuleById(moduleId);
    if (!module) throw new Error(`青岛预设引用了缺失模块：${moduleId}`);
    return module;
  });
}
