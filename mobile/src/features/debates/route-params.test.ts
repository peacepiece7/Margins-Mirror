import { parseDebateRecommendationParams } from "./route-params";

// BDD: FRONT-166 then-2
// BDD: FRONT-167 then-1/then-2
it("parses the selected topic and no more than two normalized Persona keys", () => {
  expect(parseDebateRecommendationParams({
    personaKeys: ["LITERARY_CRITIC,historical-context", "ignored"],
    topic: "  What makes fear useful?  ",
  })).toEqual({
    recommendedPersonaKeys: ["literary-critic", "historical-context"],
    recommendedTopic: "What makes fear useful?",
  });
});

it("keeps manual debate entry available when recommendation parameters are absent", () => {
  expect(parseDebateRecommendationParams({})).toEqual({
    recommendedPersonaKeys: [],
    recommendedTopic: undefined,
  });
});
