import { useMemo } from 'react';

import { Button } from '@/components/ui/button';
import { MarkdownContent } from '@/components/ui/markdown-content';
import { Textarea } from '@/components/ui/textarea';
import { SpeechDraftControl } from '@/components/speech-draft-control';
import { debateTopicFromWindowTitle, localizedPersonaDisplayName, personaIcon } from '../display';
import type { SessionDisplayMessage } from '../panel-types';
import { useI18n } from '@/lib/i18n';
import { testAttr } from '@/utils/testAttrs';

import type { DebatePageProps } from '../panel-types';
import { DebateReplySkeleton } from './DebateReplySkeleton';
import { ModerationEventCard } from './ModerationEventCard';

const EMPTY_MODERATION_EVENTS: NonNullable<DebatePageProps['moderationEvents']> = [];
const noopModerationFeedback = () => undefined;

function messageName(message: SessionDisplayMessage, userLabel: string, personaLabel?: string) {
  if (message.role === 'user') return userLabel;
  return personaLabel || message.personaDisplayName || 'AI';
}

export function DebatePage({
  draft: debateDraft,
  loading,
  messages: activeMessages,
  moderationEvents = EMPTY_MODERATION_EVENTS,
  personas,
  selectedPersonas: selectedDebatePersonas,
  showReplySkeleton: showDebateReplySkeleton,
  sourceAnswer: sourceDebateAnswer,
  sourceQuestion: sourceDebateQuestion,
  topic: debateTopic,
  window: currentWindow,
  onAllReplies: requestAllPersonaReplies,
  onDraftChange: setDebateDraft,
  onPersonaReply: requestPersonaReply,
  onModerationFeedback = noopModerationFeedback,
  onSubmit: submitDebate,
}: DebatePageProps) {
  const { locale, t } = useI18n();
  const timelineItems = useMemo(
    () =>
      [
        ...activeMessages.map((message, index) => ({
          kind: 'message' as const,
          createdAt: message.createdAt,
          index,
          message,
        })),
        ...moderationEvents.map((event, index) => ({
          kind: 'moderation' as const,
          createdAt: event.createdAt,
          index: activeMessages.length + index,
          event,
        })),
      ].sort((left, right) => {
        const timeDifference = Date.parse(left.createdAt ?? '') - Date.parse(right.createdAt ?? '');
        return Number.isNaN(timeDifference) || timeDifference === 0
          ? left.index - right.index
          : timeDifference;
      }),
    [activeMessages, moderationEvents],
  );

  return (
    <section className="grid gap-5" {...testAttr('debate-page')}>
      {sourceDebateQuestion && (
        <aside
          className="rounded border border-stone-300 bg-stone-50 p-4"
          {...testAttr('debate-source-context')}
        >
          <div className="text-xs font-semibold uppercase text-stone-500">
            {t('questionDebateContext')}
          </div>
          <div className="mt-1 font-medium leading-6">{sourceDebateQuestion.questionText}</div>
          {sourceDebateAnswer && (
            <MarkdownContent
              className="mt-3 border-t border-stone-200 pt-3 text-sm leading-6 text-stone-700"
              preserveLineBreaks
              value={sourceDebateAnswer.content}
            />
          )}
        </aside>
      )}
      <div
        className="grid min-h-[620px] grid-rows-[auto_auto_1fr_auto] overflow-hidden rounded border border-stone-300 bg-white"
        {...testAttr('debate-chat-panel')}
      >
        <div className="border-b border-stone-200 px-4 py-4 sm:px-5">
          <h2 className="text-xl font-semibold">{t('debate')}</h2>
          <p className="mt-1 text-sm text-stone-600">
            {currentWindow?.windowType === 'debate'
              ? debateTopicFromWindowTitle(currentWindow.title)
              : t('debateRoomFallback')}
          </p>
        </div>

        <div
          className="flex gap-2 overflow-x-auto border-b border-stone-200 px-4 py-3 sm:px-5"
          {...testAttr('debate-speaker-strip')}
        >
          {selectedDebatePersonas.map((persona) => (
            <Button
              className="grid h-auto min-h-24 min-w-24 content-center justify-items-center gap-1 whitespace-normal rounded border border-stone-200 bg-stone-50 px-3 py-2 text-center text-xs leading-tight hover:border-stone-950 disabled:opacity-50"
              disabled={
                currentWindow?.windowType !== 'debate' ||
                loading ||
                !(debateDraft.trim() || debateTopic.trim())
              }
              key={persona.personaId}
              onClick={() => requestPersonaReply(persona.personaId)}
              type="button"
              {...testAttr('debate-speaker-reply')}
            >
              <span
                className="grid h-9 w-9 place-items-center rounded-full bg-stone-900 text-base text-white"
                aria-hidden="true"
              >
                {personaIcon(persona)}
              </span>
              <span className="font-medium">{localizedPersonaDisplayName(persona, locale)}</span>
              <span className="text-stone-500">{t('debateSpeakerReply')}</span>
            </Button>
          ))}
        </div>

        <div
          className="grid content-start gap-4 overflow-y-auto bg-stone-100 px-4 py-4 sm:px-5 sm:py-5"
          {...testAttr('debate-message-list')}
        >
          {timelineItems.map((item) => {
            if (item.kind === 'moderation') {
              return (
                <ModerationEventCard
                  event={item.event}
                  key={`moderation-${item.event.eventId}`}
                  onFeedback={onModerationFeedback}
                />
              );
            }
            const message = item.message;
            const isUser = message.role === 'user';
            const persona = personas.find((item) => item.personaId === message.personaId);
            const personaLabel = message.personaId
              ? localizedPersonaDisplayName(
                  persona || {
                    displayName: message.personaDisplayName || '',
                    name: '',
                  },
                  locale,
                )
              : undefined;
            return (
              <article
                className={`flex gap-3 ${isUser ? 'justify-end' : 'justify-start'}`}
                key={message.id}
              >
                {!isUser && (
                  <div
                    className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-stone-950 text-sm font-semibold text-white"
                    aria-hidden="true"
                  >
                    {message.personaId ? personaIcon(persona) : 'AI'}
                  </div>
                )}
                <div className={`max-w-[78%] ${isUser ? 'items-end' : 'items-start'} grid gap-1`}>
                  <div
                    className={`text-xs font-medium ${isUser ? 'text-right text-stone-500' : 'text-stone-600'}`}
                  >
                    {messageName(message, t('userMessageName'), personaLabel)}
                  </div>
                  <div
                    className={`rounded-2xl px-4 py-3 text-sm leading-6 shadow-sm ${isUser ? 'rounded-br-sm bg-stone-950 text-white' : 'rounded-bl-sm bg-white text-stone-900'}`}
                  >
                    {isUser ? (
                      <div className="whitespace-break-spaces break-words">{message.content}</div>
                    ) : (
                      <MarkdownContent
                        className="whitespace-break-spaces break-words"
                        preserveLineBreaks
                        value={message.content}
                      />
                    )}
                  </div>
                </div>
              </article>
            );
          })}
          {showDebateReplySkeleton && <DebateReplySkeleton />}
          {!showDebateReplySkeleton && !timelineItems.length && (
            <div className="self-center rounded bg-white px-4 py-3 text-center text-sm text-stone-500">
              {t('debateEmpty')}
            </div>
          )}
        </div>

        <form
          className="grid gap-3 border-t border-stone-200 bg-white p-4"
          onSubmit={submitDebate}
          {...testAttr('debate-session-form')}
        >
          <Textarea
            className="min-h-20 rounded border border-stone-300 px-3 py-2 text-sm"
            onChange={(event) => setDebateDraft(event.target.value)}
            placeholder={t('debatePlaceholder')}
            value={debateDraft}
            {...testAttr('debate-session-message-input')}
          />
          <SpeechDraftControl
            disabled={loading || currentWindow?.windowType !== 'debate'}
            label="debate-session-message"
            onChange={setDebateDraft}
            value={debateDraft}
          />
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-xs text-stone-500">
              {t('debateParticipantCount')} {selectedDebatePersonas.length}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                className="rounded border border-stone-950 px-4 py-2 text-sm font-medium disabled:opacity-50"
                disabled={
                  currentWindow?.windowType !== 'debate' ||
                  !selectedDebatePersonas.length ||
                  loading ||
                  !(debateDraft.trim() || debateTopic.trim())
                }
                onClick={requestAllPersonaReplies}
                type="button"
                {...testAttr('debate-all-submit')}
              >
                {t('debateAllReply')}
              </Button>
              <Button
                className="rounded bg-stone-950 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                disabled={
                  currentWindow?.windowType !== 'debate' ||
                  !selectedDebatePersonas.length ||
                  loading ||
                  !(debateDraft.trim() || debateTopic.trim())
                }
                type="submit"
                {...testAttr('debate-session-submit')}
              >
                {t('debateSpeakerReply')}
              </Button>
            </div>
          </div>
        </form>
      </div>
    </section>
  );
}
