import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { testAttr } from '@/utils/testAttrs';

import type { BookReadingStatus } from '../types';

interface BookStatusSelectProps {
  disabled?: boolean;
  onChange: (status: BookReadingStatus) => void;
  status: BookReadingStatus;
  statusLabel: (status: BookReadingStatus) => string;
  testId?: string;
}

export function BookStatusSelect({
  disabled = false,
  onChange,
  status,
  statusLabel,
  testId = 'book-status-select',
}: BookStatusSelectProps) {
  const statuses: BookReadingStatus[] = ['want_to_read', 'reading', 'read', 'dnf'];

  return (
    <Select
      disabled={disabled}
      onValueChange={(value) => onChange(value as BookReadingStatus)}
      value={status}
    >
      <SelectTrigger aria-label={statusLabel(status)} {...testAttr(testId)}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {statuses.map((value) => (
          <SelectItem key={value} value={value}>
            {statusLabel(value)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
