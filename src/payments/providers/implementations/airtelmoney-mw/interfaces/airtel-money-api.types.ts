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
  data?: Record<string, unknown>;
  status?: Record<string, unknown>;
}