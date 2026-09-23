import { colors } from './tokens';

const STATUS_TEXT_COLORS = [colors.danger, colors.success, colors.statusReading, colors.navy];

describe('semantic color contrast', () => {
  it.each(STATUS_TEXT_COLORS)('keeps status text color %s at WCAG AA contrast on paper', (foreground) => {
    expect(contrastRatio(foreground, colors.paper)).toBeGreaterThanOrEqual(4.5);
  });
});

function contrastRatio(first: string, second: string) {
  const firstLuminance = relativeLuminance(first);
  const secondLuminance = relativeLuminance(second);
  return (Math.max(firstLuminance, secondLuminance) + 0.05)
    / (Math.min(firstLuminance, secondLuminance) + 0.05);
}

function relativeLuminance(hex: string) {
  const [red, green, blue] = hex.match(/[0-9a-f]{2}/gi)?.map((channel) => Number.parseInt(channel, 16) / 255)
    ?? [];
  return 0.2126 * linearize(red) + 0.7152 * linearize(green) + 0.0722 * linearize(blue);
}

function linearize(channel: number) {
  return channel <= 0.04045
    ? channel / 12.92
    : ((channel + 0.055) / 1.055) ** 2.4;
}
