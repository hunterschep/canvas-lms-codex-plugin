export function summarizeUser(user) {
  return {
    userId: user?.id ?? null,
    name: user?.name ?? user?.display_name ?? null,
    sortableName: user?.sortable_name ?? null,
    shortName: user?.short_name ?? null,
    loginId: user?.login_id ?? null,
    avatarUrl: user?.avatar_url ?? user?.avatar_image_url ?? null,
    enrollmentsCount: Array.isArray(user?.enrollments) ? user.enrollments.length : null,
  };
}

export function summarizeUsers(users) {
  return {
    totalUsers: users.length,
    users: users.map(summarizeUser),
  };
}

export function summarizeGroup(group) {
  return {
    groupId: group?.id ?? null,
    name: group?.name ?? null,
    contextType: group?.context_type ?? null,
    courseId: group?.course_id ?? null,
    groupCategoryId: group?.group_category_id ?? null,
    membersCount: group?.members_count ?? null,
    role: group?.role ?? null,
    followedByUser: group?.followed_by_user ?? null,
  };
}

export function summarizeGroups(groups) {
  return {
    totalGroups: groups.length,
    groups: groups.map(summarizeGroup),
  };
}

export function summarizeSection(section) {
  return {
    sectionId: section?.id ?? null,
    name: section?.name ?? null,
    courseId: section?.course_id ?? null,
    totalStudents: section?.total_students ?? null,
    startAt: section?.start_at ?? null,
    endAt: section?.end_at ?? null,
  };
}

export function summarizeSections(sections) {
  return {
    totalSections: sections.length,
    sections: sections.map(summarizeSection),
  };
}

export function summarizeFile(file) {
  return {
    fileId: file?.id ?? null,
    folderId: file?.folder_id ?? null,
    displayName: file?.display_name ?? file?.filename ?? null,
    filename: file?.filename ?? null,
    contentType: file?.["content-type"] ?? file?.content_type ?? null,
    size: file?.size ?? null,
    locked: file?.locked ?? null,
    hidden: file?.hidden ?? null,
    lockedForUser: file?.locked_for_user ?? null,
    urlPresent: typeof file?.url === "string" && file.url !== "",
  };
}

export function summarizeFiles(files) {
  return {
    totalFiles: files.length,
    files: files.map(summarizeFile),
  };
}

export function summarizeFolder(folder) {
  return {
    folderId: folder?.id ?? null,
    name: folder?.name ?? null,
    fullName: folder?.full_name ?? null,
    contextType: folder?.context_type ?? null,
    contextId: folder?.context_id ?? null,
    parentFolderId: folder?.parent_folder_id ?? null,
    filesCount: folder?.files_count ?? null,
    foldersCount: folder?.folders_count ?? null,
    locked: folder?.locked ?? null,
    hidden: folder?.hidden ?? null,
  };
}

export function summarizeFolders(folders) {
  return {
    totalFolders: folders.length,
    folders: folders.map(summarizeFolder),
  };
}

export function summarizeDiscussionTopic(topic) {
  return {
    topicId: topic?.id ?? null,
    title: topic?.title ?? null,
    discussionType: topic?.discussion_type ?? null,
    assignmentId: topic?.assignment_id ?? null,
    postedAt: topic?.posted_at ?? null,
    lastReplyAt: topic?.last_reply_at ?? null,
    unreadCount: topic?.unread_count ?? null,
    entriesCount: topic?.discussion_subentry_count ?? null,
    locked: topic?.locked ?? null,
    lockedForUser: topic?.locked_for_user ?? null,
    subscribed: topic?.subscribed ?? null,
    htmlUrl: topic?.html_url ?? null,
  };
}

export function summarizeDiscussionTopics(topics) {
  return {
    totalTopics: topics.length,
    unreadTopics: topics.filter((topic) => topic?.read_state === "unread" || Number(topic?.unread_count ?? 0) > 0).length,
    lockedTopics: topics.filter((topic) => topic?.locked || topic?.locked_for_user).length,
    topics: topics.map(summarizeDiscussionTopic),
  };
}

export function summarizeAssignmentGroups(groups) {
  return {
    totalAssignmentGroups: groups.length,
    groups: groups.map((group) => ({
      assignmentGroupId: group?.id ?? null,
      name: group?.name ?? null,
      groupWeight: group?.group_weight ?? null,
      position: group?.position ?? null,
      assignmentsCount: Array.isArray(group?.assignments) ? group.assignments.length : null,
    })),
  };
}

