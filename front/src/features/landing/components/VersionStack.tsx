import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { animate, motion, useMotionValue, useTransform, type PanInfo } from 'motion/react';
import { Button } from '@/components/ui/button';
import { useI18n } from '@/lib/i18n';
import { testAttr } from '@/utils/testAttrs';
import { preserveStackItems } from '../content';
import type {
  StackState,
  StackCardSurfaceProps,
  StackExit,
  StackExitDirection,
  StackExitTrigger,
} from '../types';
const STACK_OFFSET_PX = 14;
const STACK_SCALE_STEP = 0.045;
const STACK_MAX_EXIT_VIEWPORT_RATIO = 0.2;
const STACK_ACTIVATION_LIFT_OFFSET_RATIO = 0.25;
const STACK_SWIPE_DISTANCE_PX = 90;
const STACK_SWIPE_DISTANCE_RATIO = 0.5;
const STACK_SWIPE_VELOCITY_PX = 600;

function stackSwipeDirection(
  { offset, velocity }: PanInfo,
  maxExitDistance: number,
): StackExitDirection | undefined {
  const distanceThreshold = Math.min(
    STACK_SWIPE_DISTANCE_PX,
    maxExitDistance * STACK_SWIPE_DISTANCE_RATIO,
  );
  if (Math.abs(offset.x) < distanceThreshold && Math.abs(velocity.x) < STACK_SWIPE_VELOCITY_PX) {
    return undefined;
  }

  return (offset.x || velocity.x) < 0 ? -1 : 1;
}

function subscribeMotionPreference(notify: () => void) {
  const media = window.matchMedia?.('(prefers-reduced-motion: reduce)');
  media?.addEventListener?.('change', notify);
  return () => media?.removeEventListener?.('change', notify);
}
function subscribeViewport(notify: () => void) {
  window.addEventListener('resize', notify);
  return () => window.removeEventListener('resize', notify);
}
const readMotionPreference = () =>
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
const readViewport = () => window.innerWidth;

function StackCardSurface({
  canDrag,
  index,
  isFront,
  isResetting,
  item,
  maxExitDistance,
  onDragGestureStart,
  onPointerGestureStart,
  onSwipeExitComplete,
  onSwipeStart,
}: StackCardSurfaceProps) {
  const dragX = useMotionValue(0);
  const dragRotate = useTransform(dragX, [-maxExitDistance, 0, maxExitDistance], [-10, 0, 10]);
  const dragOpacity = useTransform(dragX, [-maxExitDistance, 0, maxExitDistance], [0, 1, 0]);
  const dragAnimationRef = useRef<ReturnType<typeof animate> | null>(null);

  useEffect(() => {
    if (!isResetting) return;

    dragAnimationRef.current?.stop();
    dragAnimationRef.current = null;
    dragX.set(0);
  }, [dragX, isResetting]);

  useEffect(
    () => () => {
      dragAnimationRef.current?.stop();
    },
    [],
  );

  const handleDragEnd = (_event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    const direction = stackSwipeDirection(info, maxExitDistance);
    if (!direction) {
      dragAnimationRef.current = animate(dragX, 0, {
        type: 'spring',
        stiffness: 320,
        damping: 28,
      });
      return;
    }

    const exitId = onSwipeStart(direction, index);
    if (exitId === undefined) {
      dragX.set(0);
      return;
    }

    dragAnimationRef.current = animate(dragX, direction * maxExitDistance, {
      type: 'tween',
      duration: 0.42,
      ease: 'easeIn',
      onComplete: () => {
        dragAnimationRef.current = null;
        onSwipeExitComplete(index, exitId);
      },
    });
  };

  return (
    <motion.span
      className="landing-version-card-surface"
      drag={canDrag ? 'x' : false}
      dragConstraints={{ left: -maxExitDistance, right: maxExitDistance }}
      dragElastic={0}
      dragMomentum={false}
      onDragEnd={handleDragEnd}
      onDragStart={() => {
        dragAnimationRef.current?.stop();
        dragAnimationRef.current = null;
        onDragGestureStart();
      }}
      onPointerDown={onPointerGestureStart}
      style={{ x: dragX, rotate: dragRotate, opacity: dragOpacity }}
      whileDrag={{ scale: 1.018 }}
    >
      <img alt="" draggable={false} loading={isFront ? 'eager' : 'lazy'} src={item.src} />
      <span className="landing-version-card-caption" data-stack-caption>
        {item.label}
      </span>
    </motion.span>
  );
}

