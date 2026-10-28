import type {
  ReflectionVisibility,
  RefinementMode,
  RefinementOutcome,
} from '@/types/api/reflection-loop';
import type { useReflectionSessionForBook } from '../queries';

export interface PrimaryReflectionPanelProps {
  bookId: number;
  session: ReturnType<typeof useReflectionSessionForBook>;
}

export interface PrimaryReflectionFields {
  content: string;
  visibility: ReflectionVisibility;
}

export interface ReflectionRefinePanelProps {
  bookId: number;
  runId: number;
}

export interface ReflectionRefineFields {
  content: string;
  mode: RefinementMode;
  outcome: RefinementOutcome;
}
