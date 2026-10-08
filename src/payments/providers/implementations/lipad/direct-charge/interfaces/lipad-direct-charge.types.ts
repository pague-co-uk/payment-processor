export interface LipadDirectChargeRequest {
  external_reference: string;
  client_code: string;
  origin_channel_code: string;
  originator_msisdn: string;
  payer_msisdn: string;
  payer_email: string;
  service_code: string;
  account_number: string;
  invoice_number: string;
  currency_code: string;
  amount: string;
  add_transaction_charge: boolean;
  transaction_charge: string;
  payment_method_code: string;
  extra_data: Record<string, unknown>;
  description: string;
  notify_client: boolean;
  notify_originator: boolean;
  country_code: string;
  callback_url: string;
}

export interface LipadDirectChargeResponse {
  status_code: number;
  status_description: string;
  total_amount: string;
  service_amount: string;
  transaction_charge: string;
  charge_request_id: number;
  external_reference: string;
  payment_url?: string;
  next_step?: string;
}

export interface LipadDirectChargeOtpRequest {
  reference: string;
  otp: string;
}

export interface LipadDirectChargeOtpResponse {
  status: string;
  status_description?: string;
}

export interface LipadDirectChargeStatusResponse {
  status_code: number;
  status_description: string;
  charge_request_id: number;
  external_reference: string;
  payment_status?: number;
  payment_status_description?: string;
}