export function VersionStack() {
  const { t } = useI18n();
  const [stack, setStack] = useState<StackState>({
    currentIndex: preserveStackItems.length - 1,
    phase: 'idle',
    recycledIndex: null,
    exitDirection: -1,
    exitTrigger: 'activation',
  });
  const { currentIndex, phase, recycledIndex, exitDirection, exitTrigger } = stack;
  const systemPrefersReducedMotion = useSyncExternalStore(
    subscribeMotionPreference,
    readMotionPreference,
  );
  const viewportWidth = useSyncExternalStore(subscribeViewport, readViewport);
  const activeExitRef = useRef<StackExit | null>(null);
  const nextExitIdRef = useRef(0);
  const suppressClickRef = useRef(false);
  const isAnimating = phase !== 'idle';
  const maxExitDistance = Math.max(1, viewportWidth * STACK_MAX_EXIT_VIEWPORT_RATIO);

  const cycle = (
    direction: StackExitDirection = -1,
    trigger: StackExitTrigger = 'activation',
    cardIndex = currentIndex,
  ) => {
    if (phase !== 'idle' || activeExitRef.current) return undefined;

    const exitId = ++nextExitIdRef.current;
    activeExitRef.current = { cardIndex, completed: false, id: exitId, trigger };
    setStack((current) => ({
      ...current,
      exitDirection: direction,
      exitTrigger: trigger,
      phase: 'exiting',
    }));
    return exitId;
  };

  const handleClick = () => {
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      return;
    }
    cycle();
  };

  const completeExit = (exitedIndex: number, trigger: StackExitTrigger, exitId?: number) => {
    const activeExit = activeExitRef.current;
    if (
      !activeExit ||
      activeExit.completed ||
      activeExit.cardIndex !== exitedIndex ||
      activeExit.trigger !== trigger ||
      (exitId !== undefined && activeExit.id !== exitId)
    ) {
      return;
    }

    activeExit.completed = true;
    setStack((current) => ({
      ...current,
      recycledIndex: exitedIndex,
      currentIndex: (exitedIndex - 1 + preserveStackItems.length) % preserveStackItems.length,
      phase: 'reordering',
    }));
  };

  return (
    <Button
      aria-busy={isAnimating ? 'true' : 'false'}
      aria-disabled={isAnimating}
      aria-label={t('landingPreserveCycleLabel')}
      className="landing-version-stack"
      data-landing-reveal
      data-reduced-motion={systemPrefersReducedMotion ? 'true' : 'false'}
      data-stack-motion="interactive"
      data-stack-phase={phase}
      onClick={handleClick}
      onKeyDown={() => {
        suppressClickRef.current = false;
      }}
      type="button"
      variant="ghost"
      {...testAttr('landing-version-stack')}
    >
      {preserveStackItems.map((item, index) => {
        const visualIndex =
          (currentIndex - index + preserveStackItems.length) % preserveStackItems.length;
        const isFront = visualIndex === 0;
        const isRecycled = index === recycledIndex;
        const isResetting = phase === 'reordering' && isRecycled;
        const isVisible = visualIndex < 4;
        const isClickExiting = isFront && phase === 'exiting' && exitTrigger === 'activation';

        return (
          <motion.span
            className="landing-version-card"
            animate={
              isClickExiting
                ? {
                    x: [
                      null,
                      exitDirection * maxExitDistance * STACK_ACTIVATION_LIFT_OFFSET_RATIO,
                      exitDirection * maxExitDistance,
                    ],
                    y: [null, -18, -56],
                    rotate: [null, exitDirection * 3.5, exitDirection * 13],
                    scale: [null, 1.015, 0.94],
                    opacity: [null, 1, 0],
                  }
                : {
                    x: visualIndex * STACK_OFFSET_PX,
                    y: visualIndex * STACK_OFFSET_PX,
                    rotate: visualIndex === 0 ? 0 : visualIndex % 2 === 0 ? -1.5 : 1.5,
                    scale: 1 - visualIndex * STACK_SCALE_STEP,
                    opacity: isResetting ? 0 : isVisible ? 1 : 0,
                  }
            }
            data-stack-front={isFront ? '' : undefined}
            data-stack-visual-index={visualIndex}
            initial={false}
            key={item.id}
            onAnimationComplete={() => {
              if (phase === 'exiting' && exitTrigger === 'activation' && index === currentIndex) {
                completeExit(index, 'activation');
                return;
              }
              if (phase === 'reordering' && isFront) {
                setStack((current) => ({ ...current, phase: 'revealing' }));
                return;
              }
              if (phase === 'revealing' && isRecycled) {
                activeExitRef.current = null;
                setStack((current) => ({ ...current, recycledIndex: null, phase: 'idle' }));
              }
            }}
            style={{
              zIndex: preserveStackItems.length - visualIndex,
            }}
            transition={
              isClickExiting
                ? {
                    type: 'tween',
                    duration: 0.58,
                    times: [0, 0.3, 1],
                    ease: ['easeOut', 'easeIn'],
                  }
                : isResetting
                  ? { duration: 0 }
                  : phase === 'revealing' && isRecycled
                    ? { duration: 0.16, ease: 'easeOut' }
                    : {
                        type: 'spring',
                        stiffness: 360,
                        damping: 30,
                        mass: 0.75,
                        restDelta: 0.1,
                        restSpeed: 2,
                      }
            }
          >
            <StackCardSurface
              canDrag={isFront && phase === 'idle'}
              index={index}
              isFront={isFront}
              isResetting={isResetting}
              item={item}
              maxExitDistance={maxExitDistance}
              onDragGestureStart={() => {
                suppressClickRef.current = true;
              }}
              onPointerGestureStart={() => {
                suppressClickRef.current = false;
              }}
              onSwipeExitComplete={(cardIndex, exitId) => completeExit(cardIndex, 'swipe', exitId)}
              onSwipeStart={(direction, cardIndex) => cycle(direction, 'swipe', cardIndex)}
            />
          </motion.span>
        );
      })}
    </Button>
  );
}
