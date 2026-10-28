import { useRef } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { LanguageToggle } from '@/components/LanguageToggle';
import { useI18n } from '@/lib/i18n';
import { testAttr } from '@/utils/testAttrs';
import { journeyStages } from '../content';
import type { JourneyStage } from '../types';
import { useLandingMotion } from '../use-landing-motion';
import { VersionStack } from './VersionStack';

export function PublicLandingPage() {
  const rootRef = useRef<HTMLElement>(null);
  useLandingMotion(rootRef);
  return (
    <main className="landing-page" ref={rootRef} {...testAttr('public-landing-page')}>
      <LandingHero />
      <LandingJourney />
      <LandingPreservation />
      <LandingFinalCallToAction />
    </main>
  );
}

function LandingHero() {
  const { locale, setLocale, t } = useI18n();
  return (
    <section className="landing-hero" aria-labelledby="landing-title">
      <div className="landing-hero-viewport">
        <div className="landing-hero-media" aria-hidden="true">
          <img
            alt=""
            className="landing-hero-art"
            decoding="async"
            data-landing-hero-sequence
            height="1280"
            src="/landing/hero-sequence/frame_001.webp"
            width="720"
          />
          <canvas
            className="landing-hero-art landing-hero-canvas"
            data-landing-hero-canvas
            height="1280"
            width="720"
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
  );
}

function LandingJourney() {
  const { t } = useI18n();
  return (
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
                <h3 className="font-display">{t(stage.titleKey)}</h3>
                <p>{t(stage.detailKey)}</p>
              </div>
              <StageVisual stage={stage} />
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

function LandingPreservation() {
  const { t } = useI18n();
  return (
    <section className="landing-preservation" id="preservation">
      <div className="landing-preservation-copy" data-landing-reveal>
        <h2 className="font-display">{t('landingPreserveTitle')}</h2>
        <p>{t('landingPreserveBody')}</p>
      </div>
      <VersionStack />
    </section>
  );
}

function LandingFinalCallToAction() {
  const { t } = useI18n();
  return (
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
        <Link to="/terms">{t('termsTitle')}</Link>
        <Link to="/privacy">{t('privacyPolicyTitle')}</Link>
      </footer>
    </section>
  );
}

function StageVisual({ stage }: { stage: JourneyStage }) {
  const { t } = useI18n();

  return (
    <figure className="landing-screen-frame">
      <div className="landing-screen-media">
        <img
          alt=""
          data-landing-screen-parallax
          decoding="async"
          height={stage.height}
          loading="lazy"
          src={stage.image}
          width={stage.width}
        />
      </div>
      <figcaption>
        {stage.number} · {t(stage.captionKey)}
      </figcaption>
    </figure>
  );
}
