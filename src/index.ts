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
  | { ok: true; value: Record<string, MappingValue>; diagnostics: [] }
  | { ok: false; diagnostics: MappingDiagnostic[] };
export class MappingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MappingError';
  }
}
function validValue(value: unknown): value is MappingValue {
  return (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'boolean' ||
    (typeof value === 'number' && Number.isFinite(value))
  );
}
function fieldName(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    value.length <= 128 &&
    !['__proto__', 'prototype', 'constructor'].includes(value)
  );
}
export function createMappingPlan(input: readonly MappingField[], maxRows = 10000) {
  if (
    !Array.isArray(input) ||
    input.length < 1 ||
    input.length > 128 ||
    !Number.isSafeInteger(maxRows) ||
    maxRows < 1 ||
    maxRows > 100000
  )
    throw new MappingError('Invalid plan bounds.');
  const targets = new Set<string>();
  const fields = input.map((field) => {
    if (
      !field ||
      !fieldName(field.target) ||
      targets.has(field.target) ||
      !['string', 'number', 'boolean'].includes(field.type) ||
      (field.source !== undefined && !fieldName(field.source)) ||
      (field.compute !== undefined && typeof field.compute !== 'function') ||
      (field.compute !== undefined && field.source !== undefined) ||
      (field.required !== undefined && typeof field.required !== 'boolean') ||
      (field.nullable !== undefined && typeof field.nullable !== 'boolean')
    )
      throw new MappingError('Invalid/duplicate mapping field.');
    targets.add(field.target);
    if (
      Object.hasOwn(field, 'defaultValue') &&
      (!validValue(field.defaultValue) ||
        (field.defaultValue === null
          ? !field.nullable
          : typeof field.defaultValue !== field.type) ||
        (typeof field.defaultValue === 'string' && field.defaultValue.length > 100000))
    )
      throw new MappingError('Default does not match target type.');
    return Object.freeze({ ...field });
  });
  const execute = (source: Readonly<Record<string, MappingValue>>): MappingResult => {
    if (
      !source ||
      Object.getPrototypeOf(source) !== Object.prototype ||
      Object.keys(source).length > 128 ||
      Object.getOwnPropertySymbols(source).length
    )
      throw new MappingError('Source must be a bounded plain data record.');
    const copy: Record<string, MappingValue> = {};
    for (const key of Object.keys(source)) {
      const descriptor = Object.getOwnPropertyDescriptor(source, key)!;
      if (
        !fieldName(key) ||
        !('value' in descriptor) ||
        !validValue(descriptor.value) ||
        (typeof descriptor.value === 'string' && descriptor.value.length > 100000)
      )
        throw new MappingError('Invalid source data field.');
      copy[key] = descriptor.value;
    }
    Object.freeze(copy);
    const value: Record<string, MappingValue> = {};
    const diagnostics: MappingDiagnostic[] = [];
    for (const field of fields) {
      let candidate: unknown;
      if (field.compute) {
        try {
          candidate = field.compute(copy);
        } catch (error) {
          diagnostics.push({
            target: field.target,
            code: 'compute',
            message:
              error instanceof Error ? error.message : 'Computation threw a non-Error value.',
          });
          continue;
        }
      } else {
        const key = field.source ?? field.target;
        candidate = Object.hasOwn(copy, key) ? copy[key] : undefined;
      }
      if (candidate === undefined && Object.hasOwn(field, 'defaultValue'))
        candidate = field.defaultValue;
      if (candidate === undefined) {
        if (field.required)
          diagnostics.push({
            target: field.target,
            code: 'missing',
            message: 'Required field is absent.',
          });
        continue;
      }
      if (
        !validValue(candidate) ||
        (candidate === null ? !field.nullable : typeof candidate !== field.type) ||
        (typeof candidate === 'string' && candidate.length > 100000)
      ) {
        diagnostics.push({
          target: field.target,
          code: 'type',
          message: `Expected ${field.type}${field.nullable ? ' or null' : ''}.`,
        });
        continue;
      }
      value[field.target] = candidate;
    }
    return diagnostics.length ? { ok: false, diagnostics } : { ok: true, value, diagnostics: [] };
  };
  return {
    execute,
    preview(rows: readonly Readonly<Record<string, MappingValue>>[]): MappingResult[] {
      if (!Array.isArray(rows) || rows.length > maxRows)
        throw new MappingError('Preview row limit exceeded.');
      return rows.map(execute);
    },
    fields(): readonly Readonly<MappingField>[] {
      return fields.map((field) => ({ ...field }));
    },
  };
}
