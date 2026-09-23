import { fireEvent, render } from "@testing-library/react-native";
import { Alert } from "react-native";

import {
  usePublicReviewsQuery,
  useReviewCommentMutations,
  useReviewCommentsQuery,
} from "./queries";
import { ReviewDetailScreen, ReviewsScreen } from "./reviews-screen";

jest.mock("@/shared/i18n/i18n-provider", () => ({
  useI18n: () => ({ locale: "en" }),
}));
jest.mock("./queries", () => ({
  usePublicReviewsQuery: jest.fn(),
  useReviewCommentMutations: jest.fn(),
  useReviewCommentsQuery: jest.fn(),
}));

function mutation() {
  return { isError: false, isPending: false, mutate: jest.fn() };
}

// BDD: FRONT-133, FRONT-136
// BDD: FRONT-136
it("offers replies only for top-level comments and hides owner actions for other readers", async () => {
  jest.mocked(usePublicReviewsQuery).mockReturnValue({
    data: {
      reviews: [
        {
          insightId: 7,
          sessionId: 3,
          bookId: 2,
          bookTitle: "Margins",
          sessionTitle: "A review",
          content: "Reflection",
        },
      ],
    },
    isError: false,
    isPending: false,
  } as ReturnType<typeof usePublicReviewsQuery>);
  jest.mocked(useReviewCommentsQuery).mockReturnValue({
    data: {
      insightId: 7,
      comments: [
        {
          commentId: 10,
          insightId: 7,
          content: "Top level",
          ownedByCurrentReader: false,
        },
        {
          commentId: 11,
          insightId: 7,
          parentCommentId: 10,
          content: "One reply deep",
          ownedByCurrentReader: false,
        },
      ],
    },
    isError: false,
    isPending: false,
  } as ReturnType<typeof useReviewCommentsQuery>);
  jest.mocked(useReviewCommentMutations).mockReturnValue({
    create: mutation(),
    remove: mutation(),
    update: mutation(),
  } as unknown as ReturnType<typeof useReviewCommentMutations>);
  const view = await render(<ReviewsScreen />);

  const commentsButton = view.getByRole("button", { name: "Comments" });
  expect(commentsButton.props.accessibilityState).toMatchObject({
    expanded: false,
  });
  await fireEvent.press(commentsButton);

  expect(view.getAllByRole("button", { name: "Reply" })).toHaveLength(1);
  expect(view.queryByRole("button", { name: "Edit" })).toBeNull();
  expect(view.queryByRole("button", { name: "Delete" })).toBeNull();
  expect(
    view.getByRole("button", { name: "Cancel" }).props.accessibilityState,
  ).toMatchObject({ expanded: true });
});

// BDD: FRONT-132, FRONT-133, FRONT-134, FRONT-135
// BDD: FRONT-134
// BDD: FRONT-135
it("creates, replies to, edits, and deletes comments through owned controls", async () => {
  jest.mocked(usePublicReviewsQuery).mockReturnValue({
    data: {
      reviews: [{ insightId: 7, sessionId: 3, bookId: 2, bookTitle: "Margins", sessionTitle: "A review", content: "Reflection" }],
    },
    isError: false,
    isPending: false,
  } as ReturnType<typeof usePublicReviewsQuery>);
  jest.mocked(useReviewCommentsQuery).mockReturnValue({
    data: {
      insightId: 7,
      comments: [{ commentId: 10, insightId: 7, content: "Owned comment", ownedByCurrentReader: true }],
    },
    isError: false,
    isPending: false,
  } as ReturnType<typeof useReviewCommentsQuery>);
  const create = mutation();
  const update = mutation();
  const remove = mutation();
  create.mutate.mockImplementation((_input, options) => options.onSuccess());
  update.mutate.mockImplementation((_input, options) => options.onSuccess());
  jest.mocked(useReviewCommentMutations).mockReturnValue({ create, update, remove } as unknown as ReturnType<typeof useReviewCommentMutations>);
  const alert = jest.spyOn(Alert, "alert").mockImplementation(() => undefined);
  const view = await render(<ReviewsScreen />);
  await fireEvent.press(view.getByRole("button", { name: "Comments" }));

  await fireEvent.changeText(view.getByTestId("bdd-front-132-comment-composer"), "New comment");
  await fireEvent.press(view.getByRole("button", { name: "Post" }));
  expect(create.mutate).toHaveBeenCalledWith({ content: "New comment", parentCommentId: undefined }, expect.any(Object));

  await fireEvent.press(view.getByRole("button", { name: "Reply" }));
  await fireEvent.changeText(view.getByTestId("bdd-front-133-reply-composer"), "Thread reply");
  await fireEvent.press(view.getByRole("button", { name: "Post" }));
  expect(create.mutate).toHaveBeenLastCalledWith({ content: "Thread reply", parentCommentId: 10 }, expect.any(Object));

  await fireEvent.press(view.getByRole("button", { name: "Edit" }));
  await fireEvent.changeText(view.getByLabelText("Edit"), "Edited comment");
  await fireEvent.press(view.getByRole("button", { name: "Save" }));
  expect(update.mutate).toHaveBeenCalledWith({ commentId: 10, content: "Edited comment" }, expect.any(Object));

  await fireEvent.press(view.getByRole("button", { name: "Delete" }));
  alert.mock.calls.at(-1)?.[2]?.[1]?.onPress?.();
  expect(remove.mutate).toHaveBeenCalledWith(10);
});

