import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  getCourseWeights,
  listActiveCourses,
  listAssignmentGroups,
  listPlannerItems,
  listStudentEnrollments,
} from "../../canvas/endpoints.js";
import { estimateGrade } from "../../canvas/grades.js";
import type { ServerContext } from "../context.js";
import { textResult } from "../shared.js";

const TIME_ZONE = "America/New_York";

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "no date";
  return new Date(iso).toLocaleString("en-US", {
    timeZone: TIME_ZONE,
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function pct(n: number | null): string {
  return n === null ? "n/a" : `${n.toFixed(2)}%`;
}

export function registerGradeTools(server: McpServer, ctx: ServerContext): void {
  server.registerTool(
    "get_grades",
    {
      title: "Get Grades",
      description:
        "Current grade for each active course (or one course_id): Canvas's own score when the instructor shows it, plus an estimate computed from graded work with a per-category breakdown, plus assignments graded in the last N days. Read-only.",
      inputSchema: z.object({
        course_id: z.number().int().optional().describe("Restrict to one Canvas course id"),
        recent_days: z.number().int().min(1).max(60).optional().describe("Look-back window for recently graded items (default 14)"),
      }),
      annotations: { readOnlyHint: true, destructiveHint: false },
    },
    async ({ course_id, recent_days }) => {
      const days = recent_days ?? 14;
      const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;

      const [courses, enrollments] = await Promise.all([
        listActiveCourses(ctx.client),
        listStudentEnrollments(ctx.client).catch(() => []),
      ]);
      const targets = course_id ? courses.filter((c) => c.id === course_id) : courses;
      if (targets.length === 0) return textResult("No matching active courses found.");

      const sections: string[] = [];
      const recent: { when: number; line: string }[] = [];

      for (const course of targets) {
        const enrollment = enrollments.find((e) => e.course_id === course.id);
        const canvasScore = enrollment?.grades?.current_score ?? null;
        const canvasLetter = enrollment?.grades?.current_grade ?? null;

        try {
          const [meta, groups] = await Promise.all([
            getCourseWeights(ctx.client, course.id),
            listAssignmentGroups(ctx.client, course.id),
          ]);
          const est = estimateGrade(groups, Boolean(meta.apply_assignment_group_weights));

          const groupLines = est.groups
            .filter((g) => g.gradedCount > 0 || g.weight)
            .map(
              (g) =>
                `    - ${g.name}${g.weight ? ` (weight ${g.weight}%)` : ""}: ${g.earned}/${g.possible} = ${pct(g.percent)}, ${g.gradedCount} graded${g.dropRules ? ` [${g.dropRules}, not applied]` : ""}`,
            );

          sections.push(
            [
              `- ${course.name} (course_id=${course.id})`,
              `  Canvas score: ${canvasScore === null ? "hidden or not shown by instructor" : `${pct(canvasScore)}${canvasLetter ? ` (${canvasLetter})` : ""}`}`,
              `  Estimate from graded work: ${pct(est.percent)} (${est.weighted ? "weighted categories" : "total points"})`,
              ...groupLines,
            ].join("\n"),
          );

          for (const g of groups) {
            for (const a of g.assignments ?? []) {
              const gradedAt = a.submission?.graded_at;
              if (!gradedAt || a.submission?.score === null || a.submission?.score === undefined) continue;
              const when = new Date(gradedAt).getTime();
              if (when < cutoff) continue;
              recent.push({
                when,
                line: `- ${course.course_code}: ${a.name} = ${a.submission.score}/${a.points_possible ?? "?"} (graded ${fmtDate(gradedAt)})`,
              });
            }
          }
        } catch (err) {
          sections.push(`- ${course.name} (course_id=${course.id})\n  Could not read grades: ${(err as Error).message}`);
        }
      }

      recent.sort((a, b) => b.when - a.when);
      const recentBlock = recent.length
        ? `\n\nGraded in the last ${days} days:\n${recent.map((r) => r.line).join("\n")}`
        : `\n\nNothing graded in the last ${days} days.`;

      return textResult(
        `Grades (times in ${TIME_ZONE}). Estimates count graded work only and ignore drop rules.\n\n${sections.join("\n\n")}${recentBlock}`,
      );
    },
  );

  server.registerTool(
    "get_due_soon",
    {
      title: "Get Due Soon",
      description:
        "Everything due in the next N days across all courses from the Canvas planner (assignments, quizzes, discussions), with submitted/missing status, sorted by due time. Read-only.",
      inputSchema: z.object({
        days: z.number().int().min(1).max(30).optional().describe("How many days ahead to look (default 7)"),
        hide_submitted: z.boolean().optional().describe("Leave out items already submitted (default false)"),
      }),
      annotations: { readOnlyHint: true, destructiveHint: false },
    },
    async ({ days, hide_submitted }) => {
      const span = days ?? 7;
      const start = new Date();
      const end = new Date(start.getTime() + span * 24 * 60 * 60 * 1000);
      const items = await listPlannerItems(ctx.client, start.toISOString(), end.toISOString());

      const rows = items
        .filter((i) => i.plannable_type !== "announcement")
        .map((i) => {
          const s = i.submissions || {};
          const status = s.excused
            ? "excused"
            : s.graded
              ? "graded"
              : s.submitted
                ? "submitted"
                : s.missing
                  ? "MISSING"
                  : "not submitted";
          const due = i.plannable.due_at ?? i.plannable_date;
          return { due, status, line: `- ${fmtDate(due)} | ${i.context_name ?? "course"} | ${i.plannable.title} | ${i.plannable.points_possible ?? "?"} pts | ${status}\n  ${i.html_url}` };
        })
        .filter((r) => !(hide_submitted && (r.status === "submitted" || r.status === "graded" || r.status === "excused")))
        .sort((a, b) => new Date(a.due).getTime() - new Date(b.due).getTime());

      if (rows.length === 0) return textResult(`Nothing due in the next ${span} days.`);
      return textResult(`${rows.length} item(s) due in the next ${span} days (times in ${TIME_ZONE}):\n${rows.map((r) => r.line).join("\n")}`);
    },
  );
}
