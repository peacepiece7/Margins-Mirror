import { ownsInterviewRoute, ownsReflectionRoute } from "./route-ownership";

const timeline = {
  bookId: 3,
  insights: [{ insightId: 6 }],
  sessionId: 5,
};

describe("reflection deep-link ownership", () => {
  it("requires the exact route book for guides, runs, and refinements", () => {
    expect(ownsReflectionRoute(timeline, 3)).toBe(true);
    expect(ownsReflectionRoute(timeline, 4)).toBe(false);
    expect(ownsReflectionRoute(timeline, 3, 5)).toBe(true);
    expect(ownsReflectionRoute(timeline, 3, 6)).toBe(false);
  });

  it("also requires the interview reflection in the supplied session", () => {
    expect(ownsInterviewRoute(timeline as never, 3, 6, 5)).toBe(true);
    expect(ownsInterviewRoute(timeline as never, 3, 7, 5)).toBe(false);
    expect(ownsInterviewRoute(timeline as never, 4, 6, 5)).toBe(false);
    expect(ownsInterviewRoute(timeline as never, 3, 6, 8)).toBe(false);
  });
});
