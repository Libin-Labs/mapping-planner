# @lp-labs/mapping-planner

Typed scalar mapping plans with defaults, computed fields and explicit preview diagnostics.

Original independent MIT TypeScript implementation with **zero runtime or peer dependencies**. ESM/CommonJS with separate declarations; Node 18+ and compatible browser runtimes. No external code is downloaded or service started at import. TypeScript/Prettier are development-only tools.

## Install

```sh
npm install @lp-labs/mapping-planner
```

## Working example

```js
import assert from 'node:assert/strict';
import { createMappingPlan, MappingError } from '@lp-labs/mapping-planner';
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
```

CommonJS: `const api = require('@lp-labs/mapping-planner')`. Use type-only imports for exported interfaces in TypeScript.

## Behavior, customization, limits and performance

Plain finite scalar source records only, max128 keys and 100,000 UTF-16 units per string. No nested path traversal, expression evaluation, SQL or automatic coercion. Field type string/number/boolean; nullable must be true to accept null. Missing optional fields omitted; missing required fields produce diagnostic. A default is used only for undefined/absent (not null or invalid values); defaults validated at plan creation. A field uses source (defaults to target name) OR a trusted compute callback; callbacks see a frozen copied source record and cannot depend on previously produced target fields. Target names unique and dangerous prototype names forbidden. Plan max128 fields, default preview10,000 rows, ceiling100,000.

execute returns a discriminated MappingResult: ok:true includes complete value; ok:false includes ONLY diagnostics, never a partial success-shaped object. All incompatible and compute failures are collected in plan order. Callback exceptions are surfaced as target-specific compute diagnostics, including Error.message; do not throw secrets into user-visible messages. Structural invalid input throws MappingError rather than a row diagnostic. preview executes per-row and throws for malformed input structure; it does not swallow errors. No writes or rollback adapters; caller decides how to apply successful values. Work O(rows times source keys plus mapping fields), memory O(one record) per execution plus preview output.

## Errors and application integration

Use the exported error class and its documented code (where present); invalid structural input throws rather than silently defaulting. Await async methods and handle rejections. Trusted adapters/callbacks must meet documented ownership and isolation requirements. Hostile proxies and custom prototype objects are outside the contract; ordinary data properties are required. No runtime network/worker/database dependency is hidden behind the API. Examples use Node assertions for reproducible outcomes, not as package dependencies. The declared bounded subset is the supported functionality, not a claim of complete compatibility with another library.

## Complete API and customization contract

The public declaration below specifies all exported functions, field names, options, return shapes and error codes. Configure explicit limits and supply callbacks/adapters through these interfaces; do not modify package internals. Optional fields follow the defaults and missing-data policies above. TypeScript consumers receive this same contract through both ESM and CommonJS exports.

```ts
export type MappingValue = string | number | boolean | null;
export type MappingType = 'string' | 'number' | 'boolean';
export interface MappingField {
  target: string;
  type: MappingType;
  source?: string;
  defaultValue?: MappingValue;
  compute?: (source: Readonly<Record<string, MappingValue>>) => MappingValue;
  required?: boolean;
  nullable?: boolean;
}
export interface MappingDiagnostic {
  target: string;
  code: 'missing' | 'type' | 'compute';
  message: string;
}
export type MappingResult =
  | {
      ok: true;
      value: Record<string, MappingValue>;
      diagnostics: [];
    }
  | {
      ok: false;
      diagnostics: MappingDiagnostic[];
    };
export declare class MappingError extends Error {
  constructor(message: string);
}
export declare function createMappingPlan(
  input: readonly MappingField[],
  maxRows?: number,
): {
  execute: (source: Readonly<Record<string, MappingValue>>) => MappingResult;
  preview(rows: readonly Readonly<Record<string, MappingValue>>[]): MappingResult[];
  fields(): readonly Readonly<MappingField>[];
};
```

## Support

If this library is useful to you, consider supporting its maintenance with a [donation via PayPal](https://www.paypal.me/LibinPrasanth).

## Author

Created by [Libin Prasanth](https://www.linkedin.com/in/libinprasanth/). Connect on LinkedIn for updates and discussion.
