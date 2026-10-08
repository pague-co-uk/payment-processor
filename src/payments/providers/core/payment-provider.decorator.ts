import {
  SetMetadata,
} from "@nestjs/common";

export const PAYMENT_PROVIDER =
  Symbol(
    "PAYMENT_PROVIDER",
  );

export function PaymentProvider(
  ...codes: string[]
): ClassDecorator {
  if (
    codes.length === 0
  ) {
    throw new Error(
      "At least one payment provider code must be specified.",
    );
  }

  const normalizedCodes =
    codes.map(
      (code) =>
        code.trim().toUpperCase(),
    );

  if (
    normalizedCodes.some(
      (code) => !code,
    )
  ) {
    throw new Error(
      "Payment provider codes cannot be empty.",
    );
  }

  const uniqueCodes =
    [
      ...new Set(
        normalizedCodes,
      ),
    ];

  return SetMetadata(
    PAYMENT_PROVIDER,
    uniqueCodes,
  );
}