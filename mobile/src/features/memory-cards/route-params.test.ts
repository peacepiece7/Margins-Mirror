import { positiveRouteId } from "./route-params";

// BDD: FRONT-146, MEM-002 - route parsing restores the exact positive group
// identifier used by both detail and direct study deep links.
it("accepts a positive safe route id and rejects ambiguous identifiers", () => {
  expect(positiveRouteId("42")).toBe(42);
  expect(positiveRouteId(["7", "8"])).toBe(7);
  expect(positiveRouteId("0")).toBeNaN();
  expect(positiveRouteId("01")).toBeNaN();
  expect(positiveRouteId("4/study")).toBeNaN();
  expect(positiveRouteId(String(Number.MAX_SAFE_INTEGER + 1))).toBeNaN();
});
