export interface CanvasTerm {
  id: number;
  name: string;
}

export interface CanvasCourse {
  id: number;
  name: string;
  course_code: string;
  workflow_state: string;
  term?: CanvasTerm;
}

export interface CanvasSubmission {
  id: number;
  workflow_state: string;
  submitted_at: string | null;
  score: number | null;
  missing: boolean;
  late: boolean;
}

export interface CanvasAssignment {
  id: number;
  course_id: number;
  name: string;
  description: string | null;
  due_at: string | null;
  points_possible: number | null;
  html_url: string;
  submission_types: string[];
  submission?: CanvasSubmission;
  rubric?: unknown[];
  rubric_settings?: unknown;
}

export interface CanvasMissingSubmission extends CanvasAssignment {
  course?: CanvasCourse;
}

export interface CanvasModuleItem {
  id: number;
  module_id: number;
  title: string;
  type: string;
  html_url: string;
  content_id?: number;
  url?: string;
  position: number;
}

export interface CanvasModule {
  id: number;
  name: string;
  position: number;
  items?: CanvasModuleItem[];
}

export interface CanvasPage {
  page_id: number;
  url: string;
  title: string;
  body?: string;
  html_url: string;
  updated_at: string;
}

export interface CanvasFile {
  id: number;
  display_name: string;
  filename: string;
  "content-type": string;
  url: string;
  size: number;
  updated_at: string;
}

export interface CanvasAnnouncement {
  id: number;
  title: string;
  message: string;
  html_url: string;
  posted_at: string;
}

export interface CanvasDiscussionTopic {
  id: number;
  title: string;
  message: string;
  html_url: string;
  posted_at: string | null;
}

export interface CanvasCourseWithSyllabus extends CanvasCourse {
  syllabus_body?: string;
}

export interface CanvasGradedSubmission {
  score: number | null;
  graded_at: string | null;
  submitted_at: string | null;
  workflow_state: string;
  excused?: boolean | null;
  missing?: boolean;
  late?: boolean;
}

export interface CanvasGroupAssignment {
  id: number;
  name: string;
  points_possible: number | null;
  due_at: string | null;
  html_url: string;
  omit_from_final_grade?: boolean;
  submission?: CanvasGradedSubmission;
}

export interface CanvasAssignmentGroup {
  id: number;
  name: string;
  group_weight: number | null;
  rules?: { drop_lowest?: number; drop_highest?: number; never_drop?: number[] };
  assignments?: CanvasGroupAssignment[];
}

export interface CanvasEnrollment {
  course_id: number;
  type: string;
  grades?: {
    current_score: number | null;
    current_grade: string | null;
    final_score: number | null;
  };
}

export interface CanvasCourseWeights extends CanvasCourse {
  apply_assignment_group_weights?: boolean;
}

export interface CanvasPlannerItem {
  course_id?: number;
  context_name?: string;
  plannable_type: string;
  plannable_date: string;
  html_url: string;
  plannable: { title: string; due_at?: string | null; points_possible?: number | null };
  submissions?:
    | false
    | { submitted?: boolean; graded?: boolean; missing?: boolean; late?: boolean; excused?: boolean };
}
