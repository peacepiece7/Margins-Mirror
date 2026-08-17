import { Badge } from '@/components/ui/badge';
import { testAttr } from '@/utils/testAttrs';

export function StudyProgress({ label }: { label: string }) {
  return (
    <Badge variant="info" {...testAttr('memory-card-study-progress')}>
      {label}
    </Badge>
  );
}
