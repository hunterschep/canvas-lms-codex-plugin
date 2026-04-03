#!/usr/bin/env node

import process from "node:process";
import { appendFileSync } from "node:fs";
import {
  JsonRpcError,
  PROTOCOL_VERSIONS,
  SERVER_NAME,
  SERVER_VERSION,
  buildToolErrorPayload,
  buildToolResult,
  ensureObject,
  isPlainObject,
  log,
  normalizeString,
} from "./canvas-mcp-core.mjs";
import { TOOL_DEFINITIONS, TOOL_LOOKUP, serializeTool } from "./canvas-mcp-tools.mjs";

let negotiatedProtocolVersion = null;
let initialized = false;
let inputBuffer = Buffer.alloc(0);
let transportMode = null;
const DEBUG_LOG_PATH = "/tmp/canvas-lms-mcp-debug.log";
const keepAliveTimer = setInterval(() => {}, 60_000);

function debug(event, details = undefined) {
  const payload = {
    ts: new Date().toISOString(),
    pid: process.pid,
    event,
    ...(details === undefined ? {} : { details }),
  };

  try {
    appendFileSync(DEBUG_LOG_PATH, `${JSON.stringify(payload)}\n`, "utf8");
  } catch (_error) {
    // Ignore debug logging failures to keep the MCP transport stable.
  }
}

function findHeaderBoundary(buffer) {
  const crlfIndex = buffer.indexOf("\r\n\r\n");
  const lfIndex = buffer.indexOf("\n\n");

  if (crlfIndex === -1) {
    return lfIndex === -1 ? null : { headerEnd: lfIndex, separatorLength: 2 };
  }

  if (lfIndex === -1 || crlfIndex <= lfIndex) {
    return { headerEnd: crlfIndex, separatorLength: 4 };
  }

  return { headerEnd: lfIndex, separatorLength: 2 };
}

function handleDecodedMessage(message) {
  debug("read_message", {
    hasId: Object.prototype.hasOwnProperty.call(message, "id"),
    method: typeof message.method === "string" ? message.method : null,
    id: message.id ?? null,
  });
  void handleMessage(message).catch((error) => {
    log("Unhandled MCP message error", {
      message: error?.message ?? String(error),
      stack: error?.stack,
    });
    debug("handle_message_error", {
      message: error?.message ?? String(error),
    });
  });
}

function tryParseRawJsonMessages() {
  if (inputBuffer.length === 0) {
    return false;
  }

  const text = inputBuffer.toString("utf8");
  const trimmed = text.trimStart();
  if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) {
    return false;
  }

  try {
    const message = JSON.parse(text);
    transportMode = transportMode ?? "raw";
    inputBuffer = Buffer.alloc(0);
    handleDecodedMessage(message);
    return true;
  } catch (_error) {
    // Fall through and try newline-delimited JSON below.
  }

  let start = 0;
  let parsedAny = false;
  for (let index = 0; index < inputBuffer.length; index += 1) {
    if (inputBuffer[index] !== 0x0a) {
      continue;
    }

    const lineStart = start;
    const lineBuffer = inputBuffer.slice(start, index > start && inputBuffer[index - 1] === 0x0d ? index - 1 : index);
    const line = lineBuffer.toString("utf8").trim();
    start = index + 1;

    if (line === "") {
      continue;
    }

    try {
      const message = JSON.parse(line);
      transportMode = transportMode ?? "raw";
      parsedAny = true;
      handleDecodedMessage(message);
    } catch (_error) {
      inputBuffer = inputBuffer.slice(lineStart);
      return parsedAny;
    }
  }

  if (parsedAny) {
    inputBuffer = inputBuffer.slice(start);
  }

  return parsedAny;
}

function writeMessage(message) {
  const json = JSON.stringify(message);
  debug("write_message", {
    transportMode,
    hasId: Object.prototype.hasOwnProperty.call(message, "id"),
    method: message.method ?? null,
    id: message.id ?? null,
  });
  if (transportMode === "raw") {
    process.stdout.write(`${json}\n`);
    return;
  }
  const header = `Content-Length: ${Buffer.byteLength(json, "utf8")}\r\n\r\n`;
  process.stdout.write(header + json);
}

function writeResult(id, result) {
  writeMessage({ jsonrpc: "2.0", id, result });
}

function writeError(id, error) {
  writeMessage({
    jsonrpc: "2.0",
    id,
    error: {
      code: error.code ?? -32603,
      message: error.message ?? "Internal error",
      ...(error.data === undefined ? {} : { data: error.data }),
    },
  });
}

function parseContentLength(headerText) {
  const lines = headerText.split(/\r?\n/);
  for (const line of lines) {
    const separatorIndex = line.indexOf(":");
    if (separatorIndex === -1) {
      continue;
    }
    const key = line.slice(0, separatorIndex).trim().toLowerCase();
    const value = line.slice(separatorIndex + 1).trim();
    if (key === "content-length") {
      const parsed = Number.parseInt(value, 10);
      return Number.isFinite(parsed) ? parsed : null;
    }
  }
  return null;
}

