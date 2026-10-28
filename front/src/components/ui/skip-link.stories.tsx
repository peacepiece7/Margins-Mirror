import { useId } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { SkipLink } from './skip-link';
import { Button } from './button';
import { componentDocs, useStoryCopy } from '@/testing/storybook';

const meta = {
  title: 'Components/Navigation/SkipLink',
  component: SkipLink,
  parameters: componentDocs(
    '반복되는 navigation을 건너뛰어 본문으로 이동합니다.',
    '숨김, keyboard focus 시 표시.',
    '첫 focus 가능한 link와 실제 main-content target을 연결합니다.',
    'target을 숨기거나 추가 focus trap을 만들지 않습니다.',
  ),
} satisfies Meta<typeof SkipLink>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: function Example(args) {
    const copy = useStoryCopy();
    const id = useId();
    return (
      <>
        <SkipLink {...args} href={`#${id}`}>
          {copy('본문으로 건너뛰기', 'Skip to main content')}
        </SkipLink>
        <nav aria-label={copy('예제 메뉴', 'Example navigation')}>
          <Button>{copy('메뉴', 'Menu')}</Button>
        </nav>
        <main id={id} tabIndex={-1} className="mt-6">
          <h1 className="text-lg">{copy('독서 기록', 'Reading notes')}</h1>
          <p>
            {copy('Tab 키로 건너뛰기 링크를 확인하세요.', 'Press Tab to reveal the skip link.')}
          </p>
        </main>
      </>
    );
  },
};
