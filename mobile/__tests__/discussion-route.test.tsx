import { render } from "@testing-library/react-native";

import DiscussRoute from "@/app/(protected)/books/[bookId]/reflection/discuss/[runId]";

const mockDiscussionScreen = jest.fn();
let mockParams: Record<string, string> = { bookId: "2", runId: "7" };
let mockPersonas: Record<string, unknown> = {
  data: {
    personas: [
      {
        displayName: "Journalist",
        name: "journalist",
        personaId: 42,
        tone: "Context and intent",
      },
    ],
  },
  isError: false,
};

jest.mock("expo-router", () => ({
  router: {
    back: jest.fn(),
    canGoBack: () => false,
    replace: jest.fn(),
  },
  useLocalSearchParams: () => mockParams,
}));
jest.mock("@/shared/i18n/i18n-provider", () => ({
  useI18n: () => ({ locale: "en" }),
}));
jest.mock("@/features/debates/queries", () => ({
  usePersonaCatalog: () => mockPersonas,
}));
jest.mock("@/features/reflections/screens", () => ({
  DiscussionScreen: (props: unknown) => {
    mockDiscussionScreen(props);
    return null;
  },
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockParams = { bookId: "2", runId: "7" };
  mockPersonas = {
    data: {
      personas: [
        {
          displayName: "Journalist",
          name: "journalist",
          personaId: 42,
          tone: "Context and intent",
        },
      ],
    },
    isError: false,
  };
});

// BDD: MOBILE-018
it("passes localized Persona catalog labels into the guided Discussion", async () => {
  await render(<DiscussRoute />);

  expect(mockDiscussionScreen).toHaveBeenCalledWith(
    expect.objectContaining({
      bookId: 2,
      personaNames: { 42: "Journalist" },
      runId: 7,
    }),
  );
});

// BDD: MOBILE-018
it("keeps Discussion available while the optional Persona catalog is unavailable", async () => {
  mockPersonas = { data: undefined, isError: true };
  await render(<DiscussRoute />);

  expect(mockDiscussionScreen).toHaveBeenCalledWith(
    expect.objectContaining({ personaNames: {} }),
  );
});
