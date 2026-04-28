import {
  COMMON_GET_PROPERTIES,
  COMMON_LIST_PROPERTIES,
  DEFAULT_MAX_PAGES,
  DEFAULT_PER_PAGE,
  MAX_PAGES,
  MAX_PER_PAGE,
  addIncludeQuery,
  appendMultiValue,
  buildEnvelope,
  ensureAllowedKeys,
  ensureObject,
  mergeFlatParams,
  normalizeString,
  optionalBoolean,
  optionalEnumArray,
  optionalFlatParamObject,
  optionalInteger,
  performCanvasListRequest,
  performCanvasRequest,
  summarizeQuizSubmissions,
  summarizeSimpleNamedItems,
} from "../canvas-mcp-core.mjs";
import { CONTEXT_ID_PROPERTIES, readContext } from "./path-builders.mjs";

const QUIZ_SUBMISSION_INCLUDES = ["submission", "quiz", "user"];

function appendPaging(query, args) {
  appendMultiValue(query, "per_page", optionalInteger(args.per_page, "per_page", 1, MAX_PER_PAGE) ?? DEFAULT_PER_PAGE);
  return {
    followPagination: optionalBoolean(args.follow_pagination, "follow_pagination") ?? false,
    maxPages: optionalInteger(args.max_pages, "max_pages", 1, MAX_PAGES) ?? DEFAULT_MAX_PAGES,
  };
}

function assignmentPeerReviewPath(args, toolName, includeSubmission) {
  const basePath = readContext(args, toolName, ["course_id", "section_id"]).basePath;
  const assignmentPath = `${basePath}/assignments/${encodeURIComponent(normalizeString(args.assignment_id, "assignment_id"))}`;
  if (!includeSubmission) {
    return `${assignmentPath}/peer_reviews`;
  }
  return `${assignmentPath}/submissions/${encodeURIComponent(normalizeString(args.submission_id, "submission_id"))}/peer_reviews`;
}

async function listPeerReviews(rawArgs, toolName, includeSubmission) {
  const args = ensureObject(rawArgs ?? {}, `${toolName} arguments`);
  const allowedKeys = ["course_id", "section_id", "assignment_id", "per_page", "follow_pagination", "max_pages", "extra_query"];
  if (includeSubmission) {
    allowedKeys.push("submission_id");
  }
  ensureAllowedKeys(args, allowedKeys, toolName);
  const query = optionalFlatParamObject(args.extra_query, "extra_query") ?? {};
  const paging = appendPaging(query, args);
  const envelope = await performCanvasListRequest({
    path: assignmentPeerReviewPath(args, toolName, includeSubmission),
    query,
    ...paging,
  });
  return { ...envelope, summary: summarizeSimpleNamedItems(envelope.data, ["asset_id", "user_id", "id"]) };
}

function quizBase(args) {
  return `/api/v1/courses/${encodeURIComponent(normalizeString(args.course_id, "course_id"))}/quizzes/${encodeURIComponent(normalizeString(args.quiz_id, "quiz_id"))}`;
}

function quizSubmissionQuery(args) {
  const query = {};
  mergeFlatParams(query, optionalFlatParamObject(args.extra_query, "extra_query"));
  addIncludeQuery(query, optionalEnumArray(args.include, "include", QUIZ_SUBMISSION_INCLUDES));
  return query;
}

