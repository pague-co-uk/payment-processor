export type AirtelMoneyTransactionStatus =
  | "TF"
  | "TS"
  | "TA"
  | "TIP"
  | "TE";


export interface AirtelMoneyAuthRequest {
  client_id: string;
  client_secret: string;
  grant_type: "client_credentials";
}


export interface AirtelMoneyAuthResponse {
  access_token: string;
  token_type?: string;
  expires_in?: number;
}


export interface AirtelMoneyPaymentRequest {
  reference: string;

  subscriber: {
    country: string;
    currency: string;
    msisdn: string;
  };

  transaction: {
    amount: number;
    country: string;
    currency: string;
    id: string;
  };
}


export interface AirtelMoneyPaymentResponse {
  data?: {
    transaction?: {
      id?: string;
      status?: string;
    };
  };

  status?: {
    code?: string;
    message?: string;
    result_code?: string;
    response_code?: string;
    success?: boolean;
  };
}


export interface AirtelMoneyPaymentStatusResponse {
  status: {
    response_code: string;
    code: string;
    success: boolean;
    result_code: string;
    message: string;
  };

  data: {
    transaction: {
      airtel_money_id?: string;
      id: string;
      message: string;
      status: AirtelMoneyTransactionStatus;
    };
  };
}