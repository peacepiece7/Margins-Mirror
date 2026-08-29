import { useEffect, useRef, useState, type RefObject } from 'react';
import { animate, motion, useMotionValue, useTransform, type PanInfo } from 'motion/react';
import { Link } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import { LanguageToggle } from '@/components/LanguageToggle';
import { useI18n, type TranslationKey } from '@/lib/i18n';
import { testAttr } from '@/utils/testAttrs';

type JourneyStage = {
  number: string;
  titleKey: TranslationKey;
  detailKey: TranslationKey;
  statusKey: TranslationKey;
  image: string;
  width: number;
  height: number;
};

type PreserveStackItem = {
  id: string;
  src: string;
  label: string;
};

const preserveStackItems: PreserveStackItem[] = [
  { id: 'original', src: '/landing/preserve-original.webp', label: 'ORIGINAL' },
  { id: 'interview', src: '/landing/preserve-interview.webp', label: 'INTERVIEW' },
  { id: 'guide', src: '/landing/preserve-guide.webp', label: 'GUIDE' },
  { id: 'revision', src: '/landing/preserve-revision.webp', label: 'REVISION' },
];

const journeyStages: JourneyStage[] = [
  {
    number: '00',
    titleKey: 'mainPromotionFeatureDiscover',
    detailKey: 'landingStageDiscoverDetail',
    statusKey: 'landingStatusReady',
    image: '/landing/stage-discover.webp',
    width: 546,
    height: 732,
  },
  {
    number: '01',
    titleKey: 'reflectionStepReflect',
    detailKey: 'landingStageReflectDetail',
    statusKey: 'landingStatusPreserved',
    image: '/landing/stage-reflect.webp',
    width: 550,
    height: 725,
  },
  {
    number: '02',
    titleKey: 'reflectionStepInterview',
    detailKey: 'landingStageInterviewDetail',
    statusKey: 'landingStatusPrivate',
    image: '/landing/stage-interview.webp',
    width: 624,
    height: 878,
  },
  {
    number: '03',
    titleKey: 'reflectionStepGuide',
    detailKey: 'landingStageGuideDetail',
    statusKey: 'landingStatusGuided',
    image: '/landing/stage-guide.webp',
    width: 575,
    height: 826,
  },
  {
    number: '04',
    titleKey: 'reflectionStepDiscuss',
    detailKey: 'landingStageDiscussDetail',
    statusKey: 'landingStatusLive',
    image: '/landing/stage-discuss.webp',
    width: 551,
    height: 725,
  },
  {
    number: '05',
    titleKey: 'reflectionStepRefine',
    detailKey: 'landingStageRefineDetail',
    statusKey: 'landingStatusReaderChoice',
    image: '/landing/stage-refine.webp',
    width: 615,
    height: 863,
  },
];

