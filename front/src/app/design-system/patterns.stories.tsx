import { useId, useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, within } from 'storybook/test';
import { NoteForm } from '@/testing/storybook-form';
import { ConfirmExample } from '@/testing/storybook-confirm';
import { componentDocs, useStoryCopy } from '@/testing/storybook';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { MarkdownContent } from '@/components/ui/markdown-content';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { SpinnerInline } from '@/components/ui/spinner';
import { Skeleton } from '@/components/ui/skeleton';
import { BlueprintWorkspace } from '@/components/layouts/blueprint-workspace';

function AiResponse({
  state = 'partial',
}: {
  state?: 'waiting' | 'partial' | 'complete' | 'error';
}) {
  const copy = useStoryCopy();
  const id = useId();
  const [draft, setDraft] = useState('');
  const [failed, setFailed] = useState(state === 'error');
  return (
    <section className="max-w-2xl space-y-4" aria-labelledby={`${id}-title`}>
      <h1 id={`${id}-title`} className="text-xl font-semibold">
        {copy('AI 응답 표시 예제', 'AI response presentation')}
      </h1>
      <p className="text-sm text-muted-foreground">
        {copy(
          '공통 UI 조합입니다. 실제 AI나 SSE 동작을 검증하지 않습니다.',
          'A shared UI composition, not a test of a real AI or SSE connection.',
        )}
      </p>
      <Card aria-busy={state === 'waiting' || state === 'partial'}>
        <CardHeader>
          <CardTitle>{copy('기자 관점 · AI', 'Journalist perspective · AI')}</CardTitle>
          <CardDescription>
            <Badge variant="outline">
              {copy('관점과 작성자를 계속 표시', 'Keep identity visible')}
            </Badge>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {state === 'waiting' ? (
            <SpinnerInline>{copy('응답을 기다리는 중', 'Waiting for a response')}</SpinnerInline>
          ) : (
            <MarkdownContent
              value={copy(
                '**주장**을 뒷받침하는 장면은 무엇인가요?\n\n책에서 확인한 근거와 아직 남아 있는 질문을 함께 살펴봐요.',
                'Which scene supports this **claim**?\n\nExplore the evidence in the book and the questions that remain.',
              )}
            />
          )}
          {state === 'partial' && (
            <SpinnerInline>{copy('응답을 이어가는 중', 'Response in progress')}</SpinnerInline>
          )}
        </CardContent>
      </Card>
      {failed && (
        <Alert variant="destructive">
          <AlertTitle>{copy('응답을 마치지 못했습니다', 'Response could not finish')}</AlertTitle>
          <AlertDescription>
            {copy(
              '입력과 표시된 내용은 유지됩니다.',
              'Your input and displayed content have been kept.',
            )}
          </AlertDescription>
          <Button className="mt-2" onClick={() => setFailed(false)}>
            {copy('다시 시도', 'Try again')}
          </Button>
        </Alert>
      )}
      <div className="grid gap-2">
        <Label htmlFor={`${id}-draft`}>{copy('내 생각', 'My thought')}</Label>
        <Textarea
          id={`${id}-draft`}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
        />
      </div>
    </section>
  );
}
function DataState({ state = 'empty' }: { state?: 'loading' | 'empty' | 'error' | 'content' }) {
  const copy = useStoryCopy();
  const [editing, setEditing] = useState(false);
  const [currentState, setCurrentState] = useState(state);
  if (editing) return <NoteForm />;
  if (currentState === 'loading')
    return (
      <Card aria-busy="true">
        <CardContent className="space-y-3">
          <SpinnerInline>{copy('기록을 불러오는 중', 'Loading notes')}</SpinnerInline>
          <Skeleton aria-hidden="true" className="h-5 w-3/4" />
          <Skeleton aria-hidden="true" className="h-4 w-full" />
        </CardContent>
      </Card>
    );
  if (currentState === 'error')
    return (
      <Alert variant="destructive">
        <AlertTitle>{copy('기록을 불러오지 못했습니다', 'Could not load notes')}</AlertTitle>
        <AlertDescription>
          {copy(
            '현재 내용은 보존됩니다. 다시 시도해 주세요.',
            'Current content is preserved. Please try again.',
          )}
        </AlertDescription>
        <Button
          className="mt-2"
          onClick={async () => {
            setCurrentState('loading');
            await new Promise((resolve) => setTimeout(resolve, 400));
            setCurrentState('content');
          }}
        >
          {copy('다시 시도', 'Try again')}
        </Button>
      </Alert>
    );
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {currentState === 'empty'
            ? copy('아직 남긴 기록이 없어요', 'No notes yet')
            : copy('책의 여백에서', 'In the margins')}
        </CardTitle>
        <CardDescription>
          {currentState === 'empty'
            ? copy('한 문장부터 남겨보세요.', 'Start with one sentence.')
            : copy('오래 남은 생각을 다시 읽어보세요.', 'Return to a lasting thought.')}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button onClick={() => setEditing(true)}>{copy('기록 작성', 'Write a note')}</Button>
      </CardContent>
    </Card>
  );
}
function Workspace() {
  const copy = useStoryCopy();
  return (
    <BlueprintWorkspace
      header={
        <header className="margins-page-gutter py-4">
          <p className="font-display text-2xl">Margins</p>
        </header>
      }
    >
      <div className="margins-page-gutter space-y-6 pb-6">
        <h1 className="text-xl font-semibold">
          {copy('여백에 생각을 남기기', 'Leave a thought in the margins')}
        </h1>
        <NoteForm />
        <DataState state="content" />
      </div>
    </BlueprintWorkspace>
  );
}
const meta = {
  title: 'Patterns/Reading experience',
  parameters: componentDocs(
    '실제 공통 UI와 기존 workspace를 조합한 대표 사용 패턴입니다.',
    '입력 저장/재시도, 데이터 loading/empty/error/content, AI waiting/partial/complete/error, workspace.',
    '입력 이름, pending 의미, author identity와 오류 보존을 함께 확인합니다.',
    'AI는 고정 fixture 표시만 검증합니다. 실제 product state나 persistence를 재구현하지 않습니다.',
  ),
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;
export const InputSaving: Story = { render: () => <NoteForm /> };
export const InputError: Story = { render: () => <NoteForm initialInvalid /> };
export const SavingFailure: Story = { render: () => <NoteForm failFirst /> };
export const DeletionConfirmation: Story = { render: () => <ConfirmExample failFirst /> };
export const Empty: Story = { render: () => <DataState /> };
export const Loading: Story = { render: () => <DataState state="loading" /> };
export const Error: Story = {
  render: () => <DataState state="error" />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: /다시 시도|Try again/ }));
    await expect(await canvas.findByText(/불러오는 중|Loading notes/)).toBeVisible();
    await expect(await canvas.findByText(/책의 여백에서|In the margins/)).toBeVisible();
  },
};
export const Content: Story = { render: () => <DataState state="content" /> };
export const AiWaiting: Story = { render: () => <AiResponse state="waiting" /> };
export const AiPartial: Story = { render: () => <AiResponse /> };
export const AiComplete: Story = { render: () => <AiResponse state="complete" /> };
export const AiError: Story = {
  render: () => <AiResponse state="error" />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const input = canvas.getByRole('textbox');
    await userEvent.type(input, 'Preserved thought');
    await userEvent.click(canvas.getByRole('button', { name: /다시 시도|Try again/ }));
    await expect(input).toHaveValue('Preserved thought');
    await expect(canvas.getByText(/주장|claim/, { selector: 'strong' })).toBeVisible();
  },
};
export const WorkspaceComposition: Story = {
  render: () => <Workspace />,
  parameters: { layout: 'fullscreen' },
};
