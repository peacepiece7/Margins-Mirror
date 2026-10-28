import type { ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import { useI18n } from '@/lib/i18n';
import type { LoginResponse } from '@/types/api/auth';
import { testAttr } from '@/utils/testAttrs';

interface AppNavigationProps {
  onLogout: () => Promise<void>;
  session: LoginResponse;
}

export function AppNavigation({ onLogout, session }: AppNavigationProps) {
  const { locale, setLocale, t } = useI18n();
  const { pathname } = useLocation();
  const libraryActive =
    pathname.startsWith('/book/') &&
    !pathname.startsWith('/book/discover') &&
    !pathname.startsWith('/book/public-reviews');

  return (
    <nav className="web-global-nav" aria-label={t('pageNavigation')}>
      <div className="web-global-destinations">
        <NavigationLink
          active={libraryActive}
          label={t('pageBookList')}
          testId="nav-margins"
          to="/book/library"
        />
        <NavigationLink
          active={pathname.startsWith('/book/discover')}
          label={t('pageBookSearch')}
          testId="nav-discover"
          to="/book/discover"
        />
        <NavigationLink
          active={pathname.startsWith('/book/public-reviews')}
          label={t('pagePublicReviews')}
          testId="nav-public-reviews"
          to="/book/public-reviews"
        />
        {session.membershipTier === 'PREMIUM' && (
          <NavigationLink
            active={pathname.startsWith('/memory-card')}
            label={t('memoryCardTitle')}
            testId="nav-memory-card"
            to="/memory-card/groups"
          >
            <CardsIcon />
          </NavigationLink>
        )}
      </div>

      <div className="web-global-actions">
        <Button
          aria-label={locale === 'en' ? t('languageSwitchToKorean') : t('languageSwitchToEnglish')}
          className="web-global-language-button"
          onClick={() => setLocale(locale === 'en' ? 'ko' : 'en')}
          title={locale === 'en' ? t('languageSwitchToKorean') : t('languageSwitchToEnglish')}
          type="button"
          variant="ghost"
          {...testAttr('language-toggle')}
        >
          {locale === 'en' ? '한국어' : 'English'}
        </Button>
        <Button
          asChild
          className="web-global-icon-button"
          size="icon-sm"
          title={t('contactLink')}
          variant="ghost"
        >
          <Link aria-label={t('contactLink')} to="/contact" {...testAttr('nav-contact')}>
            <ContactIcon />
          </Link>
        </Button>
        <Button
          asChild
          className="web-global-icon-button"
          size="icon-sm"
          title={t('accountTitle')}
          variant="ghost"
        >
          <Link aria-label={t('accountTitle')} to="/account" {...testAttr('nav-account')}>
            <AccountIcon />
          </Link>
        </Button>
        <Button
          aria-label={t('logout')}
          className="web-global-icon-button"
          onClick={() => void onLogout()}
          size="icon-sm"
          title={t('logout')}
          type="button"
          variant="ghost"
          {...testAttr('logout-submit')}
        >
          <LogoutIcon />
        </Button>
      </div>
    </nav>
  );
}

function ContactIcon() {
  return (
    <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 24 24">
      <path
        d="M4.5 6.5A2.5 2.5 0 0 1 7 4h10a2.5 2.5 0 0 1 2.5 2.5v8A2.5 2.5 0 0 1 17 17H9l-4.5 3v-13.5Z"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="1.7"
      />
      <path d="m7.5 8 4.5 3 4.5-3" stroke="currentColor" strokeWidth="1.7" />
    </svg>
  );
}

function AccountIcon() {
  return (
    <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 24 24">
      <circle cx="12" cy="8" r="3.25" stroke="currentColor" strokeWidth="1.7" />
      <path
        d="M5.5 19c.7-3.3 3-5 6.5-5s5.8 1.7 6.5 5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.7"
      />
    </svg>
  );
}

function CardsIcon() {
  return (
    <svg aria-hidden="true" className="h-4 w-4" viewBox="0 0 24 24" fill="none">
      <path
        d="M7 7.5h10a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2Z"
        stroke="currentColor"
        strokeWidth="1.7"
      />
      <path d="M8.5 5.5h7M8.5 11h7M8.5 14.5h4" stroke="currentColor" strokeWidth="1.7" />
    </svg>
  );
}

function LogoutIcon() {
  return (
    <svg aria-hidden="true" className="h-4 w-4" viewBox="0 0 24 24" fill="none">
      <path
        d="M10 5H6.5A1.5 1.5 0 0 0 5 6.5v11A1.5 1.5 0 0 0 6.5 19H10"
        stroke="currentColor"
        strokeWidth="1.7"
      />
      <path d="M13 8l4 4-4 4M8.5 12H17" stroke="currentColor" strokeWidth="1.7" />
    </svg>
  );
}

function NavigationLink({
  active,
  children,
  label,
  testId,
  to,
}: {
  active: boolean;
  children?: ReactNode;
  label: string;
  testId: string;
  to: string;
}) {
  return (
    <Button asChild className="web-global-link" variant="ghost">
      <Link aria-current={active ? 'page' : undefined} to={to} {...testAttr(testId)}>
        {children}
        <span>{label}</span>
      </Link>
    </Button>
  );
}