// BDD: FRONT-132, FRONT-135
it("retains create and edit drafts when a mutation fails", async () => {
  jest.mocked(usePublicReviewsQuery).mockReturnValue({
    data: {
      reviews: [{ insightId: 7, sessionId: 3, bookId: 2, bookTitle: "Margins", sessionTitle: "A review", content: "Reflection" }],
    },
    isError: false,
    isPending: false,
  } as ReturnType<typeof usePublicReviewsQuery>);
  jest.mocked(useReviewCommentsQuery).mockReturnValue({
    data: { insightId: 7, comments: [{ commentId: 10, insightId: 7, content: "Owned comment", ownedByCurrentReader: true }] },
    isError: false,
    isPending: false,
  } as ReturnType<typeof useReviewCommentsQuery>);
  const create = { ...mutation(), isError: true };
  const update = { ...mutation(), isError: true };
  jest.mocked(useReviewCommentMutations).mockReturnValue({ create, update, remove: mutation() } as unknown as ReturnType<typeof useReviewCommentMutations>);
  const view = await render(<ReviewsScreen />);
  await fireEvent.press(view.getByRole("button", { name: "Comments" }));
  await fireEvent.changeText(view.getByTestId("bdd-front-132-comment-composer"), "Keep this comment");
  await fireEvent.press(view.getByRole("button", { name: "Post" }));
  expect(view.getByTestId("bdd-front-132-comment-composer").props.value).toBe("Keep this comment");

  await fireEvent.press(view.getByRole("button", { name: "Edit" }));
  await fireEvent.changeText(view.getByLabelText("Edit"), "Keep this edit");
  await fireEvent.press(view.getByRole("button", { name: "Save" }));
  expect(view.getByLabelText("Edit").props.value).toBe("Keep this edit");
  expect(view.getByText("The comment could not be saved. Please try again.")).toBeTruthy();
});

it("opens an addressable review detail and keeps its comments visible", async () => {
  const review = {
    insightId: 7,
    sessionId: 3,
    bookId: 2,
    bookTitle: "Margins",
    sessionTitle: "A review",
    content: "Reflection",
  };
  jest.mocked(usePublicReviewsQuery).mockReturnValue({
    data: { reviews: [review] },
    isError: false,
    isPending: false,
  } as ReturnType<typeof usePublicReviewsQuery>);
  jest.mocked(useReviewCommentsQuery).mockReturnValue({
    data: { insightId: 7, comments: [] },
    isError: false,
    isPending: false,
  } as unknown as ReturnType<typeof useReviewCommentsQuery>);
  jest.mocked(useReviewCommentMutations).mockReturnValue({
    create: mutation(),
    remove: mutation(),
    update: mutation(),
  } as unknown as ReturnType<typeof useReviewCommentMutations>);
  const onBack = jest.fn();
  const view = await render(<ReviewDetailScreen insightId={7} onBack={onBack} />);

  expect(view.getByTestId("review-detail-screen")).toBeTruthy();
  expect(view.getByTestId("public-review-detail-privacy-note")).toHaveTextContent(
    "Only reviews you choose to publish appear here. Debate records and interview answers stay private.",
  );
  expect(view.queryByText("Public reviews")).toBeNull();
  expect(view.getByText("Reflection")).toBeTruthy();
  expect(view.getByLabelText("Add a thoughtful comment")).toBeTruthy();
  await fireEvent.press(view.getByRole("button", { name: "Back to reviews" }));
  expect(onBack).toHaveBeenCalledTimes(1);
});

