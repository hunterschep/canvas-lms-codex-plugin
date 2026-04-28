import process from "node:process";

export class JsonRpcError extends Error {
  constructor(code, message, data) {
    super(message);
    this.code = code;
    this.data = data;
  }
}

export class ToolExecutionError extends Error {
  constructor(message, details = undefined) {
    super(message);
    this.details = details;
  }
}

export class CanvasApiError extends ToolExecutionError {}

export function log(message, details) {
  const suffix = details === undefined ? "" : ` ${safeStringify(details)}`;
  process.stderr.write(`[canvas-mcp] ${message}${suffix}\n`);
}

export function safeStringify(value) {
  if (typeof value === "string") {
    return value;
  }
  try {
    return JSON.stringify(value, null, 2);
  } catch (_error) {
    return String(value);
  }
}
