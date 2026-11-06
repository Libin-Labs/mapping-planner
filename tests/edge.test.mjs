import test from 'node:test';
import assert from 'node:assert/strict';
import { createMappingPlan } from '../dist/esm/index.js';

test('oversized defaults reject before creating an executable plan', () => {
  assert.throws(() =>
    createMappingPlan([{ target: 'x', type: 'string', defaultValue: 'a'.repeat(100001) }]),
  );
});

test('computed wrong type and non-Error exceptions are explicit diagnostics', () => {
  const plan = createMappingPlan([
    { target: 'wrong', type: 'number', compute: () => '1' },
    {
      target: 'thrown',
      type: 'string',
      compute() {
        throw undefined;
      },
    },
  ]);
  const result = plan.execute({});
  assert.equal(result.ok, false);
  assert.deepEqual(
    result.diagnostics.map((item) => item.code),
    ['type', 'compute'],
  );
});
