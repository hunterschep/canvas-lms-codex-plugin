import { ANALYTICS_OPERATION_TOOLS } from "./tools/analytics-operations.mjs";
import { ASSESSMENT_RESOURCE_TOOLS } from "./tools/assessment-resources.mjs";
import { COLLABORATION_SCHEDULING_TOOLS } from "./tools/collaboration-scheduling.mjs";
import { COMMUNICATION_SEARCH_TOOLS } from "./tools/communication-search.mjs";
import { CONTENT_ASSIGNMENT_TOOLS } from "./tools/content-assignments.mjs";
import { DISCUSSION_TOOLS } from "./tools/discussions.mjs";
import { FILE_FOLDER_TOOLS } from "./tools/files-folders.mjs";
import { GROUP_SECTION_TOOLS } from "./tools/groups-sections.mjs";
import { IDENTITY_COURSE_TOOLS } from "./tools/identity-courses.mjs";
import { MEDIA_EXTERNAL_TOOLS } from "./tools/media-external-tools.mjs";
import { MODULE_ANNOUNCEMENT_RAW_TOOLS } from "./tools/modules-announcements-raw.mjs";
import { PLANNING_CALENDAR_TOOLS } from "./tools/planning-calendar.mjs";
import { QUIZ_PEER_REVIEW_TOOLS } from "./tools/quiz-peer-reviews.mjs";
import { QUIZ_TOOLS } from "./tools/quizzes.mjs";
import { SUBMISSION_TOOLS } from "./tools/submissions.mjs";
import { USER_ROSTER_TOOLS } from "./tools/users-roster.mjs";

export const TOOL_DEFINITIONS = [
  ...IDENTITY_COURSE_TOOLS,
  ...USER_ROSTER_TOOLS,
  ...PLANNING_CALENDAR_TOOLS,
  ...CONTENT_ASSIGNMENT_TOOLS,
  ...ASSESSMENT_RESOURCE_TOOLS,
  ...QUIZ_TOOLS,
  ...QUIZ_PEER_REVIEW_TOOLS,
  ...SUBMISSION_TOOLS,
  ...GROUP_SECTION_TOOLS,
  ...FILE_FOLDER_TOOLS,
  ...DISCUSSION_TOOLS,
  ...COMMUNICATION_SEARCH_TOOLS,
  ...COLLABORATION_SCHEDULING_TOOLS,
  ...MEDIA_EXTERNAL_TOOLS,
  ...ANALYTICS_OPERATION_TOOLS,
  ...MODULE_ANNOUNCEMENT_RAW_TOOLS,
];

export const TOOL_LOOKUP = new Map(TOOL_DEFINITIONS.map((tool) => [tool.name, tool]));

export function serializeTool(tool) {
  return {
    name: tool.name,
    title: tool.title,
    description: tool.description,
    inputSchema: tool.inputSchema,
  };
}
