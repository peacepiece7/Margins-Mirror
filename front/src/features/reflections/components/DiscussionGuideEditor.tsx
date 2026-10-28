import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useI18n } from '@/lib/i18n';
import { testAttr } from '@/utils/testAttrs';

import type { DiscussionGuideEditorProps } from '../discussion-guide-component-types';
import { guideEditMinutes, moveGuideEditItems } from '../discussion-guide-edit';
import {
  discussionGuideAudienceLabelKeys,
  discussionGuidePurposeLabelKeys,
  discussionGuideStageLabelKeys,
} from '../discussion-guide-labels';

export function DiscussionGuideEditor({
  disabled,
  draft,
  guide,
  onChange,
}: DiscussionGuideEditorProps) {
  const { t } = useI18n();
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
          <h3 className="font-semibold">{t('reflectionGuideDesignTitle')}</h3>
          <div className="flex flex-wrap justify-end gap-2">
            <Badge>{guide.depth}</Badge>
            <Badge variant="outline">
              {t('reflectionGuideRequiredCount').replace('{count}', String(requiredCount))}
            </Badge>
            {optionalCount ? (
              <Badge variant="outline">
                {t('reflectionGuideOptionalCount').replace('{count}', String(optionalCount))}
              </Badge>
            ) : null}
            <Badge variant="outline">
              {t('reflectionGuideTargetMinutes').replace('{minutes}', String(guide.targetMinutes))}
            </Badge>
            {expectedMinutes !== guide.targetMinutes ? (
              <Badge variant="outline">
                {t('reflectionGuideQuestionTotalMinutes').replace(
                  '{minutes}',
                  String(expectedMinutes),
                )}
              </Badge>
            ) : null}
          </div>
        </div>
        <div className="flex flex-wrap gap-2 text-xs text-stone-600">
          <span className="rounded bg-stone-100 px-2.5 py-1.5">
            {discussionGuidePurposeLabelKeys[guide.purpose]
              ? t(discussionGuidePurposeLabelKeys[guide.purpose])
              : guide.purpose}
          </span>
          <span className="rounded bg-stone-100 px-2.5 py-1.5">
            {discussionGuideAudienceLabelKeys[guide.audienceMode]
              ? t(discussionGuideAudienceLabelKeys[guide.audienceMode])
              : guide.audienceMode}
          </span>
          <span className="rounded bg-stone-100 px-2.5 py-1.5">
            {guide.disclosureMode === 'PRIVATE_CONTEXT'
              ? t('reflectionGuidePrivateContext')
              : t('reflectionGuidePrivateExcluded')}
          </span>
        </div>

        <div className="grid gap-2">
          <Label htmlFor="discussion-guide-goal">{t('reflectionGuideGoal')}</Label>
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
              <Label htmlFor={`discussion-guide-issue-${index + 1}`}>
                {t('reflectionGuideIssueNumber').replace('{number}', String(index + 1))}
              </Label>
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
                  {discussionGuideStageLabelKeys[item.stage]
                    ? t(discussionGuideStageLabelKeys[item.stage])
                    : item.stage}
                </span>
                <div className="mt-2 flex flex-wrap gap-1">
                  <Badge variant={item.priority === 'REQUIRED' ? 'default' : 'outline'}>
                    {item.priority === 'REQUIRED'
                      ? t('reflectionGuidePriorityRequired')
                      : t('reflectionGuidePriorityOptional')}
                  </Badge>
                  <Badge variant="outline">
                    {t('reflectionBriefMinutes').replace('{minutes}', String(item.expectedMinutes))}
                  </Badge>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-1">
                  <Button
                    aria-label={t('reflectionGuideMoveUpLabel').replace(
                      '{number}',
                      String(index + 1),
                    )}
                    className="min-h-11"
                    disabled={disabled || !canMoveUp}
                    onClick={() => moveItem(index, -1)}
                    size="sm"
                    type="button"
                    variant="outline"
                  >
                    {t('reflectionGuideMoveUp')}
                  </Button>
                  <Button
                    aria-label={t('reflectionGuideMoveDownLabel').replace(
                      '{number}',
                      String(index + 1),
                    )}
                    className="min-h-11"
                    disabled={disabled || !canMoveDown}
                    onClick={() => moveItem(index, 1)}
                    size="sm"
                    type="button"
                    variant="outline"
                  >
                    {t('reflectionGuideMoveDown')}
                  </Button>
                </div>
              </div>
              <div className="min-w-0">
                <div className="grid gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor={`discussion-guide-question-${item.itemId}`}>
                      {t('reflectionGuideQuestion')}
                    </Label>
                    <Textarea
                      disabled={disabled}
                      id={`discussion-guide-question-${item.itemId}`}
                      maxLength={1000}
                      onChange={(event) => updateItem(index, { question: event.target.value })}
                      value={item.question}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor={`discussion-guide-intent-${item.itemId}`}>
                      {t('reflectionGuideIntent')}
                    </Label>
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
                      <span className="text-sm font-medium">{t('reflectionGuideFollowUps')}</span>
                      {item.followUps.length < 2 ? (
                        <Button
                          aria-label={t('reflectionGuideFollowUpAddLabel').replace(
                            '{number}',
                            String(index + 1),
                          )}
                          className="min-h-11"
                          disabled={disabled}
                          onClick={() => updateItem(index, { followUps: [...item.followUps, ''] })}
                          size="sm"
                          type="button"
                          variant="outline"
                        >
                          {t('reflectionGuideAdd')}
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
                              <Label htmlFor={followUpId}>
                                {t('reflectionGuideFollowUpNumber').replace(
                                  '{number}',
                                  String(followUpIndex + 1),
                                )}
                              </Label>
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
                              aria-label={t('reflectionGuideFollowUpDeleteLabel')
                                .replace('{question}', String(index + 1))
                                .replace('{followUp}', String(followUpIndex + 1))}
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
                              {t('reflectionGuideDelete')}
                            </Button>
                          </div>
                        );
                      })
                    ) : (
                      <p className="text-xs leading-5 text-stone-500">
                        {t('reflectionGuideFollowUpHelp')}
                      </p>
                    )}
                  </div>
                  <div className="grid max-w-32 gap-2">
                    <Label htmlFor={`discussion-guide-minutes-${item.itemId}`}>
                      {t('reflectionGuideExpectedMinutes')}
                    </Label>
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
