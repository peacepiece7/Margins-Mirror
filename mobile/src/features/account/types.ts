export type Account = {
  userId: number;
  username: string;
  displayName: string;
  email: string;
  authProvider: string;
  accountStatus: "ACTIVE" | "RESIGNED" | "PURGED";
  preferredLocale: "ko" | "en";
};

export type ProfileResult = { account: Account };
export type AccountChallenge = {
  challengeId: string;
  expiresInSeconds: number;
  devVerificationCode?: string;
};
export type ActionToken = { actionToken: string; expiresInSeconds: number };
export type RecoveryAction = "RESTORE" | "ERASE_ALL_ACTIVITY";
export type ResignationReason =
  | "NOT_USING"
  | "MISSING_FEATURES"
  | "TOO_MANY_ERRORS"
  | "PRIVACY_CONCERNS"
  | "OTHER";
