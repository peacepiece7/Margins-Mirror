import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import { useI18n } from '@/lib/i18n';
import type { LoginResponse } from '@/types/api/auth';
import { testAttr } from '@/utils/testAttrs';

interface AppNavigationProps {
  activeApp: 'margins' | 'memory-card';
  onLogout: () => Promise<void>;
  session: LoginResponse;
}

export function AppNavigation({ activeApp, onLogout, session }: AppNavigationProps) {
  const { t } = useI18n();
  const navigate = useNavigate();

  return (
    <nav className="flex items-center gap-1.5" aria-label="Authenticated app navigation">
      <NavigationButton
        active={activeApp === 'margins'}
        label="Margins"
        onClick={() => navigate('/')}
        testId="nav-margins"
      >
        <MarginsIcon />
      </NavigationButton>
      {session.membershipTier === 'PREMIUM' && (
        <NavigationButton
          active={activeApp === 'memory-card'}
          label="단어 카드"
          onClick={() => navigate('/memory-card/groups')}
          testId="nav-memory-card"
        >
          <CardsIcon />
        </NavigationButton>
      )}
      <Button
        aria-label={t('contactLink')}
        className="grid min-h-11 min-w-11 place-items-center"
        onClick={() => navigate('/contact')}
        title={t('contactLink')}
        type="button"
        variant="outline"
        {...testAttr('nav-contact')}
      >
        <span aria-hidden="true">?</span>
      </Button>
      <Button
        aria-label="회원정보"
        className="grid min-h-11 min-w-11 place-items-center"
        onClick={() => navigate('/account')}
        title="회원정보"
        type="button"
        variant="outline"
        {...testAttr('nav-account')}
      >
        <span aria-hidden="true">◎</span>
      </Button>
      <Button
        aria-label={t('logout')}
        className="grid min-h-11 min-w-11 place-items-center"
        onClick={() => void onLogout()}
        title={t('logout')}
        type="button"
        variant="outline"
        {...testAttr('logout-submit')}
      >
        <LogoutIcon />
      </Button>
    </nav>
  );
}

function MarginsIcon() {
  return (
    <svg aria-hidden="true" className="h-5 w-5" viewBox="0 0 24 24" fill="none">
      <path
        d="M6 4.5h12a1.5 1.5 0 0 1 1.5 1.5v13.5H7.5A3 3 0 0 1 4.5 16.5V6A1.5 1.5 0 0 1 6 4.5Z"
        stroke="currentColor"
        strokeWidth="1.7"
      />
      <path d="M8 4.5v15M11 8l2 3 2-3v7" stroke="currentColor" strokeWidth="1.7" />
    </svg>
  );
}

function CardsIcon() {
  return (
    <svg aria-hidden="true" className="h-5 w-5" viewBox="0 0 24 24" fill="none">
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
    <svg aria-hidden="true" className="h-5 w-5" viewBox="0 0 24 24" fill="none">
      <path
        d="M10 5H6.5A1.5 1.5 0 0 0 5 6.5v11A1.5 1.5 0 0 0 6.5 19H10"
        stroke="currentColor"
        strokeWidth="1.7"
      />
      <path d="M13 8l4 4-4 4M8.5 12H17" stroke="currentColor" strokeWidth="1.7" />
    </svg>
  );
}

function NavigationButton({
  active,
  children,
  label,
  onClick,
  testId,
}: {
  active: boolean;
  children: ReactNode;
  label: string;
  onClick: () => void;
  testId: string;
}) {
  return (
    <Button
      aria-label={label}
      aria-pressed={active}
      className="grid min-h-11 min-w-11 place-items-center"
      onClick={onClick}
      title={label}
      type="button"
      variant={active ? 'default' : 'outline'}
      {...testAttr(testId)}
    >
      {children}
    </Button>
  );
}
