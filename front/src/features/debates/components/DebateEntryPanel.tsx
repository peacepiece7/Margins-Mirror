import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useI18n } from '@/lib/i18n';
import { testAttr } from '@/utils/testAttrs';

import { localizedPersonaDisplayName } from '../display';
import {
  useCreateDebateRoomMutation,
  useDebateTimelineForBook,
  usePersonaRecommendationsQuery,
  usePersonasQuery,
} from '../queries';

export function DebateEntryPanel({ bookId }: { bookId: number }) {
  return <DebateEntry key={bookId} bookId={bookId} />;
}

function DebateEntry({ bookId }: { bookId: number }) {
  const { locale, t } = useI18n();
  const navigate = useNavigate();
  const [topic, setTopic] = useState('');
  const [selection, setSelection] = useState<number[]>();
  const personas = usePersonasQuery();
  const recommendations = usePersonaRecommendationsQuery(bookId);
  const { sessionId } = useDebateTimelineForBook(bookId);
  const createRoom = useCreateDebateRoomMutation(bookId);

  const selectedPersonaIds =
    selection ??
    (recommendations.data?.personas ?? personas.data?.personas ?? [])
      .slice(0, 2)
      .map((persona) => persona.personaId);

  const selectedPersonas = selectedPersonaIds
    .map((id) => (personas.data?.personas ?? []).find((persona) => persona.personaId === id))
    .filter((persona): persona is NonNullable<typeof persona> => Boolean(persona));

  return (
    <div
      className="rounded border border-stone-300 bg-white p-4 sm:p-5"
      data-ui="book-debate-entry"
      {...testAttr('book-debate-entry')}
    >
      <h3 className="font-semibold">{t('debateEntryTitle')}</h3>
      <p className="mt-1 text-sm text-stone-600">{t('debateEntryDescription')}</p>
      <div className="mt-4 grid gap-2" {...testAttr('debate-entry-summary')}>
        <div className="text-sm">
          <span className="block text-xs font-semibold uppercase text-stone-500">
            {t('debateParticipantCount')}
          </span>
          <span
            className="mt-1 flex flex-wrap gap-1"
            {...testAttr('debate-entry-selected-personas')}
          >
            {selectedPersonas.map((persona) => (
              <span
                className="max-w-full break-words rounded border px-2 py-1 text-xs"
                key={persona.personaId}
              >
                {localizedPersonaDisplayName(persona, locale)}
              </span>
            ))}
            {!selectedPersonas.length ? (
              <span className="text-xs text-stone-500">{t('debateNoParticipants')}</span>
            ) : null}
          </span>
        </div>
      </div>
      <details className="mt-2" {...testAttr('debate-participant-picker')}>
        <summary className="min-h-11 cursor-pointer text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2">
          {t('debateChangeParticipants')}
        </summary>
        <p className="mb-2 text-xs text-stone-500">{t('debateChooseParticipantsHelp')}</p>
        <div className="flex flex-wrap gap-2">
          {(personas.data?.personas ?? []).map((persona) => {
            const selected = selectedPersonaIds.includes(persona.personaId);
            return (
              <Button
                aria-pressed={selected}
                disabled={!selected && selectedPersonaIds.length >= 2}
                className="min-h-11 max-w-full whitespace-normal break-words"
                key={persona.personaId}
                onClick={() => {
                  setSelection(
                    selected
                      ? selectedPersonaIds.filter((id) => id !== persona.personaId)
                      : [...selectedPersonaIds, persona.personaId].slice(0, 2),
                  );
                }}
                type="button"
                variant={selected ? 'default' : 'secondary'}
                {...testAttr('debate-participant-toggle')}
              >
                {localizedPersonaDisplayName(persona, locale)}
              </Button>
            );
          })}
        </div>
      </details>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <Input
          className="min-w-0 flex-1"
          onChange={(event) => setTopic(event.target.value)}
          placeholder={t('debateTopicPlaceholder')}
          value={topic}
          {...testAttr('debate-topic-input')}
        />
        <Button
          disabled={!topic.trim() || !selectedPersonaIds.length || createRoom.isPending}
          onClick={() =>
            createRoom.mutate(
              { sessionId, topic: topic.trim(), personaIds: selectedPersonaIds },
              {
                onSuccess: ({ windowId }) => navigate(`/book/${bookId}/debate/${windowId}`),
              },
            )
          }
          type="button"
          {...testAttr('debate-enter-submit')}
        >
          {t('debateEnter')}
        </Button>
      </div>
    </div>
  );
}
