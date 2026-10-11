import { Body, Controller, Headers, Post } from "@nestjs/common";
import { AirtelMoneyPaymentCallbackService } from "./airtel-money-payment-callback.service.js";

@Controller("payments/callback/airtelmw")
export class AirtelMoneyPaymentCallbackController {
  constructor(
    private readonly callbackService: AirtelMoneyPaymentCallbackService,
  ) { }

  @Post()
  public async handleCallback(
    @Body() payload: unknown,
    @Headers() headers: Record<string, string>,
  ) {
    return this.callbackService.handle(payload, headers);
  }
}