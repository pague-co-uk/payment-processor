export type LipadPayoutType =
  | "local"
  | "international";

export interface LipadLocalPayoutRequest {
  payout_reference: string;
  service_code: string;

  recipient_first_name: string;
  recipient_last_name: string;

  destination_type:
  | "MOBILE"
  | "BANK";
  destination_name: string;

  recipient_phone_number: string;
  recipient_account_number: string;
  recipient_bank_code?: string;
  recipient_account_name: string;

  source_currency: string;
  destination_currency: string;

  exchange_rate: string;

  sender_amount: string;
  sender_country_code: string;
  recipient_amount: string;

  payment_description: string;

  callback_url: string;
}

export interface LipadInternationalPayoutRequest {
  payout_reference: string;
  service_code: string;

  sender_first_name: string;
  sender_middle_name?: string;
  sender_last_name: string;
  sender_type:
  | "INDIVIDUAL"
  | "COMPANY";
  sender_document_type?: string;
  sender_document_number?: string;
  sender_country_code: string;
  sender_phone_number?: string;

  recipient_first_name?: string;
  recipient_middle_name?: string;
  recipient_last_name?: string;
  recipient_type:
  | "INDIVIDUAL"
  | "COMPANY";
  recipient_document_type?: string;
  recipient_document_number?: string;
  recipient_phone_number: string;
  recipient_account_number: string;
  recipient_account_name: string;
  recipient_occupation: string;

  destination_type:
  | "MOBILE"
  | "BANK";
  destination_name: string;
  recipient_bank_code?: string;

  source_currency: string;
  destination_currency: string;

  income_source: string;
  fund_purpose: string;

  exchange_rate: string;

  sender_amount: string;
  recipient_amount: string;

  payment_description: string;

  callback_url?: string;
}

export interface LipadPayoutResponse {
  payout_reference?: string;
  status?: string;
  message?: string;
  data?: unknown;

  [key: string]: unknown;
}