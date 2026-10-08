import {
  Body,
  Controller,
  Headers,
  Post,
} from "@nestjs/common";
import { LipadPaymentCallbackService } from "./lipad-payment-callback.service.js";


@Controller("payments")
export class PaymentCallbackController {
  constructor(
    private readonly callbackService:
      LipadPaymentCallbackService,
  ) { }

  @Post("callback")
  public async handleCallback(
    @Body()
    payload: unknown,

    @Headers()
    headers: Record<string, string>,
  ) {
    return this.callbackService.handle(
      payload,
      headers,
    );
  }
}