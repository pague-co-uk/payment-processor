import {
  Module,
} from "@nestjs/common";

import {
  ConfigModule,
} from "./config/config.module.js";

import {
  DatabaseModule,
} from "./database/database.module.js";

import {
  HealthModule,
} from "./health/health.module.js";


import { PaymentsProcessorModule } from "./payments/payment-processor.module.js";
import {
  QueueModule,
} from "./queue/queue.module.js";

@Module({
  imports: [
    ConfigModule,
    QueueModule,
    DatabaseModule,
    HealthModule,
    PaymentsProcessorModule
  ],

  controllers: [],

  providers: [],
})
export class AppModule { }