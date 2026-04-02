import process from "node:process";

export const SERVER_NAME = "canvas-lms";
export const SERVER_VERSION = "0.2.2";
export const PROTOCOL_VERSIONS = ["2025-11-25", "2025-06-18", "2025-03-26", "2024-11-05"];
export const DEFAULT_TIMEOUT_MS = 30_000;
export const DEFAULT_PER_PAGE = 25;
export const MAX_PER_PAGE = 100;
export const DEFAULT_MAX_PAGES = 10;
export const MAX_PAGES = 20;
export const SUPPORTED_METHODS = new Set(["GET", "POST", "PUT", "PATCH", "DELETE"]);

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

function safeStringify(value) {
  if (typeof value === "string") {
    return value;
  }
  try {
    return JSON.stringify(value, null, 2);
  } catch (_error) {
    return String(value);
  }
}

export function ensureObject(value, name) {
  if (!isPlainObject(value)) {
    throw new JsonRpcError(-32602, `${name} must be an object`);
  }
  return value;
}

export function isPlainObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isScalar(value) {
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

export function optionalEnumArray(value, name, allowedValues) {
  const values = optionalStringArray(value, name);
  if (!values) {
    return undefined;
  }
  for (const item of values) {
    if (!allowedValues.includes(item)) {
      throw new JsonRpcError(-32602, `${name} entries must be one of: ${allowedValues.join(", ")}`);
    }
  }
  return values;
}

export function mergeIncludes(defaultIncludes = [], requestedIncludes = []) {
  return [...new Set([...defaultIncludes, ...requestedIncludes])];
}

function getStudentEnrollmentFromCourse(course) {
  if (!Array.isArray(course?.enrollments)) {
    return null;
  }
  return (
    course.enrollments.find((enrollment) => String(enrollment?.type ?? "").includes("Student")) ??
    course.enrollments[0] ??
    null
  );
}

function buildGradeSummaryFromEnrollment(enrollment) {
  const grades = enrollment?.grades ?? {};
  return {
    currentGrade:
      enrollment?.computed_current_grade ??
      grades.current_grade ??
      enrollment?.current_grade ??
      null,
    currentScore:
      enrollment?.computed_current_score ??
      grades.current_score ??
      enrollment?.current_score ??
      null,
    finalGrade:
      enrollment?.computed_final_grade ??
      grades.final_grade ??
      enrollment?.final_grade ??
      null,
    finalScore:
      enrollment?.computed_final_score ??
      grades.final_score ??
      enrollment?.final_score ??
      null,
    currentPoints: grades.current_points ?? enrollment?.current_points ?? null,
    currentGradingPeriodTitle: enrollment?.current_grading_period_title ?? null,
    currentGradingPeriodId: enrollment?.current_grading_period_id ?? null,
    currentPeriodCurrentGrade:
      enrollment?.current_period_computed_current_grade ??
      enrollment?.current_period_current_grade ??
      enrollment?.current_period_unposted_current_grade ??
      null,
    currentPeriodCurrentScore:
      enrollment?.current_period_computed_current_score ??
      enrollment?.current_period_current_score ??
      enrollment?.current_period_unposted_current_score ??
      null,
    currentPeriodFinalGrade:
      enrollment?.current_period_computed_final_grade ??
      enrollment?.current_period_final_grade ??
      enrollment?.current_period_unposted_final_grade ??
      null,
    currentPeriodFinalScore:
      enrollment?.current_period_computed_final_score ??
      enrollment?.current_period_final_score ??
      enrollment?.current_period_unposted_final_score ??
      null,
    gradesHtmlUrl: grades.html_url ?? null,
  };
}

export function summarizeGradeEnrollment(enrollment) {
  return {
    enrollmentId: enrollment?.id ?? null,
    courseId: enrollment?.course_id ?? null,
    courseSectionId: enrollment?.course_section_id ?? null,
    userId: enrollment?.user_id ?? null,
    type: enrollment?.type ?? null,
    role: enrollment?.role ?? null,
    enrollmentState: enrollment?.enrollment_state ?? null,
    htmlUrl: enrollment?.html_url ?? null,
    lastActivityAt: enrollment?.last_activity_at ?? null,
    updatedAt: enrollment?.updated_at ?? null,
    gradeSummary: buildGradeSummaryFromEnrollment(enrollment),
  };
}

export function summarizeStudentCourse(course) {
  const enrollment = getStudentEnrollmentFromCourse(course);
  return {
    courseId: course?.id ?? null,
    name: course?.name ?? null,
    courseCode: course?.course_code ?? null,
    workflowState: course?.workflow_state ?? null,
    isFavorite: course?.is_favorite ?? course?.favorites ?? null,
    isConcluded: course?.concluded ?? null,
    gradeSummary: buildGradeSummaryFromEnrollment(enrollment),
  };
}

export function summarizePlannerItems(items) {
  const summary = {
    totalItems: items.length,
    assignmentItems: 0,
    discussionItems: 0,
    noteItems: 0,
    gradedCount: 0,
    missingCount: 0,
    lateCount: 0,
    withFeedbackCount: 0,
    completedCount: 0,
  };

  for (const item of items) {
    const type = String(item?.plannable_type ?? "").toLowerCase();
    if (type === "assignment") {
      summary.assignmentItems += 1;
    } else if (type === "discussion_topic") {
      summary.discussionItems += 1;
    } else if (type === "planner_note") {
      summary.noteItems += 1;
    }

    if (item?.planner_override?.marked_complete) {
      summary.completedCount += 1;
    }

    if (isPlainObject(item?.submissions)) {
      if (item.submissions.graded) {
        summary.gradedCount += 1;
      }
      if (item.submissions.missing) {
        summary.missingCount += 1;
      }
      if (item.submissions.late) {
        summary.lateCount += 1;
      }
      if (item.submissions.with_feedback) {
        summary.withFeedbackCount += 1;
      }
    }
  }

  return summary;
}

export function summarizeAssignments(assignments) {
  const summary = {
    totalAssignments: assignments.length,
    submittedCount: 0,
    gradedCount: 0,
    missingCount: 0,
    lateCount: 0,
    upcomingCount: 0,
  };

  const now = Date.now();

  for (const assignment of assignments) {
    const submission = isPlainObject(assignment?.submission) ? assignment.submission : null;
    if (submission?.submitted_at) {
      summary.submittedCount += 1;
    }
    if (submission?.grade !== null && submission?.grade !== undefined) {
      summary.gradedCount += 1;
    }
    if (submission?.missing) {
      summary.missingCount += 1;
    }
    if (submission?.late) {
      summary.lateCount += 1;
    }
    if (assignment?.due_at && Date.parse(assignment.due_at) > now) {
      summary.upcomingCount += 1;
    }
  }

  return summary;
}

export function summarizeSubmissions(submissions) {
  const summary = {
    totalSubmissions: submissions.length,
    submittedCount: 0,
    gradedCount: 0,
    missingCount: 0,
    lateCount: 0,
    unsubmittedCount: 0,
    withFeedbackCount: 0,
  };

  for (const submission of submissions) {
    if (submission?.submitted_at) {
      summary.submittedCount += 1;
    }
    if (submission?.grade !== null && submission?.grade !== undefined) {
      summary.gradedCount += 1;
    }
    if (submission?.missing) {
      summary.missingCount += 1;
    }
    if (submission?.late) {
      summary.lateCount += 1;
    }
    if (submission?.workflow_state === "unsubmitted") {
      summary.unsubmittedCount += 1;
    }
    if (Array.isArray(submission?.submission_comments) && submission.submission_comments.length > 0) {
      summary.withFeedbackCount += 1;
    }
  }

  return summary;
}

export function appendStudentSubmissionsQuery(query, options) {
  addIncludeQuery(query, options.include);
  appendMultiValue(query, "student_ids[]", options.studentId === undefined ? undefined : [options.studentId]);
  appendMultiValue(query, "assignment_ids[]", options.assignmentIds);
  appendMultiValue(query, "submitted_since", options.submittedSince);
  appendMultiValue(query, "graded_since", options.gradedSince);
  appendMultiValue(query, "grading_period_id", options.gradingPeriodId);
  appendMultiValue(query, "workflow_state", options.workflowState);
  appendMultiValue(query, "enrollment_state", options.enrollmentState);
  appendMultiValue(query, "order", options.order);
  appendMultiValue(query, "order_direction", options.orderDirection);
  appendMultiValue(query, "per_page", options.perPage);
}

export function summarizeModules(modules) {
  const summary = {
    totalModules: modules.length,
    completedModules: 0,
    moduleItems: 0,
    completedRequirements: 0,
  };

  for (const module of modules) {
    if (module?.state === "completed") {
      summary.completedModules += 1;
    }
    if (Array.isArray(module?.items)) {
      summary.moduleItems += module.items.length;
      for (const item of module.items) {
        if (item?.completion_requirement?.completed) {
          summary.completedRequirements += 1;
        }
      }
    }
  }

  return summary;
}

export function resolveDateWindow({ startDate, endDate, daysAhead = 14 }) {
  const resolvedStartDate = startDate ?? new Date().toISOString().slice(0, 10);
  const resolvedEndDate =
    endDate ??
    new Date(Date.now() + daysAhead * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  return {
    startDate: resolvedStartDate,
    endDate: resolvedEndDate,
  };
}

export function summarizePage(page) {
  const body = typeof page?.body === "string" ? page.body : null;
  return {
    pageId: page?.page_id ?? null,
    url: page?.url ?? null,
    title: page?.title ?? null,
    published: page?.published ?? null,
    frontPage: page?.front_page ?? null,
    lockedForUser: page?.locked_for_user ?? null,
    updatedAt: page?.updated_at ?? null,
    editor: page?.editor ?? null,
    bodyPresent: body !== null && body !== "",
    bodyLength: body?.length ?? 0,
  };
}

export function summarizePages(pages) {
  const summary = {
    totalPages: pages.length,
    publishedCount: 0,
    frontPageCount: 0,
    lockedCount: 0,
    withBodyCount: 0,
  };

  for (const page of pages) {
    if (page?.published) {
      summary.publishedCount += 1;
    }
    if (page?.front_page) {
      summary.frontPageCount += 1;
    }
    if (page?.locked_for_user) {
      summary.lockedCount += 1;
    }
    if (typeof page?.body === "string" && page.body !== "") {
      summary.withBodyCount += 1;
    }
  }

  return summary;
}

export function summarizeCalendarItem(item) {
  const itemType =
    item?.assignment !== null && item?.assignment !== undefined
      ? "assignment"
      : String(item?.id ?? "").startsWith("assignment_")
        ? "assignment"
        : "event";
  return {
    id: item?.id ?? null,
    title: item?.title ?? null,
    itemType,
    contextCode: item?.context_code ?? null,
    contextName: item?.context_name ?? null,
    startAt: item?.start_at ?? null,
    endAt: item?.end_at ?? null,
    allDay: item?.all_day ?? null,
    workflowState: item?.workflow_state ?? null,
    importantDates: item?.important_dates ?? null,
    htmlUrl: item?.html_url ?? null,
  };
}

export function summarizeCalendarItems(items) {
  const summary = {
    totalItems: items.length,
    assignmentItems: 0,
    eventItems: 0,
    importantDateCount: 0,
    allDayCount: 0,
  };

  for (const item of items) {
    const itemType =
      item?.assignment !== null && item?.assignment !== undefined
        ? "assignment"
        : String(item?.id ?? "").startsWith("assignment_")
          ? "assignment"
          : "event";
    if (itemType === "assignment") {
      summary.assignmentItems += 1;
    } else {
      summary.eventItems += 1;
    }
    if (item?.important_dates) {
      summary.importantDateCount += 1;
    }
    if (item?.all_day) {
      summary.allDayCount += 1;
    }
  }

  return summary;
}

export function summarizeQuiz(quiz) {
  return {
    quizId: quiz?.id ?? null,
    title: quiz?.title ?? null,
    quizType: quiz?.quiz_type ?? null,
    published: quiz?.published ?? null,
    dueAt: quiz?.due_at ?? null,
    unlockAt: quiz?.unlock_at ?? null,
    lockAt: quiz?.lock_at ?? null,
    lockedForUser: quiz?.locked_for_user ?? null,
    questionCount: quiz?.question_count ?? null,
    pointsPossible: quiz?.points_possible ?? null,
    htmlUrl: quiz?.html_url ?? null,
  };
}

export function summarizeQuizzes(quizzes) {
  const summary = {
    totalQuizzes: quizzes.length,
    publishedCount: 0,
    lockedCount: 0,
    dueCount: 0,
    gradedCount: 0,
    practiceCount: 0,
    surveyCount: 0,
  };

  for (const quiz of quizzes) {
    if (quiz?.published) {
      summary.publishedCount += 1;
    }
    if (quiz?.locked_for_user) {
      summary.lockedCount += 1;
    }
    if (quiz?.due_at) {
      summary.dueCount += 1;
    }
    if (quiz?.quiz_type === "assignment" || quiz?.quiz_type === "graded_survey") {
      summary.gradedCount += 1;
    }
    if (quiz?.quiz_type === "practice_quiz") {
      summary.practiceCount += 1;
    }
    if (quiz?.quiz_type === "survey" || quiz?.quiz_type === "graded_survey") {
      summary.surveyCount += 1;
    }
  }

  return summary;
}

export function summarizeNewQuiz(quiz) {
  return {
    quizId: quiz?.id ?? null,
    title: quiz?.title ?? null,
    published: quiz?.published ?? null,
    dueAt: quiz?.due_at ?? null,
    unlockAt: quiz?.unlock_at ?? null,
    lockAt: quiz?.lock_at ?? null,
    pointsPossible: quiz?.points_possible ?? null,
    gradingType: quiz?.grading_type ?? null,
  };
}

export function summarizeAnnouncement(topic) {
  return {
    announcementId: topic?.id ?? null,
    title: topic?.title ?? null,
    contextCode: topic?.context_code ?? null,
    postedAt: topic?.posted_at ?? null,
    delayedPostAt: topic?.delayed_post_at ?? null,
    published: topic?.published ?? null,
    locked: topic?.locked ?? null,
    readState: topic?.read_state ?? null,
    unreadCount: topic?.unread_count ?? null,
    htmlUrl: topic?.html_url ?? null,
  };
}

export function summarizeAnnouncements(topics) {
  const summary = {
    totalAnnouncements: topics.length,
    unreadCount: 0,
    delayedCount: 0,
    publishedCount: 0,
    lockedCount: 0,
  };

  for (const topic of topics) {
    if (topic?.read_state === "unread" || (Number.isInteger(topic?.unread_count) && topic.unread_count > 0)) {
      summary.unreadCount += 1;
    }
    if (topic?.delayed_post_at) {
      summary.delayedCount += 1;
    }
    if (topic?.published) {
      summary.publishedCount += 1;
    }
    if (topic?.locked) {
      summary.lockedCount += 1;
    }
  }

  return summary;
}

export const COMMON_GET_PROPERTIES = {
  include: {
    type: "array",
    items: { type: "string" },
    description: "Canvas include values. These become repeated include[] query parameters.",
  },
  extra_query: {
    type: "object",
    description: "Additional Canvas query parameters using exact API keys such as include[] or search_term.",
    additionalProperties: true,
  },
};

export const COMMON_LIST_PROPERTIES = {
  include: COMMON_GET_PROPERTIES.include,
  per_page: {
    type: "integer",
    minimum: 1,
    maximum: 100,
    description: "Canvas per_page value. Defaults to 25.",
  },
  follow_pagination: {
    type: "boolean",
    description: "Fetch additional pages from Link headers until max_pages is reached.",
  },
  max_pages: {
    type: "integer",
    minimum: 1,
    maximum: 20,
    description: "Maximum number of pages to fetch when follow_pagination is true.",
  },
  extra_query: COMMON_GET_PROPERTIES.extra_query,
};
