function fail(path, message) {
  const error = new Error(`${path} ${message}`);
  error.code = "INVALID_TOOL_ARGUMENTS";
  error.data = { path, message };
  throw error;
}

function sameValue(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

export function validateJsonSchema(value, schema, path = "arguments") {
  if (!schema || typeof schema !== "object") return value;
  if (Object.hasOwn(schema, "const") && !sameValue(value, schema.const)) fail(path, `must equal ${JSON.stringify(schema.const)}`);
  if (schema.enum && !schema.enum.some((item) => sameValue(value, item))) fail(path, "is not in the allowed vocabulary");
  const expected = Array.isArray(schema.type) ? schema.type : schema.type ? [schema.type] : [];
  if (expected.length) {
    const actual = value === null ? "null" : Array.isArray(value) ? "array" : Number.isInteger(value) ? "integer" : typeof value;
    const compatible = expected.some((type) => type === actual || (type === "number" && actual === "integer"));
    if (!compatible) fail(path, `must be ${expected.join(" or ")}`);
  }
  if (typeof value === "string") {
    if (schema.minLength !== undefined && value.length < schema.minLength) fail(path, `must have at least ${schema.minLength} characters`);
    if (schema.maxLength !== undefined && value.length > schema.maxLength) fail(path, `must have at most ${schema.maxLength} characters`);
    if (schema.pattern && !(new RegExp(schema.pattern).test(value))) fail(path, "has an invalid format");
  }
  if (typeof value === "number") {
    if (schema.minimum !== undefined && value < schema.minimum) fail(path, `must be at least ${schema.minimum}`);
    if (schema.maximum !== undefined && value > schema.maximum) fail(path, `must be at most ${schema.maximum}`);
  }
  if (Array.isArray(value)) {
    if (schema.minItems !== undefined && value.length < schema.minItems) fail(path, `must contain at least ${schema.minItems} items`);
    if (schema.maxItems !== undefined && value.length > schema.maxItems) fail(path, `must contain at most ${schema.maxItems} items`);
    if (schema.uniqueItems && new Set(value.map((item) => JSON.stringify(item))).size !== value.length) fail(path, "must contain unique items");
    if (schema.items) value.forEach((item, index) => validateJsonSchema(item, schema.items, `${path}[${index}]`));
  }
  if (value && typeof value === "object" && !Array.isArray(value)) {
    for (const key of schema.required ?? []) if (!Object.hasOwn(value, key)) fail(`${path}.${key}`, "is required");
    if (schema.additionalProperties === false) {
      const allowed = new Set(Object.keys(schema.properties ?? {}));
      for (const key of Object.keys(value)) if (!allowed.has(key)) fail(`${path}.${key}`, "is not allowed");
    }
    for (const [key, child] of Object.entries(schema.properties ?? {})) {
      if (Object.hasOwn(value, key)) validateJsonSchema(value[key], child, `${path}.${key}`);
    }
  }
  return value;
}