function parseMessages() {
  while (true) {
    const boundary = findHeaderBoundary(inputBuffer);
    if (!boundary) {
      if (tryParseRawJsonMessages()) {
        continue;
      }
      return;
    }

    transportMode = transportMode ?? "framed";
    const { headerEnd, separatorLength } = boundary;
    const headerText = inputBuffer.slice(0, headerEnd).toString("utf8");
    const contentLength = parseContentLength(headerText);

    if (!Number.isFinite(contentLength) || contentLength < 0) {
      log("Dropping malformed MCP frame header", { headerText });
      inputBuffer = Buffer.alloc(0);
      return;
    }

    const messageEnd = headerEnd + separatorLength + contentLength;
    if (inputBuffer.length < messageEnd) {
      return;
    }

    const bodyBuffer = inputBuffer.slice(headerEnd + separatorLength, messageEnd);
    inputBuffer = inputBuffer.slice(messageEnd);

    let message;
    try {
      message = JSON.parse(bodyBuffer.toString("utf8"));
    } catch (error) {
      log("Dropping malformed MCP JSON payload", { error: error.message });
      debug("drop_malformed_json", { error: error.message });
      continue;
    }

    handleDecodedMessage(message);
  }
}

async function dispatchRequest(method, params) {
  if (method !== "initialize" && method !== "ping" && negotiatedProtocolVersion === null) {
    throw new JsonRpcError(-32002, "Server has not been initialized");
  }

  switch (method) {
    case "initialize": {
      const request = ensureObject(params ?? {}, "initialize params");
      const requestedVersion = normalizeString(request.protocolVersion ?? PROTOCOL_VERSIONS[0], "protocolVersion");
      negotiatedProtocolVersion = PROTOCOL_VERSIONS.includes(requestedVersion) ? requestedVersion : PROTOCOL_VERSIONS[0];
      return {
        protocolVersion: negotiatedProtocolVersion,
        capabilities: {
          tools: {
            listChanged: false,
          },
        },
        serverInfo: {
          name: SERVER_NAME,
          title: "Canvas LMS",
          version: SERVER_VERSION,
          description: "Canvas LMS API tools for Codex",
        },
        instructions:
          "Use the student-focused Canvas tools for courses, grades, planner items, calendar items, pages, assignments, quizzes, announcements, modules, and submissions. Use canvas_request only for unsupported /api/v1 or /api/quiz/v1 endpoints and explicit writes.",
      };
    }
    case "ping":
      return {};
    case "tools/list":
      return {
        tools: TOOL_DEFINITIONS.map(serializeTool),
      };
    case "tools/call": {
      const request = ensureObject(params ?? {}, "tools/call params");
      const toolName = normalizeString(request.name, "name");
      const tool = TOOL_LOOKUP.get(toolName);
      if (!tool) {
        throw new JsonRpcError(-32602, `Unknown tool: ${toolName}`);
      }
      try {
        const payload = await tool.handler(request.arguments ?? {});
        return buildToolResult(payload, false);
      } catch (error) {
        if (error instanceof JsonRpcError) {
          throw error;
        }
        return buildToolResult(buildToolErrorPayload(error), true);
      }
    }
    default:
      throw new JsonRpcError(-32601, `Method not found: ${method}`);
  }
}

async function handleMessage(message) {
  if (!isPlainObject(message) || message.jsonrpc !== "2.0") {
    log("Ignoring invalid JSON-RPC message", message);
    return;
  }

  const hasId = Object.prototype.hasOwnProperty.call(message, "id");

  if (typeof message.method === "string") {
    if (!hasId) {
      if (message.method === "notifications/initialized" || message.method === "initialized") {
        initialized = true;
      }
      return;
    }

    try {
      const result = await dispatchRequest(message.method, message.params);
      writeResult(message.id, result);
    } catch (error) {
      if (error instanceof JsonRpcError) {
        writeError(message.id, error);
        return;
      }

      log("Unexpected request error", {
        method: message.method,
        error: error?.message ?? String(error),
        stack: error?.stack,
      });

      writeError(
        message.id,
        new JsonRpcError(-32603, "Internal error", {
          method: message.method,
        }),
      );
    }
  }
}

process.stdin.on("data", (chunk) => {
  debug("stdin_data", {
    bytes: chunk.length,
    preview: chunk.slice(0, 160).toString("utf8"),
    hex: chunk.slice(0, 48).toString("hex"),
  });
  inputBuffer = Buffer.concat([inputBuffer, chunk]);
  parseMessages();
});

process.stdin.resume();
debug("server_start", {
  cwd: process.cwd(),
  argv: process.argv.slice(2),
  hasCanvasBaseUrl: Boolean(process.env.CANVAS_BASE_URL),
  hasCanvasAccessToken: Boolean(process.env.CANVAS_ACCESS_TOKEN || process.env.CANVAS_API_TOKEN),
});

process.stdin.on("end", () => {
  debug("stdin_end");
});

process.on("uncaughtException", (error) => {
  log("Uncaught exception", {
    message: error.message,
    stack: error.stack,
    initialized,
    protocolVersion: negotiatedProtocolVersion,
  });
  debug("uncaught_exception", { message: error.message });
});

process.on("unhandledRejection", (reason) => {
  log("Unhandled rejection", reason);
  debug("unhandled_rejection", {
    message: reason?.message ?? String(reason),
  });
});
