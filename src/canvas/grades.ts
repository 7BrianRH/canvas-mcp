import type { CanvasAssignmentGroup } from "./types.js";

export interface GroupBreakdown {
  name: string;
  weight: number | null;
  earned: number;
  possible: number;
  percent: number | null;
  gradedCount: number;
  dropRules: string | null;
}

export interface GradeEstimate {
  percent: number | null;
  weighted: boolean;
  groups: GroupBreakdown[];
}

/**
 * Estimates a course grade from scored work only (including auto-zeros for missing work), the same way Canvas shows
 * "current" grades: ungraded and excused items are left out. Drop-lowest rules
 * are reported but NOT applied, so the estimate can run a little low in courses
 * that drop scores.
 */
export function estimateGrade(groups: CanvasAssignmentGroup[], weighted: boolean): GradeEstimate {
  const breakdown: GroupBreakdown[] = groups.map((g) => {
    let earned = 0;
    let possible = 0;
    let gradedCount = 0;
    for (const a of g.assignments ?? []) {
      const sub = a.submission;
      if (a.omit_from_final_grade) continue;
      if (!sub || sub.excused) continue;
      // Count any posted score, including zeros Canvas auto-applies to missing
      // work (those keep workflow_state "unsubmitted" but still count in Canvas's total).
      if (sub.score === null || sub.score === undefined) continue;
      earned += sub.score;
      possible += a.points_possible ?? 0;
      gradedCount += 1;
    }
    const rules: string[] = [];
    if (g.rules?.drop_lowest) rules.push(`drops lowest ${g.rules.drop_lowest}`);
    if (g.rules?.drop_highest) rules.push(`drops highest ${g.rules.drop_highest}`);
    return {
      name: g.name,
      weight: g.group_weight,
      earned,
      possible,
      percent: possible > 0 ? (earned / possible) * 100 : null,
      gradedCount,
      dropRules: rules.length ? rules.join(", ") : null,
    };
  });

  let percent: number | null = null;
  if (weighted) {
    let weightUsed = 0;
    let total = 0;
    for (const g of breakdown) {
      if (g.percent === null || !g.weight) continue;
      total += g.weight * g.percent;
      weightUsed += g.weight;
    }
    percent = weightUsed > 0 ? total / weightUsed : null;
  } else {
    const earned = breakdown.reduce((s, g) => s + g.earned, 0);
    const possible = breakdown.reduce((s, g) => s + g.possible, 0);
    percent = possible > 0 ? (earned / possible) * 100 : null;
  }

  return { percent, weighted, groups: breakdown };
}
