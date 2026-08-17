import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';

export function LanguageToggle({
  label,
  locale,
  setLocale,
}: {
  label: string;
  locale: 'en' | 'ko';
  setLocale: (locale: 'en' | 'ko') => void;
}) {
  return (
    <ToggleGroup
      className="inline-grid grid-cols-2 rounded border border-border bg-background p-0.5"
      aria-label={label}
      onValueChange={(value) => {
        if (value === 'en' || value === 'ko') setLocale(value);
      }}
      type="single"
      value={locale}
    >
      {(['en', 'ko'] as const).map((option) => (
        <ToggleGroupItem
          className="min-h-7 min-w-9 rounded px-2 text-xs font-semibold"
          key={option}
          value={option}
        >
          {option.toUpperCase()}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}
