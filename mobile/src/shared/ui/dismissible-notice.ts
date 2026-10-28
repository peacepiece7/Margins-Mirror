import AsyncStorage from '@react-native-async-storage/async-storage';

const aiNoticeKey = 'margins.ai-processing-notice.hidden-until';
const sevenDaysInMilliseconds = 7 * 24 * 60 * 60 * 1_000;

export async function dismissAiNoticeForSevenDays(now = Date.now()) {
  await AsyncStorage.setItem(aiNoticeKey, String(now + sevenDaysInMilliseconds));
}

export async function isAiNoticeDismissed(now = Date.now()) {
  const stored = await AsyncStorage.getItem(aiNoticeKey);
  const hiddenUntil = Number(stored);
  if (!Number.isFinite(hiddenUntil) || hiddenUntil <= now) {
    if (stored !== null) await AsyncStorage.removeItem(aiNoticeKey);
    return false;
  }
  return true;
}

export async function resetAiNoticeDismissal() {
  await AsyncStorage.removeItem(aiNoticeKey);
}
