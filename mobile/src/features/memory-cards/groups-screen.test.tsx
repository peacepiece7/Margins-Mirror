import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, waitFor } from "@testing-library/react-native";

import { ApiClientProvider } from "@/shared/api/api-client-provider";
import type { ApiClient } from "@/shared/api/client";

import { MemoryCardGroupsScreen } from "./groups-screen";

let mockLocale: "en" | "ko" = "en";
jest.mock("@/shared/i18n/i18n-provider", () => ({
  useI18n: () => ({ locale: mockLocale }),
}));

beforeEach(() => {
  mockLocale = "en";
});

// BDD: MEM-009
// BDD: MEM-004 - the native convenience gate avoids protected Memory Card
// calls for a non-Premium session; the backend remains authoritative.
it("shows the Premium gate without calling the protected group endpoint", async () => {
  const client = {
    get: jest.fn(),
    post: jest.fn(),
    patch: jest.fn(),
    delete: jest.fn(),
  } as unknown as ApiClient;
  const queryClient = new QueryClient({
    defaultOptions: {
      mutations: { gcTime: Infinity, retry: false },
      queries: { gcTime: Infinity, retry: false },
    },
  });
  const view = await render(
    <ApiClientProvider client={client}>
      <QueryClientProvider client={queryClient}>
        <MemoryCardGroupsScreen
          bookId={7}
          onBack={jest.fn()}
          onOpenGroup={jest.fn()}
          premium={false}
        />
      </QueryClientProvider>
    </ApiClientProvider>,
  );
  expect(view.getByTestId("memory-card-premium-gate")).toBeTruthy();
  expect(client.get).not.toHaveBeenCalled();
  expect(view.getByRole("button")).toHaveStyle({ minHeight: 44, minWidth: 44 });
  view.unmount();
  queryClient.clear();
});

// BDD: FRONT-158 - group metadata dates follow the selected native locale.
it("formats group update dates with the selected locale", async () => {
  mockLocale = "ko";
  const onBack = jest.fn();
  const client = {
    get: jest.fn().mockResolvedValue({
      groups: [
        {
          groupId: 2,
          title: "Words",
          cardCount: 1,
          updatedAt: "2026-08-24T00:00:00Z",
        },
      ],
    }),
    post: jest.fn(),
    patch: jest.fn(),
    delete: jest.fn(),
  } as unknown as ApiClient;
  const queryClient = new QueryClient({
    defaultOptions: {
      mutations: { gcTime: Infinity, retry: false },
      queries: { gcTime: Infinity, retry: false },
    },
  });
  const view = await render(
    <ApiClientProvider client={client}>
      <QueryClientProvider client={queryClient}>
        <MemoryCardGroupsScreen
          bookId={7}
          onBack={onBack}
          onOpenGroup={jest.fn()}
          premium
        />
      </QueryClientProvider>
    </ApiClientProvider>,
  );

  expect(await view.findByTestId("memory-card-group-updated-2")).toHaveTextContent(
    "2026. 8. 24. 업데이트",
  );
  expect(view.getByTestId("memory-card-premium-context")).toHaveTextContent(
    "Margins 계정에 저장되는 Premium 학습 그룹입니다.Premium",
  );
  expect(client.get).toHaveBeenCalledWith("/api/memory-card-groups?bookId=7");
  await fireEvent.press(view.getByRole("button", { name: "책장으로 돌아가기" }));
  expect(onBack).toHaveBeenCalledTimes(1);
  view.unmount();
  queryClient.clear();
});

it("resets the group draft and submits the new scope when the route book changes", async () => {
  const client = {
    get: jest.fn().mockResolvedValue({ groups: [] }),
    post: jest.fn().mockResolvedValue({ bookId: 8, cardCount: 0, groupId: 3, title: "New words" }),
    patch: jest.fn(),
    delete: jest.fn(),
  } as unknown as ApiClient;
  const queryClient = new QueryClient({
    defaultOptions: {
      mutations: { gcTime: Infinity, retry: false },
      queries: { gcTime: Infinity, retry: false },
    },
  });
  const content = (bookId: number) => (
    <ApiClientProvider client={client}>
      <QueryClientProvider client={queryClient}>
        <MemoryCardGroupsScreen
          bookId={bookId}
          onBack={jest.fn()}
          onOpenGroup={jest.fn()}
          premium
        />
      </QueryClientProvider>
    </ApiClientProvider>
  );
  const view = await render(content(7));

  await fireEvent.changeText(view.getByLabelText("Group title"), "Old draft");
  await act(async () => {
    view.rerender(content(8));
  });
  await waitFor(() => {
    expect(view.getByLabelText("Group title")).toHaveProp("value", "");
  });
  await fireEvent.changeText(view.getByLabelText("Group title"), "New words");
  await fireEvent.press(view.getByRole("button", { name: "Create group" }));

  await waitFor(() => {
    expect(client.post).toHaveBeenCalledWith("/api/memory-card-groups", {
      bookId: 8,
      description: "",
      sourceLabel: "",
      title: "New words",
    });
  });
  view.unmount();
  queryClient.clear();
});
