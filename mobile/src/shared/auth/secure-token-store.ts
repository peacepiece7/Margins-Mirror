import * as SecureStore from 'expo-secure-store';

const refreshTokenKey = 'margins.mobile.refresh-token';

export const secureTokenStore = {
  clear() {
    return SecureStore.deleteItemAsync(refreshTokenKey);
  },
  read() {
    return SecureStore.getItemAsync(refreshTokenKey);
  },
  write(refreshToken: string) {
    return SecureStore.setItemAsync(refreshTokenKey, refreshToken, {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
  },
};
