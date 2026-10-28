import type { Meta, StoryObj } from '@storybook/react-vite';
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbSeparator,
  BreadcrumbPage,
} from './breadcrumb';
import { componentDocs, useStoryCopy } from '@/testing/storybook';
const meta = {
  title: 'Components/Navigation/Breadcrumb',
  component: Breadcrumb,
  parameters: componentDocs(
    '현재 위치와 상위 문맥을 표시합니다. 실제 route 구성은 app이 소유합니다.',
    '상위 link, 현재 page, 긴 제목.',
    '현재 page는 aria-current를 유지하고 navigation 이름을 제공합니다.',
    'route URL을 공용 UI가 결정하지 않습니다. 좁은 화면에서 자연스럽게 줄바꿈합니다.',
  ),
} satisfies Meta<typeof Breadcrumb>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {
  render: function Example(args) {
    const copy = useStoryCopy();
    return (
      <Breadcrumb {...args} aria-label={copy('현재 위치', 'Current location')}>
        <BreadcrumbList>
          <BreadcrumbItem>
            <a href="#library">{copy('서재', 'Library')}</a>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{copy('책 상세', 'Book details')}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
    );
  },
};
