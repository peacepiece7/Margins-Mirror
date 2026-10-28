import { addons } from 'storybook/manager-api';
import { create } from 'storybook/theming';

addons.setConfig({
  theme: create({
    base: 'light',
    brandTitle: 'Margins · Design system',
    brandUrl: '?path=/docs/시작하기-introduction--사용-가이드',
    brandTarget: '_self',
  }),
});
