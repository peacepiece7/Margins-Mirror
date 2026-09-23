import {
  initialDebatePersonaIds,
  nextDebatePersonaId,
  normalizeDebatePersonaKey,
  resolveActiveDebatePersonaIds,
  resolveDebatePersonaIds,
  resolveDebatePersonaIdsByKey,
  resolveNewDebatePersonaIds,
  shouldClearDebateDraft,
} from "./persona-selection";

describe("resolveDebatePersonaIds", () => {
  it("initializes a new room from recommendations without hiding the active catalog", () => {
    expect(initialDebatePersonaIds([1, 2, 3], [3, 1, 99])).toEqual([3, 1]);
  });

  // BDD: FRONT-167 then-1/then-2
  it("resolves Book Knowledge keys ahead of category defaults, including legacy underscores", () => {
    const personas = [
      { displayName: "Literary Critic", name: "literary-critic", personaId: 4 },
      { displayName: "Historical Context", name: "historical-context", personaId: 5 },
      { displayName: "Category Default", name: "category-default", personaId: 6 },
    ];

    expect(normalizeDebatePersonaKey(" LITERARY_CRITIC ")).toBe("literary-critic");
    expect(resolveDebatePersonaIdsByKey(personas, ["LITERARY_CRITIC", "historical-context"]))
      .toEqual([4, 5]);
  });

  // BDD: FRONT-091
  it("replaces a stale new-room selection with the first active Persona", () => {
    expect(resolveNewDebatePersonaIds([91], [], [4, 5])).toEqual([4]);
    expect(resolveNewDebatePersonaIds([91], [], [])).toEqual([]);
  });
  it("keeps the persisted room participants exactly", () => {
    expect(resolveDebatePersonaIds([91, 92], [1, 2])).toEqual([91, 92]);
  });

  it("uses at most two recommendations for a legacy room", () => {
    expect(resolveDebatePersonaIds([], [1, 2, 3])).toEqual([1, 2]);
    expect(resolveDebatePersonaIds(undefined, [])).toEqual([]);
  });

  // BDD: DEBATE-018
  it("uses recommendations only for legacy rooms and never substitutes a stale stored selection", () => {
    expect(resolveActiveDebatePersonaIds(undefined, [3], [1, 3])).toEqual([3]);
    expect(resolveActiveDebatePersonaIds([], [3, 1, 99], [1, 3])).toEqual([3, 1]);
    expect(resolveActiveDebatePersonaIds(undefined, [], [1, 3])).toEqual([]);
    expect(resolveActiveDebatePersonaIds([91], [3], [1, 3])).toEqual([]);
    expect(resolveActiveDebatePersonaIds([91], [], [1, 3])).toEqual([]);
    expect(resolveActiveDebatePersonaIds([91], [], [])).toEqual([]);
  });

  // BDD: FRONT-128
  it("selects the visible participant with the fewest assistant replies", () => {
    expect(nextDebatePersonaId([4, 7], [
      { personaId: 4, role: "assistant" },
      { personaId: 4, role: "assistant" },
      { personaId: 7, role: "assistant" },
      { role: "user" },
    ])).toBe(7);
  });

  it("preserves a draft when moderation blocks the turn", () => {
    expect(
      shouldClearDebateDraft({
        messages: [],
        moderation: {
          decision: "REJECT",
          eventId: 4,
          reasonCode: "OFF_TOPIC",
        },
      }),
    ).toBe(false);
    expect(shouldClearDebateDraft({ messages: [], moderation: null })).toBe(
      true,
    );
  });
});
