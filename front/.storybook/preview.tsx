import type { Preview } from '@storybook/react-vite';
import { I18nProvider } from '../src/lib/i18n';
import { FlashAlertProvider } from '../src/components/ui/flash-alert';
import { TooltipProvider } from '../src/components/ui/tooltip';
import { installTurnstileFixture } from '../src/testing/storybook';
import '../src/styles/index.css';
import './preview.css';

const preview: Preview = {
  tags: ['autodocs'],
  globalTypes: {
    locale: {
      description: '예제 언어',
      toolbar: {
        icon: 'globe',
        items: [
          { value: 'ko', title: '한국어' },
          { value: 'en', title: 'English' },
        ],
        dynamicTitle: true,
      },
    },
  },
  initialGlobals: { locale: 'ko' },
  parameters: {
    layout: 'padded',
    a11y: { test: 'error' },
    controls: { expanded: true },
    viewport: {
      options: Object.fromEntries(
        [320, 390, 768, 1440].map((width) => [
          String(width),
          { name: `${width}px`, styles: { width: `${width}px`, height: '900px' } },
        ]),
      ),
    },
    options: {
      storySort: {
        order: [
          '시작하기',
          'Foundations',
          'Components',
          ['Actions', 'Forms', 'Content', 'Navigation', 'Feedback', 'Overlays', 'Integrations'],
          'Patterns',
          '유지보수 가이드',
        ],
      },
    },
  },
  beforeEach: ({ globals }) => {
    const previousLocale = localStorage.getItem('margins.locale');
    localStorage.setItem('margins.locale', globals.locale === 'en' ? 'en' : 'ko');
    document.cookie = 'margins.storybook.ai-notice=; Max-Age=0; Path=/';
    const cleanupFixture = installTurnstileFixture();
    return () => {
      cleanupFixture();
      if (previousLocale === null) localStorage.removeItem('margins.locale');
      else localStorage.setItem('margins.locale', previousLocale);
      document.cookie = 'margins.storybook.ai-notice=; Max-Age=0; Path=/';
    };
  },
  decorators: [
    (Story, context) => (
      <I18nProvider key={`${context.id}:${context.globals.locale}`}>
        <TooltipProvider>
          <FlashAlertProvider>
            <div data-ui="storybook-canvas" className="sb-sample">
              <Story />
            </div>
          </FlashAlertProvider>
        </TooltipProvider>
      </I18nProvider>
    ),
  ],
};
export default preview;
