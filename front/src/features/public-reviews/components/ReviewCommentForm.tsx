import { useForm, useWatch } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useI18n } from '@/lib/i18n';
import { testAttr } from '@/utils/testAttrs';
import type { ReviewCommentFormProps } from '../types/components';

export function ReviewCommentForm({
  kind,
  initialContent = '',
  pending,
  onSubmit,
  onCancel,
}: ReviewCommentFormProps) {
  const { t } = useI18n();
  const form = useForm({ defaultValues: { content: initialContent } });
  const content = useWatch({ control: form.control, name: 'content' });
  const disabled = pending || form.formState.isSubmitting;
  const editing = kind === 'edit';
  const selector = `public-review-${editing ? 'comment-edit' : kind}`;
  const placeholder = t(kind === 'reply' ? 'reviewReplyPlaceholder' : 'reviewCommentPlaceholder');
  const label = t(
    editing ? 'saveEdit' : kind === 'reply' ? 'reviewReplySubmit' : 'reviewCommentSubmit',
  );

  return (
    <form
      className={kind === 'comment' ? 'flex gap-2' : 'mt-2 flex gap-2'}
      onSubmit={form.handleSubmit(async ({ content }) => {
        if (!content.trim() || disabled) return;
        if (await onSubmit(content.trim())) form.reset({ content: '' });
      })}
      {...testAttr(`${selector}-form`)}
    >
      <Input
        className="min-w-0 flex-1"
        aria-label={editing ? t('saveEdit') : placeholder}
        disabled={disabled}
        placeholder={editing ? undefined : placeholder}
        {...form.register('content')}
        {...testAttr(`${selector}-input`)}
      />
      <Button
        className={kind === 'comment' ? 'px-4 py-2' : 'px-3 py-2'}
        disabled={disabled || !content.trim()}
        type="submit"
        variant="default"
        {...testAttr(`${selector}-submit`)}
      >
        {label}
      </Button>
      {onCancel && (
        <Button
          className="px-3 py-2"
          disabled={disabled}
          onClick={onCancel}
          type="button"
          variant="outline"
          {...testAttr(`${selector}-cancel`)}
        >
          {t('workbenchCancel')}
        </Button>
      )}
    </form>
  );
}
