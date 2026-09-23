import { useEffect, useId } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useI18n } from '@/lib/i18n';
import type { CatalogSearchRequest } from '@/types/api/catalog';
import { testAttr } from '@/utils/testAttrs';

export function CatalogSearchForm({
  active,
  onSearch,
  onFilterChange,
}: {
  active: CatalogSearchRequest;
  onSearch: (request: CatalogSearchRequest) => void;
  onFilterChange: (request: CatalogSearchRequest) => void;
}) {
  const { t } = useI18n();
  const id = useId();
  const {
    control,
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CatalogSearchRequest>({ defaultValues: active });
  const [field, language, format] = useWatch({ control, name: ['field', 'language', 'format'] });
  useEffect(() => {
    if (
      active.query &&
      (field !== active.field || language !== active.language || format !== active.format)
    )
      onFilterChange({ ...active, field, language, format });
  }, [active, field, language, format, onFilterChange]);
  useEffect(() => {
    if (!active.query) reset(active);
  }, [active, reset]);
  return (
    <form
      className="mt-4 grid gap-3"
      onSubmit={handleSubmit(onSearch)}
      {...testAttr('book-search-form')}
    >
      <label className="text-sm font-medium" htmlFor={id}>
        {t('catalogQuery')}
      </label>
      <div className="flex gap-2">
        <Input
          className="min-h-11"
          id={id}
          placeholder={t('catalogQuery')}
          autoComplete="off"
          aria-invalid={Boolean(errors.query)}
          aria-describedby={errors.query ? id + '-error' : undefined}
          {...register('query', {
            validate: (value) =>
              (Boolean(value.trim()) && [...value.normalize('NFKC')].length <= 200) ||
              t('catalogInvalid'),
          })}
          {...testAttr('book-search-input')}
        />
        <Button className="min-h-11" type="submit" {...testAttr('book-search-submit')}>
          <Search className="size-4" aria-hidden="true" />
          {t('search')}
        </Button>
      </div>
      <div className="min-h-10 sm:min-h-5" {...testAttr('book-search-validation-slot')}>
        {errors.query && (
          <p id={id + '-error'} role="alert" className="text-sm leading-5 text-destructive">
            {errors.query.message}
          </p>
        )}
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="grid gap-1 text-xs">
          <label id={id + '-field-label'}>{t('catalogField')}</label>
          <Controller
            control={control}
            name="field"
            render={({ field: selectField }) => (
              <Select
                name={selectField.name}
                onValueChange={selectField.onChange}
                value={selectField.value}
              >
                <SelectTrigger
                  aria-labelledby={id + '-field-label'}
                  className="min-h-11 w-full"
                  onBlur={selectField.onBlur}
                  ref={selectField.ref}
                  {...testAttr('book-search-field-select')}
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">{t('catalogAll')}</SelectItem>
                  <SelectItem value="TITLE">{t('catalogTitle')}</SelectItem>
                  <SelectItem value="AUTHOR">{t('catalogAuthor')}</SelectItem>
                  <SelectItem value="ISBN">ISBN</SelectItem>
                </SelectContent>
              </Select>
            )}
          />
        </div>
        <div className="grid gap-1 text-xs">
          <label id={id + '-language-label'}>{t('catalogLanguage')}</label>
          <Controller
            control={control}
            name="language"
            render={({ field: selectField }) => (
              <Select
                name={selectField.name}
                onValueChange={selectField.onChange}
                value={selectField.value}
              >
                <SelectTrigger
                  aria-labelledby={id + '-language-label'}
                  className="min-h-11 w-full"
                  onBlur={selectField.onBlur}
                  ref={selectField.ref}
                  {...testAttr('book-search-language-select')}
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">{t('catalogAll')}</SelectItem>
                  <SelectItem value="ko">{t('catalogKorean')}</SelectItem>
                  <SelectItem value="en">{t('catalogEnglish')}</SelectItem>
                </SelectContent>
              </Select>
            )}
          />
        </div>
        <div className="grid gap-1 text-xs">
          <label id={id + '-format-label'}>{t('catalogFormat')}</label>
          <Controller
            control={control}
            name="format"
            render={({ field: selectField }) => (
              <Select
                name={selectField.name}
                onValueChange={selectField.onChange}
                value={selectField.value}
              >
                <SelectTrigger
                  aria-labelledby={id + '-format-label'}
                  className="min-h-11 w-full"
                  onBlur={selectField.onBlur}
                  ref={selectField.ref}
                  {...testAttr('book-search-format-select')}
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">{t('catalogAll')}</SelectItem>
                  <SelectItem value="PRINT">{t('catalogPrint')}</SelectItem>
                  <SelectItem value="EBOOK">{t('catalogEbook')}</SelectItem>
                  <SelectItem value="AUDIOBOOK">{t('catalogAudio')}</SelectItem>
                </SelectContent>
              </Select>
            )}
          />
        </div>
      </div>
    </form>
  );
}
