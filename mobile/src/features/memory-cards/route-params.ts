export function positiveRouteId(value: string | string[] | undefined) {
  const candidate = Array.isArray(value) ? value[0] : value;
  if (!candidate || !/^[1-9]\d*$/.test(candidate)) return Number.NaN;
  const parsed = Number(candidate);
  return Number.isSafeInteger(parsed) ? parsed : Number.NaN;
}
