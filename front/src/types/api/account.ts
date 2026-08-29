export interface Account {
  userId: number;
  username: string;
  displayName: string;
  email: string;
  authProvider: string;
  accountStatus: 'ACTIVE' | 'RESIGNED' | 'PURGED';
  preferredLocale: 'ko' | 'en';
}

export interface ProfileResult {
  account: Account;
}

export interface AccountChallenge {
  challengeId: string;
  expiresInSeconds: number;
  devVerificationCode?: string;
}

export interface ActionToken {
  actionToken: string;
  expiresInSeconds: number;
}
