import { useEffect, type RefObject } from 'react';
const landingScreenParallaxDistance = 24;
const heroFrameCount = 72;
const heroExitEnd = 0.14;
const heroZoomEnd = 0.28;
const heroPreloadConcurrency = 4;
const clampProgress = (value: number) => Math.min(1, Math.max(0, value));
const heroFramePath = (frame: number) =>
  `/landing/hero-sequence/frame_${String(frame).padStart(3, '0')}.webp`;

type HeroFramePlayer = {
  show: (frame: number) => void;
  dispose: () => void;
};

/**
 * Paints decoded frames into one canvas so a frame swap never waits on an `<img>` re-decode.
 * Every frame is fetched once in the background, nearest to the requested frame first, and the
 * closest decoded frame stays on screen until the requested one is ready.
 */
function createHeroFramePlayer(canvas: HTMLCanvasElement): HeroFramePlayer {
  const frames = new Array<HTMLImageElement | undefined>(heroFrameCount + 1);
  const ready = new Array<boolean>(heroFrameCount + 1).fill(false);
  const requested = new Set<number>();
  let context: CanvasRenderingContext2D | null | undefined;
  let targetFrame = 1;
  let paintedFrame = 0;
  let inFlight = 0;
  let disposed = false;

  const paint = () => {
    if (disposed) return;
    let frame = targetFrame;
    for (let distance = 0; distance < heroFrameCount; distance += 1) {
      if (ready[targetFrame - distance]) {
        frame = targetFrame - distance;
        break;
      }
      if (ready[targetFrame + distance]) {
        frame = targetFrame + distance;
        break;
      }
    }
    const image = frames[frame];
    if (!ready[frame] || !image || frame === paintedFrame) return;
    context ??= canvas.getContext('2d', { alpha: false });
    if (!context) return;
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    paintedFrame = frame;
    canvas.dataset.frame = String(frame);
    canvas.setAttribute('data-ready', 'true');
  };
  const nextUnrequestedFrame = () => {
    for (let distance = 0; distance < heroFrameCount; distance += 1) {
      for (const frame of [targetFrame + distance, targetFrame - distance]) {
        if (frame >= 1 && frame <= heroFrameCount && !requested.has(frame)) return frame;
      }
    }
    return undefined;
  };
  const pump = () => {
    while (!disposed && inFlight < heroPreloadConcurrency) {
      const frame = nextUnrequestedFrame();
      if (frame === undefined) return;
      requested.add(frame);
      inFlight += 1;
      const image = new Image();
      image.decoding = 'async';
      if ('fetchPriority' in image) image.fetchPriority = frame === targetFrame ? 'high' : 'low';
      frames[frame] = image;
      const settle = (loaded: boolean) => {
        inFlight -= 1;
        if (disposed) return;
        ready[frame] = loaded;
        if (!loaded) frames[frame] = undefined;
        paint();
        pump();
      };
      image.addEventListener(
        'load',
        () => {
          const decoded = image.decode?.();
          if (decoded) decoded.then(() => settle(true)).catch(() => settle(false));
          else settle(true);
        },
        { once: true },
      );
      image.addEventListener('error', () => settle(false), { once: true });
      image.src = heroFramePath(frame);
    }
  };

  return {
    show(frame) {
      if (disposed) return;
      targetFrame = frame;
      paint();
      pump();
    },
    dispose() {
      disposed = true;
      frames.fill(undefined);
    },
  };
}

