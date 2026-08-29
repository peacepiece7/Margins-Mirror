import { beforeEach, describe, expect, it, vi } from 'vitest';

import { deleteJson, getJson, patchJson, postJson, putJson } from '@/lib/api-client';

import { reflectionsApi } from './api';

vi.mock('@/lib/api-client', () => ({
  deleteJson: vi.fn(),
  getJson: vi.fn(),
  patchJson: vi.fn(),
  postJson: vi.fn(),
  putJson: vi.fn(),
}));

describe('reflectionsApi', () => {
  beforeEach(() => vi.clearAllMocks());

  it('loads the book-scoped reading-session locator', async () => {
    vi.mocked(getJson).mockResolvedValue({ sessionId: 3, title: 'Dune reflection' });

    await reflectionsApi.readingSession(7);

    expect(getJson).toHaveBeenCalledWith('/api/books/7/reading-session');
  });

  it('generates questions with explicit transport inputs', async () => {
    vi.mocked(postJson).mockResolvedValue({ questions: [] });
    await reflectionsApi.generateQuestions(3, 2, 'Dune');
    expect(postJson).toHaveBeenCalledWith('/api/session-windows/3/questions/generate', {
      count: 2,
      focus: 'Dune',
    });
  });

  it('updates an insight without adding workflow fields', async () => {
    vi.mocked(patchJson).mockResolvedValue({});
    await reflectionsApi.updateInsight(2, 7, { content: 'Changed', visibility: 'PRIVATE' });
    expect(patchJson).toHaveBeenCalledWith('/api/reading-sessions/2/insights/7', {
      content: 'Changed',
      visibility: 'PRIVATE',
    });
  });

  it('owns question answer and debate-window preparation endpoints', async () => {
    vi.mocked(putJson).mockResolvedValue({});
    await reflectionsApi.saveAnswer(4, 'Answer');
    await reflectionsApi.ensureDebateWindow(4);
    expect(putJson).toHaveBeenNthCalledWith(1, '/api/questions/4/answer', { content: 'Answer' });
    expect(putJson).toHaveBeenNthCalledWith(2, '/api/questions/4/debate-window', {});
  });

  it('deletes questions through the question endpoint', async () => {
    vi.mocked(deleteJson).mockResolvedValue({});
    await reflectionsApi.deleteQuestion(4);
    expect(deleteJson).toHaveBeenCalledWith('/api/questions/4');
  });

  it('uses canonical Reflection and Interview endpoints', async () => {
    vi.mocked(postJson).mockResolvedValue({});
    vi.mocked(getJson).mockResolvedValue({});
    vi.mocked(patchJson).mockResolvedValue({});

    await reflectionsApi.createReflection(9, { content: 'First', visibility: 'PRIVATE' });
    await reflectionsApi.reflection(11);
    await reflectionsApi.updateReflection(11, { content: 'Second', visibility: 'PUBLIC' });
    await reflectionsApi.startInterview(11);
    await reflectionsApi.interview(12);
    await reflectionsApi.respondToInterview(12, 13, 'BOOK_ONLY');
    await reflectionsApi.updateInterviewAnswer(12, 13, {
      expectedAnswerVersion: 1,
      content: '다듬은 답변',
      revisionKind: 'WORDING_ONLY',
    });
    await reflectionsApi.continueInterview(12);

    expect(postJson).toHaveBeenNthCalledWith(1, '/api/reading-sessions/9/reflections', {
      content: 'First',
      visibility: 'PRIVATE',
    });
    expect(getJson).toHaveBeenNthCalledWith(1, '/api/reflections/11');
    expect(patchJson).toHaveBeenCalledWith('/api/reflections/11', {
      content: 'Second',
      visibility: 'PUBLIC',
    });
    expect(postJson).toHaveBeenNthCalledWith(2, '/api/reflections/11/interviews', {});
    expect(getJson).toHaveBeenNthCalledWith(2, '/api/reflection-interviews/12');
    expect(postJson).toHaveBeenNthCalledWith(3, '/api/reflection-interviews/12/responses', {
      questionId: 13,
      mode: 'BOOK_ONLY',
      content: undefined,
    });
    expect(putJson).toHaveBeenCalledWith('/api/reflection-interviews/12/answers/13', {
      expectedAnswerVersion: 1,
      content: '다듬은 답변',
      revisionKind: 'WORDING_ONLY',
    });
    expect(postJson).toHaveBeenNthCalledWith(4, '/api/reflection-interviews/12/continue', {});
  });

  it('owns guide, run, turn, completion, and refinement transport', async () => {
    vi.mocked(postJson).mockResolvedValue({});
    vi.mocked(getJson).mockResolvedValue({});

    const brief = {
      purpose: 'THOUGHT_EXPANSION' as const,
      audienceMode: 'SELF_AI' as const,
      targetMinutes: 40 as const,
      disclosureMode: 'PRIVATE_CONTEXT' as const,
      facilitationLevel: 'BEGINNER' as const,
    };
    await reflectionsApi.createGuide(12, brief);
    await reflectionsApi.guide(20);
    await reflectionsApi.guideProjection(20, 'FACILITATOR');
    await reflectionsApi.guideMarkdown(20, 'PARTICIPANT');
    await reflectionsApi.guideVersions(12);
    await reflectionsApi.editGuide(20, {
      expectedVersion: 1,
      goal: 'Edited',
      issues: ['One', 'Two'],
      items: [],
    });
    await reflectionsApi.regenerateGuide(20, { expectedVersion: 1, brief });
    await reflectionsApi.createRun(20);
    await reflectionsApi.run(30);
    await reflectionsApi.turn(30, 'My answer', 'NEXT', 4);
    await reflectionsApi.completeRun(30);
    await reflectionsApi.refinement(30);
    await reflectionsApi.saveRefinement(30, 'KEPT', 'KEPT');

    expect(postJson).toHaveBeenNthCalledWith(1, '/api/reflection-interviews/12/guides', brief);
    expect(getJson).toHaveBeenNthCalledWith(1, '/api/discussion-guides/20');
    expect(getJson).toHaveBeenNthCalledWith(2, '/api/discussion-guides/20/projections/FACILITATOR');
    expect(getJson).toHaveBeenNthCalledWith(
      3,
      '/api/discussion-guides/20/exports/markdown?projection=PARTICIPANT',
    );
    expect(getJson).toHaveBeenNthCalledWith(4, '/api/reflection-interviews/12/guides');
    expect(postJson).toHaveBeenNthCalledWith(2, '/api/discussion-guides/20/versions', {
      expectedVersion: 1,
      goal: 'Edited',
      issues: ['One', 'Two'],
      items: [],
    });
    expect(postJson).toHaveBeenNthCalledWith(3, '/api/discussion-guides/20/regenerate', {
      expectedVersion: 1,
      brief,
    });
    expect(postJson).toHaveBeenNthCalledWith(4, '/api/discussion-guides/20/runs', {});
    expect(getJson).toHaveBeenNthCalledWith(5, '/api/discussion-runs/30');
    expect(postJson).toHaveBeenNthCalledWith(5, '/api/discussion-runs/30/turns', {
      content: 'My answer',
      navigation: 'NEXT',
      personaId: 4,
    });
    expect(postJson).toHaveBeenNthCalledWith(6, '/api/discussion-runs/30/complete', {
      closingNote: undefined,
    });
    expect(getJson).toHaveBeenNthCalledWith(6, '/api/discussion-runs/30/refinement');
    expect(postJson).toHaveBeenNthCalledWith(7, '/api/discussion-runs/30/refinement', {
      mode: 'KEPT',
      outcome: 'KEPT',
      finalContent: undefined,
    });
  });
});
