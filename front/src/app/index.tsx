import { AppProvider } from './provider';
import { AppDownloadNotice } from './app-download-notice';
import { AppRouter } from './router';

export function App() {
  return (
    <AppProvider>
      <AppDownloadNotice />
      <AppRouter />
    </AppProvider>
  );
}
