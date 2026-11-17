import { describe, expect, it, vi, afterEach } from "vitest";
import { CanvasClient } from "../src/canvas/client.js";
import { estimateGrade } from "../src/canvas/grades.js";

describe("token stays on the Canvas host", () => {
  afterEach(() => vi.unstubAllGlobals());
  const client = new CanvasClient({ baseUrl: "https://raritanval.instructure.com/api/v1", token: "secret" });

  it("accepts only https URLs on the configured host", () => {
    expect(client.isCanvasUrl("https://raritanval.instructure.com/files/1/download")).toBe(true);
    expect(client.isCanvasUrl("https://evil.example/steal")).toBe(false);
    expect(client.isCanvasUrl("http://raritanval.instructure.com/x")).toBe(false);
    expect(client.isCanvasUrl("https://raritanval.instructure.com.evil.example/x")).toBe(false);
  });

  it("never calls fetch for an off-host file URL", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const r = await client.getBytes("https://evil.example/file");
    expect(r.ok).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("follows a storage redirect without the token", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 302, headers: { Location: "https://storage.example/f?sig=1" } }))
      .mockResolvedValueOnce(new Response("hello", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const r = await client.getBytes("https://raritanval.instructure.com/files/1/download");
    expect(r.ok).toBe(true);
    expect((fetchMock.mock.calls[0]?.[1] as { headers: Record<string, string> }).headers.Authorization).toBe("Bearer secret");
    expect((fetchMock.mock.calls[1]?.[1] as { headers: Record<string, string> }).headers.Authorization).toBeUndefined();
  });
});

describe("estimateGrade", () => {
  const groups = [
    { id: 1, name: "Tests", group_weight: 60, assignments: [
      { id: 1, name: "T1", points_possible: 100, due_at: null, html_url: "", submission: { score: 80, graded_at: "x", submitted_at: "x", workflow_state: "graded" } },
      { id: 2, name: "T2", points_possible: 100, due_at: null, html_url: "", submission: { score: 58, graded_at: "x", submitted_at: "x", workflow_state: "graded" } },
      { id: 3, name: "T3", points_possible: 100, due_at: null, html_url: "", submission: { score: null, graded_at: null, submitted_at: null, workflow_state: "unsubmitted" } },
    ] },
    { id: 2, name: "Homework", group_weight: 40, assignments: [
      { id: 4, name: "H1", points_possible: 10, due_at: null, html_url: "", submission: { score: 10, graded_at: "x", submitted_at: "x", workflow_state: "graded" } },
      { id: 5, name: "H2", points_possible: 10, due_at: null, html_url: "", submission: { score: 0, graded_at: "x", submitted_at: "x", workflow_state: "graded", excused: true } },
      { id: 6, name: "H3", points_possible: 10, due_at: null, html_url: "", submission: { score: 0, graded_at: "x", submitted_at: null, workflow_state: "unsubmitted", missing: true } },
    ] },
  ];

  it("weights categories and skips ungraded/excused work", () => {
    const est = estimateGrade(groups as never, true);
    // Tests 138/200 = 69%, Homework 10/20 = 50% (missing auto-zero counts) -> 0.6*69 + 0.4*50 = 61.4
    expect(est.percent).toBeCloseTo(61.4, 5);
  });

  it("uses total points when not weighted", () => {
    const est = estimateGrade(groups as never, false);
    // 148 / 220
    expect(est.percent).toBeCloseTo((148 / 220) * 100, 5);
  });
});
