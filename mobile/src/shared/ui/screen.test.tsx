import { screenHorizontalPadding } from './screen';

// BDD: PROJ-035 then-1/then-2
it.each([
  [320, 16],
  [360, 16],
  [390, 16],
  [412, 16],
  [479, 16],
  [480, 20],
  [768, 20],
  [1023, 20],
  [1024, 24],
])('uses the contracted horizontal gutter at %ipx', (width, expected) => {
  expect(screenHorizontalPadding(width)).toBe(expected);
});
