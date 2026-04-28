import process from "node:process";
import { DEFAULT_TIMEOUT_MS, SERVER_VERSION, SUPPORTED_METHODS } from "./constants.mjs";
import { CanvasApiError, JsonRpcError, ToolExecutionError } from "./errors.mjs";
import { isPlainObject, isScalar } from "./validation.mjs";

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

export function getCanvasConfig() {
  const baseUrl = process.env.CANVAS_BASE_URL?.trim();
  const accessToken = process.env.CANVAS_ACCESS_TOKEN?.trim() || process.env.CANVAS_API_TOKEN?.trim();

  if (!baseUrl) {
    throw new ToolExecutionError("Missing CANVAS_BASE_URL. Export it before starting Codex.");
  }

  if (!accessToken) {
    throw new ToolExecutionError("Missing CANVAS_ACCESS_TOKEN. Export it before starting Codex.");
  }

  let normalizedBaseUrl;
  try {
    normalizedBaseUrl = new URL(baseUrl);
  } catch (_error) {
    throw new ToolExecutionError("CANVAS_BASE_URL is not a valid URL.", { baseUrl });
  }

  const protocol = normalizedBaseUrl.protocol;
  if (protocol !== "https:" && protocol !== "http:") {
    throw new ToolExecutionError("CANVAS_BASE_URL must use http or https.", {
      baseUrl,
      protocol,
    });
  }

  const isLoopbackHost = ["localhost", "127.0.0.1", "::1", "[::1]"].includes(normalizedBaseUrl.hostname);
  if (protocol !== "https:" && !isLoopbackHost) {
    throw new ToolExecutionError("CANVAS_BASE_URL must use https unless you are targeting localhost for local testing.", {
      baseUrl,
      protocol,
      hostname: normalizedBaseUrl.hostname,
    });
  }

  const acceptStringIds = !["0", "false", "FALSE"].includes(process.env.CANVAS_ACCEPT_STRING_IDS ?? "1");
  const timeoutMs = Number.parseInt(process.env.CANVAS_TIMEOUT_MS ?? `${DEFAULT_TIMEOUT_MS}`, 10);

  return {
    baseUrl: normalizedBaseUrl,
    accessToken,
    timeoutMs: Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : DEFAULT_TIMEOUT_MS,
    userAgent: process.env.CANVAS_USER_AGENT?.trim() || `canvas-lms-codex-plugin/${SERVER_VERSION}`,
    acceptHeader: acceptStringIds ? "application/json+canvas-string-ids, application/json" : "application/json",
  };
}

export function resolveCanvasUrl(config, path) {
  if (typeof path !== "string" || path.trim() === "") {
    throw new ToolExecutionError("Canvas request path must be a non-empty string.");
  }

  const trimmedPath = path.trim();
  let resolvedUrl;

  try {
    if (trimmedPath.startsWith("http://") || trimmedPath.startsWith("https://")) {
      resolvedUrl = new URL(trimmedPath);
    } else {
      const normalizedPath = trimmedPath.startsWith("/") ? trimmedPath : `/${trimmedPath}`;
      resolvedUrl = new URL(normalizedPath, config.baseUrl);
    }
  } catch (_error) {
    throw new ToolExecutionError("Canvas request path could not be resolved.", { path });
  }

  if (resolvedUrl.origin !== config.baseUrl.origin) {
    throw new ToolExecutionError("Refusing to send the Canvas token to a different origin.", {
      requestedOrigin: resolvedUrl.origin,
      canvasOrigin: config.baseUrl.origin,
    });
  }

  const allowedApiPrefixes = ["/api/v1/", "/api/quiz/v1/"];
  const isAllowedApiPath =
    resolvedUrl.pathname === "/api/v1" ||
    resolvedUrl.pathname === "/api/quiz/v1" ||
    allowedApiPrefixes.some((prefix) => resolvedUrl.pathname.startsWith(prefix));

  if (!isAllowedApiPath) {
    throw new ToolExecutionError("Canvas requests must target same-origin Canvas REST API paths under /api/v1 or /api/quiz/v1.", {
      requestedPath: resolvedUrl.pathname,
    });
  }

  return resolvedUrl;
}

function getHeader(headers, name) {
  return headers.get(name) ?? headers.get(name.toLowerCase()) ?? null;
}

function parseNumberHeader(headers, name) {
  const rawValue = getHeader(headers, name);
  if (rawValue === null) {
    return null;
  }
  const parsed = Number.parseFloat(rawValue);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseLinkHeader(linkHeader) {
  if (!linkHeader) {
    return {};
  }

  const links = {};
  const regex = /<([^>]+)>\s*;\s*rel="([^"]+)"/g;
  let match;
  while ((match = regex.exec(linkHeader)) !== null) {
    links[match[2]] = match[1];
  }
  return links;
}

