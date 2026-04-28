import { DEFAULT_MAX_PAGES, DEFAULT_PER_PAGE, MAX_PAGES, MAX_PER_PAGE } from "./constants.mjs";
import { JsonRpcError } from "./errors.mjs";

export function ensureObject(value, name) {
  if (!isPlainObject(value)) {
    throw new JsonRpcError(-32602, `${name} must be an object`);
  }
  return value;
}

export function isPlainObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isScalar(value) {
  return ["string", "number", "boolean"].includes(typeof value);
}

export function normalizeString(value, name) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new JsonRpcError(-32602, `${name} must be a non-empty string`);
  }
  return value.trim();
}

export function optionalString(value, name) {
  if (value === undefined) {
    return undefined;
  }
  return normalizeString(value, name);
}

export function optionalBoolean(value, name) {
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== "boolean") {
    throw new JsonRpcError(-32602, `${name} must be a boolean`);
  }
  return value;
}

export function optionalStringArray(value, name) {
  if (value === undefined) {
    return undefined;
  }
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string" || item.trim() === "")) {
    throw new JsonRpcError(-32602, `${name} must be an array of non-empty strings`);
  }
  return value.map((item) => item.trim());
}

export function optionalInteger(value, name, min, max) {
  if (value === undefined) {
    return undefined;
  }
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new JsonRpcError(-32602, `${name} must be an integer between ${min} and ${max}`);
  }
  return value;
}

export function optionalEnum(value, name, allowedValues) {
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== "string" || !allowedValues.includes(value)) {
    throw new JsonRpcError(-32602, `${name} must be one of: ${allowedValues.join(", ")}`);
  }
  return value;
}

export function optionalFlatParamObject(value, name) {
  if (value === undefined) {
    return undefined;
  }
  if (!isPlainObject(value)) {
    throw new JsonRpcError(-32602, `${name} must be an object`);
  }

  for (const [key, entry] of Object.entries(value)) {
    if (key.trim() === "") {
      throw new JsonRpcError(-32602, `${name} contains an empty key`);
    }
    if (Array.isArray(entry)) {
      if (entry.some((item) => item !== null && !isScalar(item))) {
        throw new JsonRpcError(-32602, `${name}.${key} must contain only string, number, or boolean values`);
      }
      continue;
    }
    if (entry !== null && !isScalar(entry)) {
      throw new JsonRpcError(-32602, `${name}.${key} must be a string, number, boolean, null, or array of scalar values`);
    }
  }

  return value;
}

export function ensureAllowedKeys(args, allowedKeys, toolName) {
  for (const key of Object.keys(args)) {
    if (!allowedKeys.includes(key)) {
      throw new JsonRpcError(-32602, `${toolName} does not accept "${key}"`);
    }
  }
}

export function appendMultiValue(target, key, value) {
  if (value === undefined || value === null) {
    return;
  }
  if (!(key in target)) {
    target[key] = value;
    return;
  }
  const existing = target[key];
  if (Array.isArray(existing)) {
    if (Array.isArray(value)) {
      existing.push(...value);
    } else {
      existing.push(value);
    }
    return;
  }
  target[key] = Array.isArray(value) ? [existing, ...value] : [existing, value];
}

export function addIncludeQuery(query, include) {
  if (!include || include.length === 0) {
    return;
  }
  appendMultiValue(query, "include[]", include);
}

export function mergeFlatParams(target, params) {
  if (!params) {
    return target;
  }
  for (const [key, value] of Object.entries(params)) {
    appendMultiValue(target, key, value);
  }
  return target;
}

function appendParamsToSearchParams(searchParams, params) {
  for (const [key, value] of Object.entries(params ?? {})) {
    if (value === undefined || value === null) {
      continue;
    }
    if (Array.isArray(value)) {
      for (const item of value) {
        if (item === undefined || item === null) {
          continue;
        }
        searchParams.append(key, String(item));
      }
      continue;
    }
    searchParams.append(key, String(value));
  }
}

export function readCommonGetArgs(args, baseKeys, toolName) {
  ensureAllowedKeys(args, [...baseKeys, "include", "extra_query"], toolName);
  return {
    include: optionalStringArray(args.include, "include"),
    extraQuery: optionalFlatParamObject(args.extra_query, "extra_query"),
  };
}

export function readCommonListArgs(args, baseKeys, toolName) {
  ensureAllowedKeys(args, [...baseKeys, "include", "per_page", "follow_pagination", "max_pages", "extra_query"], toolName);
  return {
    include: optionalStringArray(args.include, "include"),
    perPage: optionalInteger(args.per_page, "per_page", 1, MAX_PER_PAGE) ?? DEFAULT_PER_PAGE,
    followPagination: optionalBoolean(args.follow_pagination, "follow_pagination") ?? false,
    maxPages: optionalInteger(args.max_pages, "max_pages", 1, MAX_PAGES) ?? DEFAULT_MAX_PAGES,
    extraQuery: optionalFlatParamObject(args.extra_query, "extra_query"),
  };
}
