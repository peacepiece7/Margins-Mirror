import type { SessionDisplayMessage } from './panel-types';

// Keep newest turns and reader input within the existing API's 8,000-character limit.
export function debateDeveloperDraftContext({
  draft,
  messages,
  question,
  answer,
}: {
  draft: string;
  messages: SessionDisplayMessage[];
  question?: string;
  answer?: string;
}) {
  const history = messages
    .slice(-8)
    .map((message) => `${message.role}: ${message.content.slice(-1000)}`)
    .join('\n')
    .slice(-4500);
  return [
    question ? `Source question: ${question.slice(0, 500)}` : '',
    answer ? `Saved reader answer: ${answer.slice(0, 500)}` : '',
    `Recent debate (oldest to newest):\n${history}`,
    `Current reader draft: ${draft.slice(0, 2000)}`,
    'Continue this discussion with one concise first-person reader reply, not a Persona response.',
  ]
    .filter(Boolean)
    .join('\n');
}
