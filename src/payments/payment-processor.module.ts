import {
  Module,
} from "@nestjs/common";

import {
  DiscoveryModule,
} from "@nestjs/core";


import {
  PaymentsRepository,
} from "./repositories/payments.repository.js";

import { ConfigModule } from "../config/config.module.js";
import { QueueModule } from "../queue/queue.module.js";
import { PaymentConsumer } from "./payment-consumer.js";
import { PaymentProviderRegistry } from "./providers/core/payment-provider.registry.js";
import { AirtelMoneyClient } from "./providers/implementations/airtelmoney-mw/airtel-money-mw.client.js";
import { AirtelMoneyMapper } from "./providers/implementations/airtelmoney-mw/airtel-money-mw.mapper.js";
import { AirtelMoneyProvider } from "./providers/implementations/airtelmoney-mw/airtel-money-mw.provider.js";
import { AirtelMoneyAuthService } from "./providers/implementations/airtelmoney-mw/services/airtel-money-auth.service.js";
import { LipadPaymentCallbackService } from "./providers/implementations/lipad/callback/lipad-payment-callback.service.js";
import { PaymentCallbackController } from "./providers/implementations/lipad/callback/payment-callback.controller.js";
import { LipadOtpController } from "./providers/implementations/lipad/direct-charge/controllers/lipad-otp.controller.js";
import { LipadDirectChargeClient } from "./providers/implementations/lipad/direct-charge/lipad-direct-charge.client.js";
import { LipadDirectChargeMapper } from "./providers/implementations/lipad/direct-charge/lipad-direct-charge.mapper.js";
import { LipadDirectChargeProvider } from "./providers/implementations/lipad/direct-charge/lipad-direct-charge.provider.js";
import { LipadPaymentMapper } from "./providers/implementations/lipad/payouts/lipad-payment.mapper.js";
import { LipadPayoutsProvider } from "./providers/implementations/lipad/payouts/lipad-payouts-provider.js";
import { LipadPayoutsClient } from "./providers/implementations/lipad/payouts/lipad-payouts.client.js";
import { LipadAuthService } from "./providers/implementations/lipad/services/lipad-auth.service.js";
import { PaymentProcessingService } from "./services/payment-processing.service.js";
import {
  PaymentRoutingService,
} from "./services/payment-routing.service.js";

@Module({
  imports: [
    DiscoveryModule,
    ConfigModule,
    QueueModule
  ],

  providers: [
    PaymentsRepository,
    PaymentProviderRegistry,
    PaymentRoutingService,
    LipadPayoutsProvider,
    LipadPayoutsClient,
    LipadPaymentMapper,
    LipadAuthService,
    PaymentConsumer,
    PaymentProcessingService,
    LipadDirectChargeClient,
    LipadDirectChargeProvider,
    LipadDirectChargeMapper,
    LipadPaymentCallbackService,
    AirtelMoneyProvider,
    AirtelMoneyClient,
    AirtelMoneyMapper,
    AirtelMoneyAuthService
  ],
  controllers: [
    PaymentCallbackController,
    LipadOtpController,
  ],
  exports: [
    PaymentProviderRegistry,
    PaymentRoutingService,
  ],
})
export class PaymentsProcessorModule { }