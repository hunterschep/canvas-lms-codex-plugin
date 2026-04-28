import { safeStringify } from "./errors.mjs";

export function buildEnvelope({ data, meta, bodyFormatUsed = null, extra = {} }) {
  return {
    request: meta.request,
    status: meta.status,
    statusText: meta.statusText,
    contentType: meta.contentType,
    rateLimit: meta.rateLimit,
    pageInfo: meta.pageInfo,
    ...(bodyFormatUsed ? { bodyFormatUsed } : {}),
    ...extra,
    data,
  };
}

export function buildToolResult(payload, isError = false) {
  return {
    content: [
      {
        type: "text",
        text: safeStringify(payload),
      },
    ],
    structuredContent: payload,
    ...(isError ? { isError: true } : {}),
  };
}

export function buildToolErrorPayload(error) {
  const message = error?.message ?? "Unexpected tool execution error";
  return {
    error: {
      message,
      ...(error?.details === undefined ? {} : { details: error.details }),
    },
  };
}
