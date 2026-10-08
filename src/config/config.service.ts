import {
  Injectable,
} from "@nestjs/common";

import {
  ConfigService,
} from "@nestjs/config";


@Injectable()
export class AppConfigService {
  constructor(
    private readonly config:
      ConfigService,
  ) { }


  // ===========================================================================
  // Application
  // ===========================================================================

  get app() {
    return {
      name:
        this.config.getOrThrow<string>(
          "app.name",
        ),

      version:
        this.config.getOrThrow<string>(
          "app.version",
        ),

      environment:
        this.config.getOrThrow<string>(
          "app.environment",
        ),

      host:
        this.config.getOrThrow<string>(
          "app.host",
        ),

      port:
        this.config.getOrThrow<number>(
          "app.port",
        ),
    };
  }


  // ===========================================================================
  // Database
  // ===========================================================================

  get databaseUrl(): string {
    return this.config.getOrThrow<string>(
      "database.url",
    );
  }


  // ===========================================================================
  // RabbitMQ
  // ===========================================================================

  get rabbitmq() {
    return {
      url:
        this.config.getOrThrow<string>(
          "rabbitmq.url",
        ),

      connectionName:
        this.config.getOrThrow<string>(
          "rabbitmq.connectionName",
        ),

      heartbeat:
        this.config.getOrThrow<number>(
          "rabbitmq.heartbeat",
        ),

      reconnectDelay:
        this.config.getOrThrow<number>(
          "rabbitmq.reconnectDelay",
        ),

      maxReconnectDelay:
        this.config.getOrThrow<number>(
          "rabbitmq.maxReconnectDelay",
        ),

      maxReconnectAttempts:
        this.config.get<number>(
          "rabbitmq.maxReconnectAttempts",
        ),

      autoRecover:
        this.config.getOrThrow<boolean>(
          "rabbitmq.autoRecover",
        ),

      consumerPrefetch:
        this.config.getOrThrow<number>(
          "rabbitmq.consumerPrefetch",
        ),
    };
  }


  // ===========================================================================
  // Payment Processing
  // ===========================================================================

  get payment() {
    return {
      consumerQueue:
        this.config.getOrThrow<string>(
          "payment.consumerQueue",
        ),

      processingTimeoutMs:
        this.config.getOrThrow<number>(
          "payment.processingTimeoutMs",
        ),
    };
  }


  // ===========================================================================
  // Lipad
  // ===========================================================================

  get lipad() {
    return {
      baseUrl:
        this.config.getOrThrow<string>(
          "lipad.baseUrl",
        ),

      consumerKey:
        this.config.getOrThrow<string>(
          "lipad.consumerKey",
        ),

      consumerSecret:
        this.config.getOrThrow<string>(
          "lipad.consumerSecret",
        ),

      accountNumber:
        this.config.getOrThrow<string>(
          "lipad.accountNumber",
        ),

      callbackUrl:
        this.config.getOrThrow<string>(
          "lipad.callbackUrl",
        ),

      timeoutMs:
        this.config.getOrThrow<number>(
          "lipad.timeoutMs",
        ),
    };
  }


  // ===========================================================================
  // Airtel Money
  // ===========================================================================

  get airtelMoney() {
    return {
      baseUrl:
        this.config.getOrThrow<string>(
          "airtelMoney.baseUrl",
        ),

      clientId:
        this.config.getOrThrow<string>(
          "airtelMoney.clientId",
        ),

      clientSecret:
        this.config.getOrThrow<string>(
          "airtelMoney.clientSecret",
        ),

      timeoutMs:
        this.config.getOrThrow<number>(
          "airtelMoney.timeoutMs",
        ),
    };
  }


  // ===========================================================================
  // Logging
  // ===========================================================================

  get log() {
    return {
      level:
        this.config.getOrThrow<string>(
          "log.level",
        ),

      stdout:
        this.config.getOrThrow<boolean>(
          "log.stdout",
        ),

      file: {
        enabled:
          this.config.getOrThrow<boolean>(
            "log.file.enabled",
          ),

        path:
          this.config.getOrThrow<string>(
            "log.file.path",
          ),
      },
    };
  }


  // ===========================================================================
  // OpenTelemetry
  // ===========================================================================

  get telemetry() {
    return {
      enabled:
        this.config.getOrThrow<boolean>(
          "telemetry.enabled",
        ),

      serviceName:
        this.config.getOrThrow<string>(
          "telemetry.serviceName",
        ),

      serviceVersion:
        this.config.getOrThrow<string>(
          "telemetry.serviceVersion",
        ),

      tracesEndpoint:
        this.config.getOrThrow<string>(
          "telemetry.tracesEndpoint",
        ),

      metricsEndpoint:
        this.config.getOrThrow<string>(
          "telemetry.metricsEndpoint",
        ),

      logsEndpoint:
        this.config.getOrThrow<string>(
          "telemetry.logsEndpoint",
        ),

      exportIntervalMillis:
        this.config.getOrThrow<number>(
          "telemetry.exportIntervalMillis",
        ),

      disableFsInstrumentation:
        this.config.getOrThrow<boolean>(
          "telemetry.disableFsInstrumentation",
        ),
    };
  }
}