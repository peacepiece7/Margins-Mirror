import { useEffect, useId, useRef } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';
import { Controller, useForm } from 'react-hook-form';
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
import { isValidCatalogQuery } from '../catalog-search-url';
import type { CatalogSearchFormProps } from '../panel-types';
import { AppliedSearchChips } from './AppliedSearchChips';

export function CatalogSearchForm({
  active,
  onSearch,
  onFilterChange,
  onClear,
}: CatalogSearchFormProps) {
  const { t } = useI18n();
  const id = useId();
  const location = useLocation();
  const navigationType = useNavigationType();
  const {
    control,
    register,
    handleSubmit,
    reset,
    getValues,
    setError,
    clearErrors,
    formState: { errors },
  } = useForm<CatalogSearchRequest>({ defaultValues: active });
  const previousActive = useRef(active);
  const previousLocationKey = useRef(location.key);
  useEffect(() => {
    const previous = previousActive.current;
    const locationChanged = previousLocationKey.current !== location.key;
    const activeChanged =
      previous.query !== active.query ||
      previous.field !== active.field ||
      previous.language !== active.language ||
      previous.format !== active.format;
    if (!activeChanged && !locationChanged) {
      if (active.query && !isValidCatalogQuery(active.query))
        setError('query', { type: 'validate', message: t('catalogInvalid') });
      return;
    }
    const filterOnlyPush =
      navigationType === 'PUSH' &&
      locationChanged &&
      previous.query === active.query &&
      (previous.field !== active.field ||
        previous.language !== active.language ||
        previous.format !== active.format);
    const values = filterOnlyPush ? { ...active, query: getValues('query') } : active;
    reset(values);
    if (active.query && !isValidCatalogQuery(active.query))
      setError('query', { type: 'validate', message: t('catalogInvalid') });
    else clearErrors('query');
    previousActive.current = active;
    previousLocationKey.current = location.key;
  }, [active, clearErrors, getValues, location.key, navigationType, reset, setError, t]);
  const filters = [
    {
      name: 'field',
      label: t('catalogField'),
      options: [
        ['ALL', t('catalogAll')],
        ['TITLE', t('catalogTitle')],
        ['AUTHOR', t('catalogAuthor')],
        ['ISBN', 'ISBN'],
      ],
    },
    {
      name: 'language',
      label: t('catalogLanguage'),
      options: [
        ['ALL', t('catalogAll')],
        ['ko', t('catalogKorean')],
        ['en', t('catalogEnglish')],
      ],
    },
    {
      name: 'format',
      label: t('catalogFormat'),
      options: [
        ['ALL', t('catalogAll')],
        ['PRINT', t('catalogPrint')],
        ['EBOOK', t('catalogEbook')],
        ['AUDIOBOOK', t('catalogAudio')],
      ],
    },
  ] as const;

  return (
    <>
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
              validate: (value) => isValidCatalogQuery(value) || t('catalogInvalid'),
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
          {filters.map(({ name, label, options }) => (
            <div className="grid gap-1 text-xs" key={name}>
              <label id={`${id}-${name}-label`}>{label}</label>
              <Controller
                control={control}
                name={name}
                render={({ field }) => (
                  <Select
                    name={field.name}
                    value={field.value}
                    onValueChange={(value) => {
                      field.onChange(value);
                      if (active.query)
                        onFilterChange({ ...active, ...getValues(), query: active.query });
                    }}
                  >
                    <SelectTrigger
                      aria-labelledby={`${id}-${name}-label`}
                      className="min-h-11 w-full"
                      onBlur={field.onBlur}
                      ref={field.ref}
                      {...testAttr(`book-search-${name}-select`)}
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {options.map(([value, text]) => (
                        <SelectItem key={value} value={value}>
                          {text}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          ))}
        </div>
      </form>
      <div className="mt-3">
        <AppliedSearchChips
          query={active.query}
          onClear={() => {
            reset({ ...active, query: '' });
            onClear();
          }}
        />
      </div>
    </>
  );
}
