import { createMappingPlan, MappingError } from '@lp-labs/mapping-planner';
const api = [createMappingPlan, MappingError];
void api;
const plan = createMappingPlan([{ target: 'x', type: 'number', required: true }]);
const result = plan.execute({ x: 1 });
if (result.ok) {
  const value: number | string | boolean | null = result.value.x!;
  void value;
} else {
  const code: 'missing' | 'type' | 'compute' = result.diagnostics[0]!.code;
  void code;
}
// @ts-expect-error unsupported target type
createMappingPlan([{ target: 'x', type: 'object' }]);
