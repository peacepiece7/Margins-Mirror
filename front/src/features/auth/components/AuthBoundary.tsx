import { Navigate } from 'react-router-dom';
import { useI18n } from '@/lib/i18n';
import { testAttr } from '@/utils/testAttrs';
import { useAuthForm } from '../use-auth-form';
import type { AuthBoundaryProps } from '../types';
import { AuthenticationForm } from './AuthenticationForm';
import { AuthenticatedQueryProvider } from './AuthenticatedQueryProvider';

export function AuthBoundary({ authenticated, publicRoot }: AuthBoundaryProps) {
  const auth = useAuthForm();
  const { t } = useI18n();
  if (auth.authSession) {
    return (
      <AuthenticatedQueryProvider key={auth.authSession.userId} session={auth.authSession}>
        {authenticated({ logout: auth.logout, session: auth.authSession })}
      </AuthenticatedQueryProvider>
    );
  }
  if (!auth.authBootstrapped) {
    return (
      <main
        className="margins-page-gutter grid min-h-screen place-items-center text-sm text-stone-600"
        {...testAttr('auth-bootstrap')}
      >
        {t('editorLoading')}
      </main>
    );
  }
  if (auth.location.pathname === '/') return publicRoot;
  if (auth.location.pathname !== '/login') return <Navigate replace to="/login" />;
  return <AuthenticationForm {...auth.formView} />;
}