export function summarizeRubrics(rubrics) {
  return {
    totalRubrics: rubrics.length,
    rubrics: rubrics.map((rubric) => ({
      rubricId: rubric?.id ?? null,
      title: rubric?.title ?? rubric?.description ?? null,
      pointsPossible: rubric?.points_possible ?? null,
      reusable: rubric?.reusable ?? null,
      criteriaCount: Array.isArray(rubric?.data) ? rubric.data.length : null,
    })),
  };
}

export function summarizeOutcomeResults(results) {
  const rollups = Array.isArray(results?.rollups) ? results.rollups : [];
  return {
    rollupCount: rollups.length,
    linkedOutcomeCount: Array.isArray(results?.linked?.outcomes) ? results.linked.outcomes.length : null,
    linkedArtifactCount: Array.isArray(results?.linked?.artifacts) ? results.linked.artifacts.length : null,
  };
}

export function summarizeConversations(data) {
  const conversations = Array.isArray(data) ? data : (Array.isArray(data?.conversations) ? data.conversations : []);
  return {
    totalConversations: conversations.length,
    unreadConversations: conversations.filter((conversation) => conversation?.workflow_state === "unread").length,
    starredConversations: conversations.filter((conversation) => conversation?.starred).length,
    conversations: conversations.map((conversation) => ({
      conversationId: conversation?.id ?? null,
      subject: conversation?.subject ?? null,
      workflowState: conversation?.workflow_state ?? null,
      lastMessageAt: conversation?.last_message_at ?? null,
      messageCount: conversation?.message_count ?? null,
      starred: conversation?.starred ?? null,
      audienceCount: Array.isArray(conversation?.audience) ? conversation.audience.length : null,
    })),
  };
}

export function summarizeRecipients(recipients) {
  return {
    totalRecipients: recipients.length,
    users: recipients.filter((recipient) => recipient?.type === "user").length,
    contexts: recipients.filter((recipient) => recipient?.type !== "user").length,
    recipients: recipients.map((recipient) => ({
      id: recipient?.id ?? null,
      name: recipient?.name ?? recipient?.full_name ?? null,
      type: recipient?.type ?? null,
      userCount: recipient?.user_count ?? null,
    })),
  };
}

export function summarizeSimpleNamedItems(items, idKeys = ["id"]) {
  return {
    totalItems: items.length,
    items: items.map((item) => ({
      id: idKeys.map((key) => item?.[key]).find((value) => value !== undefined) ?? null,
      name: item?.name ?? item?.title ?? item?.subject ?? null,
      workflowState: item?.workflow_state ?? item?.state ?? null,
    })),
  };
}

export function summarizeAppointmentGroups(groups) {
  return {
    totalAppointmentGroups: groups.length,
    groups: groups.map((group) => ({
      appointmentGroupId: group?.id ?? null,
      title: group?.title ?? null,
      workflowState: group?.workflow_state ?? null,
      participantType: group?.participant_type ?? null,
      appointmentCount: Array.isArray(group?.appointments) ? group.appointments.length : null,
      childEventsCount: Array.isArray(group?.child_events) ? group.child_events.length : null,
    })),
  };
}

export function summarizeExternalTools(tools) {
  return {
    totalTools: tools.length,
    tools: tools.map((tool) => ({
      externalToolId: tool?.id ?? null,
      name: tool?.name ?? null,
      domain: tool?.domain ?? null,
      url: tool?.url ?? null,
      consumerKey: tool?.consumer_key ?? null,
      privacyLevel: tool?.privacy_level ?? null,
    })),
  };
}

export function summarizeQuizSubmissions(data) {
  const submissions = Array.isArray(data) ? data : (Array.isArray(data?.quiz_submissions) ? data.quiz_submissions : []);
  return {
    totalQuizSubmissions: submissions.length,
    submissions: submissions.map((submission) => ({
      quizSubmissionId: submission?.id ?? null,
      quizId: submission?.quiz_id ?? null,
      userId: submission?.user_id ?? null,
      attempt: submission?.attempt ?? null,
      workflowState: submission?.workflow_state ?? null,
      score: submission?.score ?? null,
      finishedAt: submission?.finished_at ?? null,
    })),
  };
}