it("blocks repeated comment actions while update and delete mutations are pending", async () => {
  jest.mocked(usePublicReviewsQuery).mockReturnValue({
    data: {
      reviews: [{ insightId: 7, sessionId: 3, bookId: 2, bookTitle: "Margins", sessionTitle: "A review", content: "Reflection" }],
    },
    isError: false,
    isPending: false,
  } as ReturnType<typeof usePublicReviewsQuery>);
  jest.mocked(useReviewCommentsQuery).mockReturnValue({
    data: {
      insightId: 7,
      comments: [{ commentId: 10, insightId: 7, content: "Owned comment", ownedByCurrentReader: true }],
    },
    isError: false,
    isPending: false,
  } as ReturnType<typeof useReviewCommentsQuery>);
  const create = mutation();
  const update = mutation();
  const remove = mutation();
  jest.mocked(useReviewCommentMutations).mockReturnValue({
    create,
    update,
    remove,
  } as unknown as ReturnType<typeof useReviewCommentMutations>);
  const view = await render(<ReviewsScreen />);
  await fireEvent.press(view.getByRole("button", { name: "Comments" }));
  await fireEvent.press(view.getByRole("button", { name: "Edit" }));

  jest.mocked(useReviewCommentMutations).mockReturnValue({
    create,
    update: {
      ...update,
      isPending: true,
      variables: { commentId: 10, content: "Owned comment" },
    },
    remove,
  } as unknown as ReturnType<typeof useReviewCommentMutations>);
  await view.rerender(<ReviewsScreen />);
  expect(view.getByLabelText("Edit")).toBeDisabled();
  expect(view.getByRole("button", { name: "Save" })).toBeDisabled();
  expect(view.getByRole("button", { name: "Save" }).props.accessibilityState).toMatchObject({
    busy: true,
  });

  jest.mocked(useReviewCommentMutations).mockReturnValue({
    create,
    update,
    remove,
  } as unknown as ReturnType<typeof useReviewCommentMutations>);
  await view.rerender(<ReviewsScreen />);
  await fireEvent.changeText(view.getByLabelText("Edit"), "   ");
  expect(view.getByRole("button", { name: "Save" })).toBeDisabled();
  const cancelActions = view.getAllByRole("button", { name: "Cancel" });
  await fireEvent.press(cancelActions[cancelActions.length - 1]);

  jest.mocked(useReviewCommentMutations).mockReturnValue({
    create,
    update,
    remove: { ...remove, isPending: true, variables: 10 },
  } as unknown as ReturnType<typeof useReviewCommentMutations>);
  await view.rerender(<ReviewsScreen />);
  expect(view.getByRole("button", { name: "Delete" })).toBeDisabled();
  expect(view.getByRole("button", { name: "Delete" }).props.accessibilityState).toMatchObject({
    busy: true,
  });
});

// BDD: FRONT-130 then-2
it("virtualizes public reviews and shows the privacy boundary with available publication metadata", async () => {
  jest.mocked(usePublicReviewsQuery).mockReturnValue({
    data: {
      reviews: [{
        authorName: "Reader M",
        bookAuthor: "Simone de Beauvoir",
        bookId: 2,
        bookTitle: "A Very Easy Death",
        content: "Care changes the language of time.",
        createdAt: "2026-08-31T08:20:00Z",
        insightId: 7,
        sessionId: 3,
        sessionTitle: "Care and time",
      }],
    },
    isError: false,
    isPending: false,
  } as ReturnType<typeof usePublicReviewsQuery>);

  const view = await render(<ReviewsScreen />);

  expect(view.getByTestId("reviews-screen")).toBeTruthy();
  expect(view.getByTestId("public-review-privacy-note")).toHaveTextContent(
    "Only reviews you choose to publish appear here. Debate records and interview answers stay private.",
  );
  expect(view.getByText("Care and time")).toBeTruthy();
  expect(view.getByText("A Very Easy Death · Simone de Beauvoir")).toBeTruthy();
  expect(view.getByText("By Reader M · 2026-08-31")).toBeTruthy();
});
