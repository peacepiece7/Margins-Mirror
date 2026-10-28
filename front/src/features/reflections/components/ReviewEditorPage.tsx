import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import { SpeechDraftControl } from '@/components/speech-draft-control';
import { ReflectionMarkdownEditor } from './ReflectionMarkdownEditor';
import { markdownToPlainText } from '../markdown';
import { useI18n } from '@/lib/i18n';
import { testAttr } from '@/utils/testAttrs';

import type { ReviewEditorPageProps } from '../panel-types';

export function ReviewEditorPage({
  authorName,
  content,
  evidence,
  isEditing,
  loading,
  reviewedOn,
  visibility,
  developerDraftControl,
  onAuthorNameChange,
  onCancel,
  onContentChange,
  onEvidenceChange,
  onReviewedOnChange,
  onSubmit,
  onVisibilityChange,
}: ReviewEditorPageProps) {
  const { t } = useI18n();

  return (
    <section className="grid gap-6" {...testAttr('review-editor-page')}>
      <form
        className="grid min-h-[calc(100vh-220px)] gap-4 rounded border border-stone-300 bg-white p-4 sm:p-5"
        onSubmit={onSubmit}
        {...testAttr('reflection-form')}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-semibold">
            {isEditing ? t('reviewEditTitle') : t('reviewCreateTitle')}
          </h2>
          <div className="flex flex-wrap gap-2">
            <Button
              className="px-4 py-2"
              onClick={onCancel}
              type="button"
              variant="outline"
              {...testAttr('reflection-cancel')}
            >
              {t('workbenchCancel')}
            </Button>
            <Button
              className="px-4 py-2"
              disabled={loading || !markdownToPlainText(content)}
              type="submit"
              variant="default"
              {...testAttr('reflection-submit')}
            >
              {isEditing ? t('saveEdit') : t('saveRecord')}
            </Button>
          </div>
        </div>
        {developerDraftControl}
        <div
          className="grid min-h-[62vh] gap-3 rounded border border-stone-300 bg-stone-100 p-4"
          {...testAttr('reflection-editor-shell')}
        >
          <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_180px_170px_150px]">
            <Input
              className="min-w-0 rounded border border-stone-200 bg-white px-4 py-3 text-sm outline-none focus:border-stone-500"
              onChange={(event) => onEvidenceChange(event.target.value)}
              placeholder={t('reviewEvidencePlaceholder')}
              value={evidence}
              {...testAttr('reflection-evidence-input')}
            />
            <Input
              className="min-w-0 rounded border border-stone-200 bg-white px-4 py-3 text-sm outline-none focus:border-stone-500"
              maxLength={80}
              onChange={(event) => onAuthorNameChange(event.target.value)}
              placeholder={t('reviewAuthorPlaceholder')}
              value={authorName}
              {...testAttr('reflection-author-input')}
            />
            <Input
              aria-label={t('reviewDateLabel')}
              className="min-w-0 rounded border border-stone-200 bg-white px-4 py-3 text-sm outline-none focus:border-stone-500"
              onChange={(event) => onReviewedOnChange(event.target.value)}
              type="date"
              value={reviewedOn}
              {...testAttr('reflection-date-input')}
            />
            <NativeSelect
              className="h-8 min-w-0 rounded border border-stone-200 bg-white px-4 py-1 text-sm leading-5 outline-none focus:border-stone-500"
              onChange={(event) =>
                onVisibilityChange(event.target.value === 'PUBLIC' ? 'PUBLIC' : 'PRIVATE')
              }
              value={visibility}
              {...testAttr('reflection-visibility-select')}
            >
              <option value="PRIVATE">{t('reviewVisibilityPrivate')}</option>
              <option value="PUBLIC">{t('reviewVisibilityPublic')}</option>
            </NativeSelect>
          </div>
          <div
            className="reflection-markdown-shell min-h-[54vh] rounded border border-stone-200 bg-white shadow-sm"
            {...testAttr('reflection-content-input')}
          >
            <ReflectionMarkdownEditor
              onChange={onContentChange}
              placeholder={t('reviewPlaceholder')}
              textareaTestId="reflection-content-textarea"
              value={content}
            />
          </div>
          <div className="flex justify-end">
            <SpeechDraftControl
              disabled={loading}
              label="reflection-content"
              onChange={onContentChange}
              value={content}
            />
          </div>
        </div>
      </form>
    </section>
  );
}
