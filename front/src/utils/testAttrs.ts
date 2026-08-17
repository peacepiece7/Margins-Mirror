export function testAttr(
  name: string,
  isProduction = import.meta.env.PROD,
): Record<string, string> {
  if (isProduction) {
    return {};
  }
  return { 'data-testid': name };
}
