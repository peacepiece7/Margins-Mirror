import * as SecureStore from 'expo-secure-store';

import { secureTokenStore } from './secure-token-store';

describe('secureTokenStore', () => {
  beforeEach(() => jest.clearAllMocks());

  it('stores only the opaque refresh credential with device-only accessibility', async () => {
    await secureTokenStore.write('opaque-refresh');
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
      'margins.mobile.refresh-token',
      'opaque-refresh',
      { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY },
    );
  });

  it('reads and clears the same stable key', async () => {
    await secureTokenStore.read();
    await secureTokenStore.clear();
    expect(SecureStore.getItemAsync).toHaveBeenCalledWith('margins.mobile.refresh-token');
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('margins.mobile.refresh-token');
  });
});
