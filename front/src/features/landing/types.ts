import type { TranslationKey } from '@/lib/i18n';
export type JourneyStage = {
  number: string;
  titleKey: TranslationKey;
  detailKey: TranslationKey;
  captionKey: TranslationKey;
  image: string;
  width: number;
  height: number;
};

export type PreserveStackItem = {
  id: string;
  src: string;
  label: string;
};

export type StackExitDirection = -1 | 1;
export type StackExitTrigger = 'activation' | 'swipe';
export type StackPhase = 'idle' | 'exiting' | 'reordering' | 'revealing';
export type StackExit = {
  cardIndex: number;
  completed: boolean;
  id: number;
  trigger: StackExitTrigger;
};

export type StackCardSurfaceProps = {
  canDrag: boolean;
  index: number;
  isFront: boolean;
  isResetting: boolean;
  item: PreserveStackItem;
  maxExitDistance: number;
  onDragGestureStart: () => void;
  onPointerGestureStart: () => void;
  onSwipeExitComplete: (index: number, exitId: number) => void;
  onSwipeStart: (direction: StackExitDirection, index: number) => number | undefined;
};

export type StackState = {
  currentIndex: number;
  phase: StackPhase;
  recycledIndex: number | null;
  exitDirection: StackExitDirection;
  exitTrigger: StackExitTrigger;
};
