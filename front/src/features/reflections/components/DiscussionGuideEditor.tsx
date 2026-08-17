import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { testAttr } from '@/utils/testAttrs';

import type { DiscussionGuideEditorProps } from '../discussion-guide-component-types';
import { guideEditMinutes, moveGuideEditItems } from '../discussion-guide-edit';
import {
  discussionGuideAudienceLabels,
  discussionGuidePurposeLabels,
  discussionGuideStageLabels,
} from '../discussion-guide-labels';

export function DiscussionGuideEditor({
  disabled,
  draft,
  guide,
  onChange,
}: DiscussionGuideEditorProps) {
  const requiredCount = draft.items.filter((item) => item.priority === 'REQUIRED').length;
  const optionalCount = draft.items.length - requiredCount;
  const expectedMinutes = guideEditMinutes(draft);

  function updateItem(index: number, update: Partial<(typeof draft.items)[number]>) {
    const nextItems = [...draft.items];
    nextItems[index] = { ...nextItems[index], ...update };
    onChange({ ...draft, items: nextItems });
  }

  function moveItem(index: number, offset: -1 | 1) {
    const nextItems = moveGuideEditItems(draft.items, index, offset);
    if (nextItems) onChange({ ...draft, items: nextItems });
  }

  return (
    <>
      <section className="grid gap-4 rounded border border-stone-300 bg-white p-4 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="font-semibold">토론 설계</h3>
          <div className="flex flex-wrap justify-end gap-2">
            <Badge>{guide.depth}</Badge>
            <Badge variant="outline">필수 {requiredCount}개</Badge>
            {optionalCount ? <Badge variant="outline">선택 {optionalCount}개</Badge> : null}
            <Badge variant="outline">목표 {guide.targetMinutes}분</Badge>
            {expectedMinutes !== guide.targetMinutes ? (
              <Badge variant="outline">질문 합계 {expectedMinutes}분</Badge>
            ) : null}
          </div>
        </div>
        <div className="flex flex-wrap gap-2 text-xs text-stone-600">
          <span className="rounded bg-stone-100 px-2.5 py-1.5">
            {discussionGuidePurposeLabels[guide.purpose] ?? guide.purpose}
          </span>
          <span className="rounded bg-stone-100 px-2.5 py-1.5">
            {discussionGuideAudienceLabels[guide.audienceMode] ?? guide.audienceMode}
          </span>
          <span className="rounded bg-stone-100 px-2.5 py-1.5">
            {guide.disclosureMode === 'PRIVATE_CONTEXT'
              ? '비공개 답변은 AI만 참고'
              : '비공개 답변 제외'}
          </span>
        </div>

        <div className="grid gap-2">
          <Label htmlFor="discussion-guide-goal">토론 목표</Label>
          <Textarea
            disabled={disabled}
            id="discussion-guide-goal"
            maxLength={500}
            onChange={(event) => onChange({ ...draft, goal: event.target.value })}
            value={draft.goal}
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {draft.issues.map((issue, index) => (
            <div className="grid gap-2" key={`issue-${index + 1}`}>
              <Label htmlFor={`discussion-guide-issue-${index + 1}`}>핵심 논점 {index + 1}</Label>
              <Input
                className="min-h-11"
                disabled={disabled}
                id={`discussion-guide-issue-${index + 1}`}
                maxLength={500}
                onChange={(event) => {
                  const nextIssues = [...draft.issues];
                  nextIssues[index] = event.target.value;
                  onChange({ ...draft, issues: nextIssues });
                }}
                value={issue}
              />
            </div>
          ))}
        </div>
      </section>

      <ol className="grid gap-3">
        {draft.items.map((item, index) => {
          const canMoveUp = Boolean(moveGuideEditItems(draft.items, index, -1));
          const canMoveDown = Boolean(moveGuideEditItems(draft.items, index, 1));
          return (
            <li
              className="grid gap-4 rounded border border-stone-300 bg-white p-4 sm:grid-cols-[8rem_minmax(0,1fr)] sm:p-5"
              key={item.itemId}
              {...testAttr('discussion-guide-item')}
            >
              <div>
                <span className="text-xs font-semibold tracking-[0.12em] text-stone-500">
                  {String(index + 1).padStart(2, '0')} /{' '}
                  {discussionGuideStageLabels[item.stage] ?? item.stage}
                </span>
                <div className="mt-2 flex flex-wrap gap-1">
                  <Badge variant={item.priority === 'REQUIRED' ? 'default' : 'outline'}>
                    {item.priority === 'REQUIRED' ? '필수' : '선택'}
                  </Badge>
                  <Badge variant="outline">{item.expectedMinutes}분</Badge>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-1">
                  <Button
                    aria-label={`${index + 1}번 질문 위로 이동`}
                    className="min-h-11"
                    disabled={disabled || !canMoveUp}
                    onClick={() => moveItem(index, -1)}
                    size="sm"
                    type="button"
                    variant="outline"
                  >
                    위로
                  </Button>
                  <Button
                    aria-label={`${index + 1}번 질문 아래로 이동`}
                    className="min-h-11"
                    disabled={disabled || !canMoveDown}
                    onClick={() => moveItem(index, 1)}
                    size="sm"
                    type="button"
                    variant="outline"
                  >
                    아래로
                  </Button>
                </div>
              </div>
              <div className="min-w-0">
                <div className="grid gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor={`discussion-guide-question-${item.itemId}`}>질문</Label>
                    <Textarea
                      disabled={disabled}
                      id={`discussion-guide-question-${item.itemId}`}
                      maxLength={1000}
                      onChange={(event) => updateItem(index, { question: event.target.value })}
                      value={item.question}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor={`discussion-guide-intent-${item.itemId}`}>진행 의도</Label>
                    <Textarea
                      disabled={disabled}
                      id={`discussion-guide-intent-${item.itemId}`}
                      maxLength={1000}
                      onChange={(event) => updateItem(index, { intent: event.target.value })}
                      value={item.intent}
                    />
                  </div>
                  <div className="grid gap-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-sm font-medium">후속 질문</span>
                      {item.followUps.length < 2 ? (
                        <Button
                          aria-label={`${index + 1}번 질문 후속 질문 추가`}
                          className="min-h-11"
                          disabled={disabled}
                          onClick={() => updateItem(index, { followUps: [...item.followUps, ''] })}
                          size="sm"
                          type="button"
                          variant="outline"
                        >
                          추가
                        </Button>
                      ) : null}
                    </div>
                    {item.followUps.length ? (
                      item.followUps.map((followUp, followUpIndex) => {
                        const followUpId = `discussion-guide-follow-up-${item.itemId}-${followUpIndex + 1}`;
                        return (
                          <div
                            className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end"
                            key={followUpId}
                          >
                            <div className="grid gap-2">
                              <Label htmlFor={followUpId}>후속 질문 {followUpIndex + 1}</Label>
                              <Input
                                className="min-h-11"
                                disabled={disabled}
                                id={followUpId}
                                maxLength={1000}
                                onChange={(event) => {
                                  const nextFollowUps = [...item.followUps];
                                  nextFollowUps[followUpIndex] = event.target.value;
                                  updateItem(index, { followUps: nextFollowUps });
                                }}
                                value={followUp}
                              />
                            </div>
                            <Button
                              aria-label={`${index + 1}번 질문 후속 질문 ${followUpIndex + 1} 삭제`}
                              className="min-h-11"
                              disabled={disabled}
                              onClick={() =>
                                updateItem(index, {
                                  followUps: item.followUps.filter(
                                    (_, currentIndex) => currentIndex !== followUpIndex,
                                  ),
                                })
                              }
                              type="button"
                              variant="ghost"
                            >
                              삭제
                            </Button>
                          </div>
                        );
                      })
                    ) : (
                      <p className="text-xs leading-5 text-stone-500">
                        필요한 경우 질문마다 최대 2개까지 추가할 수 있습니다.
                      </p>
                    )}
                  </div>
                  <div className="grid max-w-32 gap-2">
                    <Label htmlFor={`discussion-guide-minutes-${item.itemId}`}>예상 시간</Label>
                    <Input
                      className="min-h-11"
                      disabled={disabled}
                      id={`discussion-guide-minutes-${item.itemId}`}
                      max={20}
                      min={1}
                      onChange={(event) =>
                        updateItem(index, { expectedMinutes: Number(event.target.value) })
                      }
                      type="number"
                      value={item.expectedMinutes}
                    />
                  </div>
                </div>
              </div>
            </li>
          );
        })}
      </ol>
    </>
  );
}
