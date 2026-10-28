import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import { Plus, Search, Trash2 } from 'lucide-react';
import { Button } from './button';
import { componentDocs, useStoryCopy } from '@/testing/storybook';

const meta = {
  title: 'Components/Actions/Button',
  component: Button,
  args: { onClick: fn() },
  argTypes: {
    variant: {
      control: 'select',
      options: ['default', 'secondary', 'outline', 'ghost', 'destructive', 'link'],
    },
    size: {
      control: 'select',
      options: ['default', 'xs', 'sm', 'lg', 'icon', 'icon-xs', 'icon-sm', 'icon-lg'],
    },
    children: { control: 'text' },
  },
  parameters: componentDocs(
    '행동을 실행합니다. 가장 중요한 행동은 variant="default", 일반 행동은 기본 secondary를 사용합니다.',
    '모든 variant/size, disabled, loading, icon, asChild link.',
    '아이콘만 있는 버튼은 aria-label을 제공합니다. pending은 disabled와 aria-busy로 표시됩니다.',
    'asChild는 하나의 element만 받습니다. 링크의 pending 문구는 caller가 렌더링합니다.',
  ),
} satisfies Meta<typeof Button>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: function Example(args) {
    const copy = useStoryCopy();
    return <Button {...args}>{args.children ?? copy('기록 추가', 'Add note')}</Button>;
  },
};
export const Primary: Story = { ...Default, args: { variant: 'default' } };
export const LongLabel: Story = {
  ...Default,
  args: {
    className: 'h-auto max-w-md whitespace-normal text-left',
    children: '긴 한국어 행동 문구 / A long action label that wraps in a narrow viewport',
  },
};
export const IconSizes: Story = {
  render: function Example() {
    const copy = useStoryCopy();
    return (
      <div className="flex flex-wrap items-center gap-2">
        {(['icon-xs', 'icon-sm', 'icon', 'icon-lg'] as const).map((size) => (
          <Button key={size} size={size} aria-label={copy('검색', 'Search') + ' · ' + size}>
            <Search aria-hidden="true" />
          </Button>
        ))}
      </div>
    );
  },
};
export const Disabled: Story = {
  ...Default,
  args: { disabled: true },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('button')).toBeDisabled();
    await expect(args.onClick).not.toHaveBeenCalled();
  },
};
export const Loading: Story = {
  ...Default,
  args: { loading: true },
  play: async ({ canvasElement }) => {
    const button = within(canvasElement).getByRole('button');
    await expect(button).toBeDisabled();
    await expect(button).toHaveAttribute('aria-busy', 'true');
  },
};
export const Icon: Story = {
  render: function Example(args) {
    const copy = useStoryCopy();
    return (
      <Button {...args} size="icon" aria-label={copy('검색', 'Search')}>
        <Search aria-hidden="true" />
      </Button>
    );
  },
};
export const AsLink: Story = {
  render: function Example(args) {
    const copy = useStoryCopy();
    return (
      <Button {...args} asChild>
        <a href="#story-destination">{copy('기록 보기', 'View notes')}</a>
      </Button>
    );
  },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('link')).toHaveAttribute(
      'href',
      '#story-destination',
    );
  },
};
export const DisabledLink: Story = {
  ...AsLink,
  args: { disabled: true },
  play: async ({ canvasElement, args }) => {
    const link = within(canvasElement).getByRole('link');
    await expect(link).toHaveAttribute('aria-disabled', 'true');
    await expect(link).toHaveAttribute('tabindex', '-1');
    await userEvent.click(link, { pointerEventsCheck: 0 });
    await expect(args.onClick).not.toHaveBeenCalled();
  },
};
export const Variants: Story = {
  render: function Example() {
    const copy = useStoryCopy();
    return (
      <div className="grid gap-6">
        <div className="flex flex-wrap gap-2">
          {(['default', 'secondary', 'outline', 'ghost', 'destructive', 'link'] as const).map(
            (variant) => (
              <Button key={variant} variant={variant}>
                {variant === 'destructive' ? (
                  <Trash2 aria-hidden="true" />
                ) : (
                  <Plus aria-hidden="true" />
                )}
                {variant}
              </Button>
            ),
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {(['xs', 'sm', 'default', 'lg'] as const).map((size) => (
            <Button size={size} key={size}>
              {size}
            </Button>
          ))}
          <Button disabled>{copy('사용 불가', 'Unavailable')}</Button>
          <Button loading loadingLabel={copy('저장 중', 'Saving')}>
            {copy('저장', 'Save')}
          </Button>
          <Button size="icon" aria-label={copy('검색', 'Search')}>
            <Search aria-hidden="true" />
          </Button>
        </div>
      </div>
    );
  },
};