export function PublicLandingPage() {
  const rootRef = useRef<HTMLElement>(null);
  const { locale, setLocale, t } = useI18n();

  useLandingMotion(rootRef);

  return (
    <main className="landing-page" ref={rootRef} {...testAttr('public-landing-page')}>
      <section className="landing-hero" aria-labelledby="landing-title">
        <div className="landing-hero-viewport">
          <div className="landing-hero-media" aria-hidden="true">
            <img
              alt=""
              className="landing-hero-art"
              decoding="async"
              height="1506"
              src="/landing/hero-reader.webp"
              width="1003"
            />
          </div>

          <header className="landing-header">
            <Link className="landing-wordmark font-display" to="/">
              Margins
            </Link>
            <nav className="landing-header-nav" aria-label={t('landingWorkflowLabel')}>
              <a href="#journey">{t('landingNavJourney')}</a>
              <a href="#preservation">{t('landingNavPrinciple')}</a>
            </nav>
            <div className="landing-header-actions">
              <LanguageToggle label={t('language')} locale={locale} setLocale={setLocale} />
              <Button asChild className="landing-header-login" size="lg" variant="outline">
                <Link to="/login" {...testAttr('landing-login')}>
                  {t('login')}
                </Link>
              </Button>
            </div>
          </header>

          <div className="landing-hero-copy" data-landing-reveal>
            <h1 id="landing-title" className="font-display">
              {t('mainPromotionTitle')}
            </h1>
            <p className="landing-hero-lede">{t('mainPromotionSubtitle')}</p>
            <div className="landing-hero-actions">
              <Button asChild className="landing-primary-cta" size="lg">
                <Link to="/login?mode=register" {...testAttr('landing-signup')}>
                  {t('mainPromotionCtaSignup')}
                </Link>
              </Button>
              <Button asChild className="landing-secondary-cta" size="lg" variant="outline">
                <a href="#journey">{t('landingScrollCue')} ↓</a>
              </Button>
            </div>
          </div>
        </div>
      </section>

      <section className="landing-journey" id="journey">
        <div className="landing-journey-sheet">
          <div className="landing-section landing-journey-intro">
            <div className="landing-section-heading" data-landing-reveal>
              <p className="landing-eyebrow">{t('landingJourneyEyebrow')}</p>
              <h2 className="font-display">{t('landingJourneyTitle')}</h2>
              <p>{t('landingJourneyIntro')}</p>
            </div>
          </div>

          <ol
            aria-label={t('landingWorkflowLabel')}
            className="landing-journey-list"
            {...testAttr('landing-workflow')}
          >
            {journeyStages.map((stage, index) => (
              <li
                className="landing-journey-stage"
                data-landing-reveal
                key={stage.number}
                {...testAttr(`landing-journey-stage-${index}`)}
              >
                <div className="landing-stage-copy">
                  <div className="landing-stage-meta">
                    <span>{stage.number}</span>
                    <span>{t(stage.statusKey)}</span>
                  </div>
                  <h3 className="font-display">{t(stage.titleKey)}</h3>
                  <p>{t(stage.detailKey)}</p>
                </div>
                <StageVisual stage={stage} />
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="landing-preservation" id="preservation">
        <div className="landing-preservation-copy" data-landing-reveal>
          <h2 className="font-display">{t('landingPreserveTitle')}</h2>
          <p>{t('landingPreserveBody')}</p>
        </div>
        <VersionStack />
      </section>

      <section className="landing-final-cta">
        <div className="landing-final-copy" data-landing-reveal>
          <h2 className="font-display">{t('landingFinalTitle')}</h2>
          <p>{t('landingFinalBody')}</p>
          <div className="landing-hero-actions">
            <Button asChild className="landing-primary-cta" size="lg">
              <Link to="/login?mode=register">{t('mainPromotionCtaSignup')}</Link>
            </Button>
            <Button asChild className="landing-secondary-cta" size="lg" variant="outline">
              <Link to="/login">{t('landingFinalExisting')}</Link>
            </Button>
          </div>
        </div>
        <figure className="landing-final-art" aria-hidden="true" data-landing-reveal>
          <img alt="" loading="lazy" src="/landing/final-cta.webp" />
        </figure>
        <footer>
          <span>Margins</span>
          <Link to="/privacy">{t('privacyPolicyTitle')}</Link>
        </footer>
      </section>
    </main>
  );
}

type StackExitDirection = -1 | 1;
type StackExitTrigger = 'activation' | 'swipe';
type StackPhase = 'idle' | 'exiting' | 'reordering' | 'revealing';
type StackExit = {
  cardIndex: number;
  completed: boolean;
  id: number;
  trigger: StackExitTrigger;
};

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

function previousStackIndex(index: number) {
  return (index - 1 + preserveStackItems.length) % preserveStackItems.length;
}

function useSystemPrefersReducedMotion() {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(
    () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false,
  );

  useEffect(() => {
    const media = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    if (!media) return undefined;

    const updatePreference = () => setPrefersReducedMotion(media.matches);
    updatePreference();
    media.addEventListener?.('change', updatePreference);

    return () => media.removeEventListener?.('change', updatePreference);
  }, []);

  return prefersReducedMotion;
}

function useViewportWidth() {
  const [viewportWidth, setViewportWidth] = useState(() => window.innerWidth);

  useEffect(() => {
    const updateViewportWidth = () => setViewportWidth(window.innerWidth);
    window.addEventListener('resize', updateViewportWidth);
    return () => window.removeEventListener('resize', updateViewportWidth);
  }, []);

  return viewportWidth;
}

type StackCardSurfaceProps = {
  canDrag: boolean;
  index: number;
  isResetting: boolean;
  item: PreserveStackItem;
  maxExitDistance: number;
  onDragGestureStart: () => void;
  onPointerGestureStart: () => void;
  onSwipeExitComplete: (index: number, exitId: number) => void;
  onSwipeStart: (direction: StackExitDirection, index: number) => number | undefined;
};

function StackCardSurface({
  canDrag,
  index,
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
      <img alt="" draggable={false} loading="lazy" src={item.src} />
      <span className="landing-version-card-caption" data-stack-caption>
        {item.label}
      </span>
    </motion.span>
  );
}

function VersionStack() {
  const { t } = useI18n();
  const [currentIndex, setCurrentIndex] = useState(preserveStackItems.length - 1);
  const [phase, setPhase] = useState<StackPhase>('idle');
  const [recycledIndex, setRecycledIndex] = useState<number | null>(null);
  const [exitDirection, setExitDirection] = useState<StackExitDirection>(-1);
  const [exitTrigger, setExitTrigger] = useState<StackExitTrigger>('activation');
  const systemPrefersReducedMotion = useSystemPrefersReducedMotion();
  const viewportWidth = useViewportWidth();
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
    setExitDirection(direction);
    setExitTrigger(trigger);
    setPhase('exiting');
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
    setRecycledIndex(exitedIndex);
    setCurrentIndex(previousStackIndex(exitedIndex));
    setPhase('reordering');
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
                setPhase('revealing');
                return;
              }
              if (phase === 'revealing' && isRecycled) {
                activeExitRef.current = null;
                setRecycledIndex(null);
                setPhase('idle');
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

function StageVisual({ stage }: { stage: JourneyStage }) {
  const { t } = useI18n();

  return (
    <figure className="landing-screen-frame">
      <img
        alt=""
        decoding="async"
        height={stage.height}
        loading="lazy"
        src={stage.image}
        width={stage.width}
      />
      <figcaption>
        {stage.number} · {t(stage.statusKey)}
      </figcaption>
    </figure>
  );
}

function useLandingMotion(rootRef: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return undefined;

    const revealElements = Array.from(root.querySelectorAll<HTMLElement>('[data-landing-reveal]'));
    const revealAll = () => {
      revealElements.forEach((element) => element.setAttribute('data-visible', 'true'));
    };
    const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

    if (reducedMotion) {
      root.setAttribute('data-motion', 'reduced');
      revealAll();
      return undefined;
    }

    root.setAttribute('data-motion', 'enabled');
    const observer =
      'IntersectionObserver' in window
        ? new IntersectionObserver(
            (entries, currentObserver) => {
              entries.forEach((entry) => {
                if (!entry.isIntersecting) return;
                (entry.target as HTMLElement).setAttribute('data-visible', 'true');
                currentObserver.unobserve(entry.target);
              });
            },
            { rootMargin: '0px 0px -8% 0px', threshold: 0.12 },
          )
        : undefined;

    if (observer) revealElements.forEach((element) => observer.observe(element));
    else revealAll();

    return () => {
      observer?.disconnect();
    };
  }, [rootRef]);
}