export const QUIZ_PEER_REVIEW_TOOLS = [
  {
    name: "canvas_list_peer_reviews",
    title: "List Peer Reviews",
    description: "List peer reviews for an assignment in a Canvas course or section.",
    inputSchema: peerReviewSchema(false),
    async handler(rawArgs) {
      return listPeerReviews(rawArgs, "canvas_list_peer_reviews", false);
    },
  },
  {
    name: "canvas_list_submission_peer_reviews",
    title: "List Submission Peer Reviews",
    description: "List peer reviews for a specific assignment submission in a Canvas course or section.",
    inputSchema: peerReviewSchema(true),
    async handler(rawArgs) {
      return listPeerReviews(rawArgs, "canvas_list_submission_peer_reviews", true);
    },
  },
  {
    name: "canvas_list_quiz_submissions",
    title: "List Quiz Submissions",
    description: "List quiz submissions visible to the caller for a Canvas course quiz.",
    inputSchema: quizSubmissionSchema(false),
    async handler(rawArgs) {
      const args = ensureObject(rawArgs ?? {}, "canvas_list_quiz_submissions arguments");
      ensureAllowedKeys(args, ["course_id", "quiz_id", "include", "extra_query"], "canvas_list_quiz_submissions");
      const result = await performCanvasRequest({
        method: "GET",
        path: `${quizBase(args)}/submissions`,
        query: quizSubmissionQuery(args),
      });
      return { ...buildEnvelope(result), summary: summarizeQuizSubmissions(result.data) };
    },
  },
  {
    name: "canvas_get_current_quiz_submission",
    title: "Get Current Quiz Submission",
    description: "Read the current user's quiz submission for a Canvas course quiz.",
    inputSchema: quizSubmissionSchema(false),
    async handler(rawArgs) {
      const args = ensureObject(rawArgs ?? {}, "canvas_get_current_quiz_submission arguments");
      ensureAllowedKeys(args, ["course_id", "quiz_id", "include", "extra_query"], "canvas_get_current_quiz_submission");
      const result = await performCanvasRequest({
        method: "GET",
        path: `${quizBase(args)}/submission`,
        query: quizSubmissionQuery(args),
      });
      return { ...buildEnvelope(result), summary: summarizeQuizSubmissions(result.data) };
    },
  },
  {
    name: "canvas_get_quiz_submission",
    title: "Get Quiz Submission",
    description: "Read a single quiz submission for a Canvas course quiz.",
    inputSchema: quizSubmissionSchema(true),
    async handler(rawArgs) {
      const args = ensureObject(rawArgs ?? {}, "canvas_get_quiz_submission arguments");
      ensureAllowedKeys(args, ["course_id", "quiz_id", "quiz_submission_id", "include", "extra_query"], "canvas_get_quiz_submission");
      const result = await performCanvasRequest({
        method: "GET",
        path: `${quizBase(args)}/submissions/${encodeURIComponent(normalizeString(args.quiz_submission_id, "quiz_submission_id"))}`,
        query: quizSubmissionQuery(args),
      });
      return { ...buildEnvelope(result), summary: summarizeQuizSubmissions(result.data) };
    },
  },
  {
    name: "canvas_get_quiz_submission_time",
    title: "Get Quiz Submission Time",
    description: "Read current timing data for a quiz submission attempt.",
    inputSchema: {
      type: "object",
      required: ["course_id", "quiz_id", "quiz_submission_id"],
      properties: {
        course_id: CONTEXT_ID_PROPERTIES.course_id,
        quiz_id: { type: "string", description: "Canvas quiz ID." },
        quiz_submission_id: { type: "string", description: "Canvas quiz submission ID." },
        extra_query: COMMON_GET_PROPERTIES.extra_query,
      },
      additionalProperties: false,
    },
    async handler(rawArgs) {
      const args = ensureObject(rawArgs ?? {}, "canvas_get_quiz_submission_time arguments");
      ensureAllowedKeys(args, ["course_id", "quiz_id", "quiz_submission_id", "extra_query"], "canvas_get_quiz_submission_time");
      return buildEnvelope(await performCanvasRequest({
        method: "GET",
        path: `${quizBase(args)}/submissions/${encodeURIComponent(normalizeString(args.quiz_submission_id, "quiz_submission_id"))}/time`,
        query: optionalFlatParamObject(args.extra_query, "extra_query"),
      }));
    },
  },
];

function peerReviewSchema(includeSubmission) {
  return {
    type: "object",
    required: includeSubmission ? ["assignment_id", "submission_id"] : ["assignment_id"],
    properties: {
      course_id: CONTEXT_ID_PROPERTIES.course_id,
      section_id: CONTEXT_ID_PROPERTIES.section_id,
      assignment_id: { type: "string", description: "Canvas assignment ID." },
      ...(includeSubmission ? { submission_id: { type: "string", description: "Canvas submission ID." } } : {}),
      per_page: COMMON_LIST_PROPERTIES.per_page,
      follow_pagination: COMMON_LIST_PROPERTIES.follow_pagination,
      max_pages: COMMON_LIST_PROPERTIES.max_pages,
      extra_query: COMMON_GET_PROPERTIES.extra_query,
    },
    additionalProperties: false,
  };
}

function quizSubmissionSchema(includeSubmissionId) {
  return {
    type: "object",
    required: includeSubmissionId ? ["course_id", "quiz_id", "quiz_submission_id"] : ["course_id", "quiz_id"],
    properties: {
      course_id: CONTEXT_ID_PROPERTIES.course_id,
      quiz_id: { type: "string", description: "Canvas quiz ID." },
      ...(includeSubmissionId ? { quiz_submission_id: { type: "string", description: "Canvas quiz submission ID." } } : {}),
      include: { type: "array", items: { type: "string", enum: QUIZ_SUBMISSION_INCLUDES } },
      extra_query: COMMON_GET_PROPERTIES.extra_query,
    },
    additionalProperties: false,
  };
}
