import test from 'node:test';
import assert from 'node:assert/strict';
import { createMappingPlan, MappingError } from '../dist/esm/index.js';
test('documented workflow produces required outputs', async () => {
  const plan = createMappingPlan([
    { target: 'name', source: 'fullName', type: 'string', required: true },
    { target: 'active', type: 'boolean', defaultValue: true },
    { target: 'double', type: 'number', compute: (row) => Number(row.quantity) * 2 },
  ]);
  const result = plan.execute({ fullName: 'Alice', quantity: 3 });
  assert.equal(result.ok, true);
  if (result.ok) assert.deepEqual(result.value, { name: 'Alice', active: true, double: 6 });
  const preview = plan.preview([{ quantity: 2 }]);
  assert.equal(preview[0].ok, false);
});
test('defaults apply only to missing and null requires explicit allowance', () => {
  const p = createMappingPlan([{ target: 'x', type: 'string', defaultValue: 'default' }]);
  assert.equal(p.execute({}).value.x, 'default');
  assert.equal(p.execute({ x: null }).ok, false);
  assert.equal(
    createMappingPlan([{ target: 'x', type: 'string', nullable: true }]).execute({ x: null }).value
      .x,
    null,
  );
});
test('failure includes diagnostics and no partial mapped data', () => {
  const p = createMappingPlan([
    { target: 'a', type: 'number', required: true },
    { target: 'b', type: 'string', required: true },
  ]);
  const r = p.execute({ a: 'wrong' });
  assert.equal(r.ok, false);
  assert.deepEqual(
    r.diagnostics.map((d) => d.code),
    ['type', 'missing'],
  );
  assert.equal(Object.hasOwn(r, 'value'), false);
});
test('callback failure is explicit and other diagnostics retained', () => {
  const p = createMappingPlan([
    {
      target: 'x',
      type: 'number',
      compute() {
        throw Error('calculation');
      },
    },
    { target: 'y', type: 'number', required: true },
  ]);
  const r = p.execute({});
  assert.deepEqual(
    r.diagnostics.map((d) => d.code),
    ['compute', 'missing'],
  );
  assert.equal(r.diagnostics[0].message, 'calculation');
});
test('callbacks receive frozen sources, not earlier mapped fields', () => {
  let observed;
  const p = createMappingPlan([
    { target: 'first', type: 'number', defaultValue: 1 },
    {
      target: 'second',
      type: 'number',
      compute(row) {
        observed = row;
        return Object.hasOwn(row, 'first') ? 99 : 2;
      },
    },
  ]);
  assert.equal(p.execute({}).value.second, 2);
  assert.equal(Object.isFrozen(observed), true);
});
test('plan copies settings and rejects conflicting/duplicate fields', () => {
  const field = { target: 'x', type: 'number', defaultValue: 1 };
  const p = createMappingPlan([field]);
  field.defaultValue = 9;
  assert.equal(p.execute({}).value.x, 1);
  assert.throws(() => createMappingPlan([field, field]), MappingError);
  assert.throws(() =>
    createMappingPlan([{ target: 'x', type: 'number', source: 'a', compute: () => 1 }]),
  );
});
test('invalid defaults, prototype names, nonfinite results reject', () => {
  assert.throws(() => createMappingPlan([{ target: 'x', type: 'number', defaultValue: 'bad' }]));
  assert.throws(() => createMappingPlan([{ target: '__proto__', type: 'string' }]));
  assert.equal(
    createMappingPlan([{ target: 'x', type: 'number', compute: () => Infinity }]).execute({}).ok,
    false,
  );
});
test('getter inputs are rejected without invocation and preview bounds hold', () => {
  let called = false;
  const source = {};
  Object.defineProperty(source, 'x', {
    enumerable: true,
    get() {
      called = true;
      return 1;
    },
  });
  const p = createMappingPlan([{ target: 'x', type: 'number' }], 1);
  assert.throws(() => p.execute(source));
  assert.equal(called, false);
  assert.throws(() => p.preview([{}, {}]));
});
