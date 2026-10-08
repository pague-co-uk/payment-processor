export const LIPAD_PAYOUT_TYPES = {
  LOCAL: "local",
  INTERNATIONAL: "international",
} as const;

export type LipadPayoutType =
  (typeof LIPAD_PAYOUT_TYPES)[keyof typeof LIPAD_PAYOUT_TYPES];