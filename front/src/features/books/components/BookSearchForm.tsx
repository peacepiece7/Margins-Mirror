import { useEffect } from 'react';
import { useForm, useWatch } from 'react-hook-form';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useI18n } from '@/lib/i18n';
import { testAttr } from '@/utils/testAttrs';

export function BookSearchForm({
  activeQuery,
  loading,
  onSearch,
}: {
  activeQuery: string;
  loading: boolean;
  onSearch: (query: string) => void;
}) {
  const { t } = useI18n();
  const form = useForm<{ query: string }>({ defaultValues: { query: '' } });
  const query = useWatch({ control: form.control, name: 'query', defaultValue: '' });

  useEffect(() => {
    if (!activeQuery) form.reset({ query: '' });
  }, [activeQuery, form]);

  return (
    <form
      className="mt-4 flex gap-2"
      onSubmit={form.handleSubmit(({ query }) => onSearch(query.trim()))}
      {...testAttr('book-search-form')}
    >
      <Input
        className="min-w-0 flex-1"
        placeholder={t('searchPlaceholder')}
        {...form.register('query', { required: true })}
        {...testAttr('book-search-input')}
      />
      <Button
        disabled={loading || !query.trim()}
        loading={loading}
        loadingLabel={t('loadingSearch')}
        type="submit"
        {...testAttr('book-search-submit')}
      >
        {t('search')}
      </Button>
    </form>
  );
}
