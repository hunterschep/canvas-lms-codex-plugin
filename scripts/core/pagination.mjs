import { ToolExecutionError } from "./errors.mjs";
import { performCanvasRequest } from "./http.mjs";
import { buildEnvelope } from "./responses.mjs";

export async function performCanvasListRequest({ path, query, followPagination, maxPages }) {
  const pages = [];
  let nextPath = path;
  let nextQuery = query;
  let pagesFetched = 0;
  let truncated = false;
  let firstMeta = null;
  let lastMeta = null;

  while (nextPath) {
    if (pagesFetched >= maxPages) {
      truncated = true;
      break;
    }

    const result = await performCanvasRequest({
      method: "GET",
      path: nextPath,
      query: nextQuery,
    });

    if (!Array.isArray(result.data)) {
      throw new ToolExecutionError("Expected a list endpoint to return an array.", {
        path: result.meta.request.path,
        receivedType: Array.isArray(result.data) ? "array" : typeof result.data,
      });
    }

    pages.push(...result.data);
    firstMeta ??= result.meta;
    lastMeta = result.meta;
    pagesFetched += 1;

    const nextUrl = result.meta.pageInfo.next || null;
    if (!followPagination || !nextUrl) {
      break;
    }

    nextPath = nextUrl;
    nextQuery = undefined;
  }

  const meta = lastMeta ?? firstMeta;
  if (!meta) {
    throw new ToolExecutionError("The Canvas list request did not produce any response metadata.");
  }

  return buildEnvelope({
    data: pages,
    meta,
    extra: {
      pageInfo: {
        ...meta.pageInfo,
        pagesFetched,
        itemCount: pages.length,
        truncated,
      },
    },
  });
}