export function useLandingMotion(rootRef: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return undefined;

    const revealElements = Array.from(root.querySelectorAll<HTMLElement>('[data-landing-reveal]'));
    const parallaxImages = Array.from(
      root.querySelectorAll<HTMLElement>('[data-landing-screen-parallax]'),
    );
    const hero = root.querySelector<HTMLElement>('.landing-hero');
    const heroExitTargets = Array.from(
      root.querySelectorAll<HTMLElement>('.landing-header, .landing-hero-copy'),
    );
    const heroMedia = root.querySelector<HTMLElement>('.landing-hero-media');
    const heroSequence = root.querySelector<HTMLImageElement>('[data-landing-hero-sequence]');
    const heroCanvas = root.querySelector<HTMLCanvasElement>('[data-landing-hero-canvas]');
    let heroPlayer: HeroFramePlayer | undefined;
    const revealAll = () => {
      revealElements.forEach((element) => element.setAttribute('data-visible', 'true'));
    };
    const reducedMotionQuery = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    let reducedMotion = reducedMotionQuery?.matches ?? false;

    if (reducedMotion) {
      root.setAttribute('data-motion', 'reduced');
      revealAll();
    } else {
      root.setAttribute('data-motion', 'enabled');
    }

    const observer =
      !reducedMotion && 'IntersectionObserver' in window
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
    else if (!reducedMotion) revealAll();

    // Only frames near the viewport pay for a layout read on each scroll frame.
    const parallaxFrames = parallaxImages.flatMap((image) =>
      image.parentElement ? [{ image, frame: image.parentElement, offset: '' }] : [],
    );
    const activeParallaxFrames = new Set(parallaxFrames);
    const parallaxObserver =
      'IntersectionObserver' in window
        ? new IntersectionObserver(
            (entries) => {
              entries.forEach((entry) => {
                const item = parallaxFrames.find(({ frame }) => frame === entry.target);
                if (!item) return;
                if (entry.isIntersecting) activeParallaxFrames.add(item);
                else activeParallaxFrames.delete(item);
              });
              scheduleParallax();
            },
            { rootMargin: '25% 0px' },
          )
        : undefined;

    let motionFrame: number | undefined;
    let parallaxListening = false;
    let heroRange = 1;
    let heroExitValue = '';
    let heroZoomValue = '';
    const measure = () => {
      heroRange = hero ? Math.max(1, hero.offsetHeight - window.innerHeight) : 1;
    };
    const resetParallax = () => {
      parallaxFrames.forEach((item) => {
        item.offset = '';
        item.image.style.removeProperty('--landing-screen-parallax-y');
      });
    };
    const resetHero = () => {
      heroExitValue = '';
      heroZoomValue = '';
      heroExitTargets.forEach((target) =>
        target.style.removeProperty('--landing-hero-exit-progress'),
      );
      heroMedia?.style.removeProperty('--landing-hero-zoom-progress');
    };
    const updateParallax = () => {
      motionFrame = undefined;
      const viewportHeight = window.innerHeight;

      // Read every geometry value before writing styles so a frame never forces a second layout.
      const heroTop = hero?.getBoundingClientRect().top ?? 0;
      const parallaxBounds = Array.from(activeParallaxFrames, (item) => ({
        item,
        bounds: item.frame.getBoundingClientRect(),
      }));

      if (hero) {
        const progress = clampProgress(-heroTop / heroRange);
        const exitProgress = clampProgress(progress / heroExitEnd).toFixed(4);
        const zoomProgress = clampProgress(
          (progress - heroExitEnd) / (heroZoomEnd - heroExitEnd),
        ).toFixed(4);
        const sequenceProgress = clampProgress((progress - heroZoomEnd) / (1 - heroZoomEnd));
        heroPlayer?.show(Math.round(sequenceProgress * (heroFrameCount - 1)) + 1);
        if (exitProgress !== heroExitValue) {
          heroExitValue = exitProgress;
          heroExitTargets.forEach((target) =>
            target.style.setProperty('--landing-hero-exit-progress', exitProgress),
          );
        }
        if (zoomProgress !== heroZoomValue) {
          heroZoomValue = zoomProgress;
          heroMedia?.style.setProperty('--landing-hero-zoom-progress', zoomProgress);
        }
      }

      parallaxBounds.forEach(({ item, bounds }) => {
        const travelProgress = Math.min(
          1,
          Math.max(0, (viewportHeight - bounds.top) / (viewportHeight + bounds.height)),
        );
        const offset = `${(landingScreenParallaxDistance * (1 - travelProgress * 2)).toFixed(2)}px`;
        if (offset === item.offset) return;
        item.offset = offset;
        item.image.style.setProperty('--landing-screen-parallax-y', offset);
      });
    };
    function scheduleParallax() {
      if (!parallaxListening || motionFrame !== undefined) return;
      motionFrame = window.requestAnimationFrame(updateParallax);
    }
    const syncParallax = () => {
      const shouldListen = !reducedMotion;
      if (shouldListen) measure();
      else if (heroSequence) heroSequence.src = heroFramePath(heroFrameCount);
      if (shouldListen === parallaxListening) {
        if (shouldListen) scheduleParallax();
        return;
      }

      parallaxListening = shouldListen;
      if (shouldListen) {
        if (heroSequence && !heroSequence.src.endsWith(heroFramePath(1)))
          heroSequence.src = heroFramePath(1);
        if (heroCanvas) heroPlayer ??= createHeroFramePlayer(heroCanvas);
        parallaxFrames.forEach(({ frame }) => parallaxObserver?.observe(frame));
        window.addEventListener('scroll', scheduleParallax, { passive: true });
        scheduleParallax();
      } else {
        window.removeEventListener('scroll', scheduleParallax);
        parallaxObserver?.disconnect();
        if (motionFrame !== undefined) window.cancelAnimationFrame(motionFrame);
        motionFrame = undefined;
        heroPlayer?.dispose();
        heroPlayer = undefined;
        heroCanvas?.removeAttribute('data-ready');
        resetParallax();
        resetHero();
      }
    };
    const syncMotionPreference = () => {
      reducedMotion = reducedMotionQuery?.matches ?? false;
      root.setAttribute('data-motion', reducedMotion ? 'reduced' : 'enabled');
      if (reducedMotion) {
        revealAll();
        observer?.disconnect();
      }
      syncParallax();
    };

    window.addEventListener('resize', syncParallax, { passive: true });
    reducedMotionQuery?.addEventListener?.('change', syncMotionPreference);
    syncParallax();

    return () => {
      observer?.disconnect();
      parallaxObserver?.disconnect();
      window.removeEventListener('resize', syncParallax);
      reducedMotionQuery?.removeEventListener?.('change', syncMotionPreference);
      if (parallaxListening) window.removeEventListener('scroll', scheduleParallax);
      if (motionFrame !== undefined) window.cancelAnimationFrame(motionFrame);
      heroPlayer?.dispose();
      resetParallax();
      resetHero();
    };
  }, [rootRef]);
}
