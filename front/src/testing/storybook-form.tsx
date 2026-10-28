import { useId, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { Form } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useStoryCopy } from './storybook';

export function NoteForm({
  initialInvalid = false,
  failFirst = false,
}: {
  initialInvalid?: boolean;
  failFirst?: boolean;
}) {
  const copy = useStoryCopy();
  const id = useId();
  const form = useForm<{ title: string; note: string }>({ defaultValues: { title: '', note: '' } });
  const [savedTitle, setSavedTitle] = useState<string | undefined>();
  const [failed, setFailed] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const currentTitle = useWatch({ control: form.control, name: 'title' });
  const invalid = Boolean(form.formState.errors.title) || (initialInvalid && !currentTitle);
  return (
    <Card className="max-w-lg">
      <CardHeader>
        <CardTitle>{copy('기록 작성', 'Write a note')}</CardTitle>
      </CardHeader>
      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(async ({ title }) => {
            setSavedTitle(undefined);
            setFailed(false);
            setAttempts((n) => n + 1);
            await new Promise((resolve) => setTimeout(resolve, 400));
            if (failFirst && attempts === 0) {
              setFailed(true);
              return;
            }
            setSavedTitle(title);
          })}
        >
          <CardContent className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor={`${id}-title`}>{copy('제목 (필수)', 'Title (required)')}</Label>
              <Input
                id={`${id}-title`}
                aria-invalid={invalid}
                aria-describedby={`${id}-title-help`}
                {...form.register('title', { validate: (value) => Boolean(value.trim()) })}
              />
              <p
                id={`${id}-title-help`}
                className={invalid ? 'text-sm text-destructive' : 'text-sm text-muted-foreground'}
                role={invalid ? 'alert' : undefined}
              >
                {invalid
                  ? copy('제목을 입력해 주세요.', 'Enter a title.')
                  : copy(
                      '기억하고 싶은 한 문장을 남겨보세요.',
                      'Leave a sentence you want to remember.',
                    )}
              </p>
            </div>
            <div className="grid gap-2">
              <Label htmlFor={`${id}-body`}>{copy('내용', 'Note')}</Label>
              <Textarea id={`${id}-body`} {...form.register('note')} />
            </div>
            {failed && (
              <Alert variant="destructive">
                <AlertDescription>
                  {copy(
                    '저장하지 못했습니다. 입력 내용은 유지됩니다.',
                    'Saving failed. Your input has been kept.',
                  )}
                </AlertDescription>
              </Alert>
            )}
            {savedTitle !== undefined && (
              <Alert variant="success" role="status">
                <AlertDescription>
                  {copy('저장 완료', 'Saved')} · {savedTitle}
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
          <CardFooter className="mt-4 flex-wrap justify-between gap-2">
            <span className="text-xs text-muted-foreground">
              {copy('서버에 저장되지 않는 예제입니다.', 'This example does not save to a server.')}
            </span>
            <Button
              type="submit"
              variant="default"
              loading={form.formState.isSubmitting}
              loadingLabel={copy('저장 중', 'Saving')}
            >
              {copy('저장하기', 'Save note')}
            </Button>
          </CardFooter>
        </form>
      </Form>
    </Card>
  );
}
