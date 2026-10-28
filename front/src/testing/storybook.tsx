import { useI18n } from '@/lib/i18n';

export function useStoryCopy() {
  const { locale } = useI18n();
  return (ko: string, en: string) => (locale === 'ko' ? ko : en);
}

export function componentDocs(
  purpose: string,
  states: string,
  accessibility: string,
  caveat: string,
) {
  return {
    docs: {
      source: { type: 'dynamic' },
      description: {
        component: `### 용도와 선택 기준
${purpose}

### 실행 예제
Canvas의 Controls에서 실제 속성을 조작하고 코드 보기에서 사용 예제를 복사합니다.

### 상태
${states}

### 콘텐츠 조건
언어 toolbar로 한국어/English를, viewport toolbar로 320·390·768·1440px를 확인합니다. 긴 콘텐츠 예제는 상태 목록에서 선택합니다.

### 접근성
${accessibility}

### 사용 주의점
${caveat}`,
      },
    },
  };
}

// The actual widget still owns its lifecycle. Only the external SDK is replaced.
let turnstileFixture: { users: number; restore: () => void } | undefined;

export function installTurnstileFixture() {
  if (turnstileFixture) {
    turnstileFixture.users += 1;
    return releaseTurnstileFixture;
  }
  const previous = window.turnstile;
  const widgets = new Map<
    string,
    {
      container: HTMLElement;
      options: Parameters<NonNullable<typeof window.turnstile>['render']>[1];
    }
  >();
  let sequence = 0;
  const handleState = (event: Event) => {
    const state = (event as CustomEvent<string>).detail;
    if (!(event.target instanceof HTMLElement)) return;
    for (const { container, options } of widgets.values()) {
      if (!event.target.contains(container)) continue;
      if (state === 'expired') options['expired-callback']();
      else if (state === 'error') options['error-callback']();
      else if (state === 'ready') options.callback('local-fixture-token');
    }
  };
  window.turnstile = {
    render(container, options) {
      const id = `fixture-${++sequence}`;
      widgets.set(id, { container, options });
      container.textContent = 'Turnstile · local SDK fixture';
      return id;
    },
    reset() {
      /* Controlled by the story, never by a network service. */
    },
    remove(id) {
      const widget = widgets.get(id);
      if (widget) widget.container.textContent = '';
      widgets.delete(id);
    },
  };
  window.addEventListener('storybook:turnstile', handleState);
  turnstileFixture = {
    users: 1,
    restore: () => {
      window.removeEventListener('storybook:turnstile', handleState);
      widgets.clear();
      window.turnstile = previous;
    },
  };
  return releaseTurnstileFixture;
}

function releaseTurnstileFixture() {
  if (!turnstileFixture || --turnstileFixture.users > 0) return;
  turnstileFixture.restore();
  turnstileFixture = undefined;
}
