import { useMutation } from '@tanstack/react-query';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { developerDebugEnabled } from '@/lib/feature-flags';
import { useI18n } from '@/lib/i18n';
import type {
  DeveloperReflectionDraftInput,
  DeveloperReflectionDraftResponse,
} from '@/types/api/reflection-loop';
import { testAttr } from '@/utils/testAttrs';

export type DeveloperDraftControlProps = DeveloperReflectionDraftInput & {
  disabled?: boolean;
  draftKey: string | number;
  generate: (input: DeveloperReflectionDraftInput) => Promise<DeveloperReflectionDraftResponse>;
  onGenerated: (content: string) => void;
};

export function DeveloperDraftControl({ draftKey, ...props }: DeveloperDraftControlProps) {
  if (!developerDebugEnabled) return null;
  return (
    <EnabledDeveloperDraftControl
      key={JSON.stringify([props.bookId, props.target, draftKey])}
      {...props}
    />
  );
}

function EnabledDeveloperDraftControl({
  bookId,
  context,
  disabled = false,
  generate,
  onGenerated,
  subject,
  target,
}: Omit<DeveloperDraftControlProps, 'draftKey'>) {
  const { t } = useI18n();
  const draft = useMutation({
    mutationFn: () =>
      generate({
        bookId,
        context: context?.slice(0, 8000),
        subject: subject?.slice(0, 2000),
        target,
      }),
  });

  return (
    <div
      className="grid min-w-0 gap-2 rounded border border-dashed border-border bg-muted/30 p-3"
      data-ui="developer-draft-control"
    >
      <div className="flex flex-wrap items-center gap-2">
        <Button
          disabled={disabled || draft.isPending}
          onClick={() =>
            // Per-call callbacks are discarded when this editor identity unmounts.
            draft.mutate(undefined, { onSuccess: (result) => onGenerated(result.content) })
          }
          size="sm"
          type="button"
          variant="outline"
          {...testAttr('developer-draft-generate')}
        >
          {draft.isPending
            ? t('developerDraftPending')
            : draft.data
              ? t('developerDraftRegenerate')
              : t('developerDraftGenerate')}
        </Button>
        {draft.data ? (
          <div aria-label={t('developerDraftMetadata')} className="flex min-w-0 flex-wrap gap-1.5">
            <Badge variant="secondary">{draft.data.model}</Badge>
            {draft.data.personas.map((persona) => (
              <Badge
                className="max-w-full whitespace-normal break-words"
                key={persona.personaId}
                variant="outline"
              >
                {persona.displayName}
              </Badge>
            ))}
          </div>
        ) : null}
      </div>
      <p className="text-xs leading-5 text-muted-foreground">{t('developerDraftDescription')}</p>
      {draft.isError ? (
        <Alert role="alert" variant="destructive">
          <AlertTitle>{t('developerDraftErrorTitle')}</AlertTitle>
          <AlertDescription>{t('developerDraftErrorDescription')}</AlertDescription>
        </Alert>
      ) : null}
    </div>
  );
}
