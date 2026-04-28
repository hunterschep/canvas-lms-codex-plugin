import { JsonRpcError } from "./errors.mjs";
import { addIncludeQuery, appendMultiValue, isPlainObject, optionalStringArray } from "./validation.mjs";

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