async function parseResponseBody(response) {
  const text = await response.text();
  if (text === "") {
    return null;
  }

  const contentType = getHeader(response.headers, "content-type") ?? "";
  const looksLikeJson = contentType.includes("application/json") || contentType.includes("+json") || /^[\[{]/.test(text.trim());

  if (!looksLikeJson) {
    return text;
  }

  try {
    return JSON.parse(text);
  } catch (_error) {
    return text;
  }
}

function buildResponseMeta(response, url, method) {
  const linkHeader = getHeader(response.headers, "link");
  return {
    request: {
      method,
      url: url.toString(),
      path: `${url.pathname}${url.search}`,
    },
    status: response.status,
    statusText: response.statusText,
    contentType: getHeader(response.headers, "content-type"),
    pageInfo: {
      ...parseLinkHeader(linkHeader),
    },
    rateLimit: {
      requestCost: parseNumberHeader(response.headers, "x-request-cost"),
      remaining: parseNumberHeader(response.headers, "x-rate-limit-remaining"),
      retryAfter: parseNumberHeader(response.headers, "retry-after"),
    },
  };
}

function isFlatParamMap(value) {
  return isPlainObject(value) && Object.values(value).every((entry) => {
    if (entry === null || isScalar(entry)) {
      return true;
    }
    return Array.isArray(entry) && entry.every((item) => item === null || isScalar(item));
  });
}

export async function performCanvasRequest({ method = "GET", path, query, body, bodyFormat = "auto" }) {
  const config = getCanvasConfig();
  const normalizedMethod = String(method).toUpperCase();

  if (!SUPPORTED_METHODS.has(normalizedMethod)) {
    throw new JsonRpcError(-32602, `Unsupported HTTP method: ${method}`);
  }

  const url = resolveCanvasUrl(config, path);
  appendParamsToSearchParams(url.searchParams, query);

  const headers = {
    Accept: config.acceptHeader,
    Authorization: `Bearer ${config.accessToken}`,
    "User-Agent": config.userAgent,
  };

  let requestBody;
  let bodyFormatUsed = null;

  if (body !== undefined) {
    if (normalizedMethod === "GET") {
      throw new JsonRpcError(-32602, "GET requests cannot include a body");
    }

    if (bodyFormat !== "auto" && bodyFormat !== "json" && bodyFormat !== "form") {
      throw new JsonRpcError(-32602, 'body_format must be "auto", "json", or "form"');
    }

    const shouldUseForm =
      bodyFormat === "form" ||
      (bodyFormat === "auto" && isFlatParamMap(body));

    if (shouldUseForm) {
      if (!isFlatParamMap(body)) {
        throw new JsonRpcError(-32602, "Form bodies must be flat objects with scalar values or scalar arrays");
      }
      const formData = new URLSearchParams();
      appendParamsToSearchParams(formData, body);
      headers["Content-Type"] = "application/x-www-form-urlencoded;charset=UTF-8";
      requestBody = formData.toString();
      bodyFormatUsed = "form";
    } else {
      try {
        requestBody = JSON.stringify(body);
      } catch (_error) {
        throw new JsonRpcError(-32602, "body must be JSON serializable");
      }
      headers["Content-Type"] = "application/json";
      bodyFormatUsed = "json";
    }
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.timeoutMs);

  let response;
  try {
    response = await fetch(url, {
      method: normalizedMethod,
      headers,
      ...(requestBody === undefined ? {} : { body: requestBody }),
      signal: controller.signal,
    });
  } catch (error) {
    if (error.name === "AbortError") {
      throw new ToolExecutionError(`Canvas request timed out after ${config.timeoutMs}ms`, {
        method: normalizedMethod,
        path: `${url.pathname}${url.search}`,
      });
    }
    throw new ToolExecutionError("Canvas request failed before receiving a response.", {
      method: normalizedMethod,
      path: `${url.pathname}${url.search}`,
      error: error.message,
    });
  } finally {
    clearTimeout(timeout);
  }

  const data = await parseResponseBody(response);
  const meta = buildResponseMeta(response, url, normalizedMethod);

  if (!response.ok) {
    throw new CanvasApiError(`Canvas API request failed with ${response.status} ${response.statusText}`, {
      ...meta,
      data,
    });
  }

  return {
    data,
    meta,
    bodyFormatUsed,
  };
}
