export const sources = [
  'https://developers.openai.com/api/docs/guides/model-selection',
  'https://developers.openai.com/codex/models',
];
const choices = {
  extraction: ['gpt-6-luna', 'low'],
  scoped_fix: ['gpt-6.1-terra', 'medium'],
  technical: ['gpt-6.1-sol', 'medium'],
  conflicting_evidence: ['gpt-6.1-sol', 'xhigh'],
  demanding_analysis: ['gpt-6.1-sol', 'high'],
};
export function recommend({workload, live_catalog, user_model, user_effort, astra_necessity}) {
  // 공식 작업별 예시를 현재 host의 지원 조합과 대조하며 실제 모델 변경 권한은 부여하지 않음
  const choice = choices[workload];
  const catalog = JSON.parse(live_catalog);
  if (!choice || !Array.isArray(catalog) || !catalog.length || catalog.some(item => typeof item?.model !== 'string' || !Array.isArray(item.efforts) || item.efforts.some(e => typeof e !== 'string'))) throw new Error('Provide workload and current host catalog');
  if (astra_necessity !== undefined && (typeof astra_necessity !== 'string' || !astra_necessity.trim() || astra_necessity.length > 1000)) throw new Error('Explain why Astra is necessary');
  const model = user_model || (astra_necessity ? 'gpt-6-astra' : choice[0]);
  if (model === 'gpt-6-astra' && !astra_necessity) throw new Error('Astra requires a concrete necessity justification');
  const thinking = user_effort || (model === 'gpt-6-astra' ? 'low' : choice[1]);
  const supported = catalog.find(item => item.model === model && item.efforts.includes(thinking));
  return {recommendation: supported ? {model, thinking} : null, preserve_default: !supported,
    reason: supported ? (user_model ? 'Explicit user model preserved; verify its requested effort.' : `Task-specific starting point for ${workload}; validate with the same acceptance checks.`) : 'Recommended combination is unavailable; preserve user defaults and refresh official guidance.',
    sources, guidanceChecked: '2026-11-17', astraNecessity: astra_necessity || null,
    costWarning: 'Astra is an exceptional escalation. Higher reasoning may rapidly consume token/usage budgets; begin at low, keep inputs bounded, and raise effort only with a documented need. This is a conservative plugin policy, not a measured usage guarantee.',
    caveats: ['Recommendation only: current host rules govern whether model/thinking overrides may be passed.',
      'create_thread requires an explicit user request for a specific model before passing model; automatic routing intent alone is insufficient.',
      'Terra medium is a plugin starting choice, not an effort mandated by the official Terra page.',
      'Codex general defaults and task-specific examples differ. Do not infer cost, quality, or speed guarantees; Max/Ultra are not selected automatically.']};
}
