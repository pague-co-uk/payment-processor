import {
  Body,
  Controller,
  Post,
} from "@nestjs/common";


import { VerifyPaymentOtpDto } from "../dto/verify-payment-otp.dto.js";
import { LipadDirectChargeOtpResponse } from "../interfaces/lipad-direct-charge.types.js";
import { LipadDirectChargeProvider } from "../lipad-direct-charge.provider.js";


@Controller("payments")
export class LipadOtpController {
  constructor(
    private readonly paymentProcessingService: LipadDirectChargeProvider,
  ) { }

  @Post("direct-charge/verify-otp")
  public async verifyDirectChargeOtp(
    @Body() dto: VerifyPaymentOtpDto,
  ): Promise<LipadDirectChargeOtpResponse> {
    return this.paymentProcessingService.verifyDirectChargeOtp(
      dto.publicId,
      dto.otp,
    );
  }
}