import { useEffect, useId, useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { BookOpen, MessageSquare, Search, Plus, Trash2 } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { componentDocs, useStoryCopy } from '@/testing/storybook';

const colors = [
  ['background', '바탕', 'Background'],
  ['card', '종이', 'Paper'],
  ['foreground', '잉크', 'Ink'],
  ['primary', '주요 행동', 'Primary action'],
  ['secondary', '보조 행동', 'Secondary action'],
  ['muted', '낮은 강조', 'Muted'],
  ['border', '경계', 'Border'],
  ['link', '링크', 'Link'],
  ['rating', '별점', 'Rating'],
  ['success-surface', '성공', 'Success'],
  ['warning-surface', '주의', 'Warning'],
  ['info-surface', '안내', 'Information'],
  ['destructive', '오류·삭제', 'Error / deletion'],
] as const;
const metrics = [
  '--radius',
  '--margins-card-padding',
  '--margins-control-gap',
  '--margins-section-gap',
  '--motion-fast',
  '--margins-paper-shadow',
  '--font-sans',
  '--font-display',
] as const;

function Foundations() {
  const copy = useStoryCopy();
  const id = useId();
  const [values, setValues] = useState<Record<string, string>>({});
  useEffect(() => {
    const styles = getComputedStyle(document.documentElement);
    setValues(
      Object.fromEntries(
        [
          ...colors.map(([token]) => '--' + token),
          ...metrics,
          ...[1, 2, 3, 4, 6, 8].map((n) => '--margins-space-' + n),
        ].map((token) => [token, styles.getPropertyValue(token).trim()]),
      ),
    );
  }, []);
  return (
    <main data-ready={Object.keys(values).length > 0} className="space-y-6">
      <header>
        <p className="text-xs uppercase tracking-widest text-muted-foreground">
          Margins / Foundations
        </p>
        <h1 className="font-display text-3xl leading-snug">
          {copy('읽는 경험을 위한 공통 언어', 'A shared language for reading')}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {copy(
            '종이의 따뜻함, 명확한 정보 위계, 예측 가능한 상호작용.',
            'Warm paper, clear hierarchy, predictable interaction.',
          )}
        </p>
      </header>
      <section aria-labelledby={`${id}-colors`}>
        <h2 id={`${id}-colors`} className="mb-4 text-lg font-semibold">
          {copy('의미 색상', 'Semantic colors')}
        </h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {colors.map(([token, ko, en]) => (
            <div key={token} className="min-w-0 space-y-1">
              <div
                className="h-14 rounded border"
                style={{ backgroundColor: `rgb(var(--${token}))` }}
              />
              <p className="text-sm font-medium">{copy(ko, en)}</p>
              <code className="block break-words text-xs">--{token}</code>
              <span className="block text-xs text-muted-foreground">{values['--' + token]}</span>
            </div>
          ))}
        </div>
      </section>
      <Card>
        <CardHeader>
          <CardTitle>{copy('타이포그래피와 정보 위계', 'Typography and hierarchy')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="font-display text-3xl">Between the lines</p>
          <h2 className="text-xl font-semibold">
            {copy('여백에 남긴 질문', 'A question in the margins')}
          </h2>
          <p className="leading-7">
            {copy(
              '책의 여백에 남겨둔 생각이 다음 대화의 시작이 됩니다. 한국어 문장과 긴 제목도 자연스럽게 읽히도록 구성합니다.',
              'A thought in the margins becomes the beginning of the next conversation. Long titles and mixed languages remain readable.',
            )}
          </p>
          <p className="text-xs text-muted-foreground">
            {copy(
              '본문 Inter · 한국어 Noto Sans KR · Display Newsreader',
              'Body Inter · Korean Noto Sans KR · Display Newsreader',
            )}
          </p>
          <p className="text-sm">
            {copy(
              '아래 크기는 실제 utility 사용 예시이며 전역 heading 크기 규칙을 새로 만들지 않습니다.',
              'These sizes demonstrate existing utilities, not new global heading rules.',
            )}
          </p>
        </CardContent>
      </Card>
      <section aria-labelledby={`${id}-spacing`}>
        <h2 id={`${id}-spacing`} className="mb-4 text-lg font-semibold">
          {copy('간격과 표면', 'Spacing and surfaces')}
        </h2>
        <div className="space-y-3">
          {[1, 2, 3, 4, 6, 8].map((n) => (
            <div className="flex items-center gap-4" key={n}>
              <div className="h-3 bg-primary" style={{ width: `var(--margins-space-${n})` }} />
              <code className="text-xs">
                --margins-space-{n} · {values['--margins-space-' + n]}
              </code>
            </div>
          ))}
        </div>
        <dl className="mt-6 grid gap-3 sm:grid-cols-2">
          {metrics.map((token) => (
            <div className="min-w-0" key={token}>
              <dt className="font-mono text-xs">{token}</dt>
              <dd className="break-words text-sm text-muted-foreground">{values[token]}</dd>
            </div>
          ))}
        </dl>
      </section>
      <section aria-labelledby={`${id}-icons`}>
        <h2 id={`${id}-icons`} className="mb-4 text-lg font-semibold">
          {copy('아이콘과 상호작용', 'Icons and interaction')}
        </h2>
        <div className="flex flex-wrap gap-2">
          {[BookOpen, MessageSquare, Search, Plus, Trash2].map((Icon, index) => (
            <Button
              key={index}
              size="icon"
              aria-label={copy(
                ['책', '대화', '검색', '추가', '삭제'][index],
                ['Book', 'Discussion', 'Search', 'Add', 'Delete'][index],
              )}
            >
              <Icon aria-hidden="true" />
            </Button>
          ))}
        </div>
        <p className="mt-4 leading-7">
          {copy(
            '키보드 focus를 숨기지 않습니다. coarse pointer는 최소 44×44px, reduced motion에서는 공통 animation을 제거합니다. 일반 텍스트 대비는 4.5:1 이상입니다.',
            'Keep keyboard focus visible. Coarse pointer controls provide at least 44×44px targets; reduced motion removes shared animations. Normal text contrast is at least 4.5:1.',
          )}
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          {copy(
            '기본 컨트롤 간격 8px · 카드 16px · 섹션 24px. 화면별 20px 섹션 간격 등 기존 surface 예외는 해당 계약을 따릅니다.',
            'Default control gap 8px · card padding 16px · section gap 24px. Existing surface exceptions, including 20px sections, retain their owning contracts.',
          )}
        </p>
      </section>
    </main>
  );
}
const meta = {
  title: 'Foundations/Overview',
  component: Foundations,
  parameters: componentDocs(
    '현재 CSS token owner의 값을 직접 읽어 디자인의 의미와 사용 기준을 보여줍니다.',
    '색상, typography, spacing, radius/shadow, icons, focus/touch/motion.',
    '색상은 이름과 값을 함께 보여주며 아이콘 버튼은 접근성 이름을 가집니다.',
    '이 표에 값을 복제하지 않습니다. 변경은 styles/tokens.css와 owning 계약에서 시작합니다.',
  ),
} satisfies Meta<typeof Foundations>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Overview: Story = {};
