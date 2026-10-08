export default () => ({
  // ===========================================================================
  // Application
  // ===========================================================================

  app: {
    name:
      process.env.APP_NAME ??
      "pague-payments-processor",

    version:
      process.env.APP_VERSION ??
      "1.0.0",

    environment:
      process.env.NODE_ENV ??
      "development",

    host:
      process.env.APP_HOST ??
      "0.0.0.0",

    port:
      Number.parseInt(
        process.env.APP_PORT ??
        "9002",
        10,
      ),
  },


  // ===========================================================================
  // Database
  // ===========================================================================

  database: {
    url:
      process.env.DATABASE_URL!,
  },


  // ===========================================================================
  // RabbitMQ
  // ===========================================================================

  rabbitmq: {
    url:
      process.env.RABBITMQ_URL!,

    connectionName:
      process.env.RABBITMQ_CONNECTION_NAME ??
      "pague-payments-processor",

    heartbeat:
      Number.parseInt(
        process.env.RABBITMQ_HEARTBEAT ??
        "60",
        10,
      ),

    reconnectDelay:
      Number.parseInt(
        process.env.RABBITMQ_RECONNECT_DELAY ??
        "1000",
        10,
      ),

    maxReconnectDelay:
      Number.parseInt(
        process.env.RABBITMQ_MAX_RECONNECT_DELAY ??
        "30000",
        10,
      ),

    maxReconnectAttempts:
      process.env.RABBITMQ_MAX_RECONNECT_ATTEMPTS
        ? Number.parseInt(
          process.env.RABBITMQ_MAX_RECONNECT_ATTEMPTS,
          10,
        )
        : undefined,

    autoRecover:
      process.env.RABBITMQ_AUTO_RECOVER !==
      "false",

    consumerPrefetch:
      Number.parseInt(
        process.env.RABBITMQ_CONSUMER_PREFETCH ??
        "10",
        10,
      ),
  },


  // ===========================================================================
  // Payment Processing
  // ===========================================================================

  payment: {
    consumerQueue:
      process.env.PAYMENT_CONSUMER_QUEUE ??
      "payment.requested",

    processingTimeoutMs:
      Number.parseInt(
        process.env.PAYMENT_PROCESSING_TIMEOUT_MS ??
        "30000",
        10,
      ),
  },


  // ===========================================================================
  // Lipad
  // ===========================================================================

  lipad: {
    baseUrl:
      process.env.LIPAD_BASE_URL ??
      "https://sandbox.api.gateway.lipad.io",

    consumerKey:
      process.env.LIPAD_CONSUMER_KEY ??
      "",

    consumerSecret:
      process.env.LIPAD_CONSUMER_SECRET ??
      "",

    accountNumber:
      process.env.LIPAD_ACCOUNT_NUMBER ??
      "",

    callbackUrl:
      process.env.LIPAD_CALLBACK_URL ??
      "",

    timeoutMs:
      Number.parseInt(
        process.env.LIPAD_TIMEOUT_MS ??
        process.env.PAYMENT_PROCESSING_TIMEOUT_MS ??
        "30000",
        10,
      ),
  },


  // ===========================================================================
  // Airtel Money
  // ===========================================================================

  airtelMoney: {
    baseUrl:
      process.env.AIRTEL_MONEY_BASE_URL ??
      "https://openapi.airtel.africa",

    clientId:
      process.env.AIRTEL_MONEY_CLIENT_ID ??
      "",

    clientSecret:
      process.env.AIRTEL_MONEY_CLIENT_SECRET ??
      "",

    timeoutMs:
      Number.parseInt(
        process.env.AIRTEL_MONEY_TIMEOUT_MS ??
        process.env.PAYMENT_PROCESSING_TIMEOUT_MS ??
        "30000",
        10,
      ),
  },


  // ===========================================================================
  // Logging
  // ===========================================================================

  log: {
    level:
      process.env.LOG_LEVEL ??
      "info",

    stdout:
      process.env.LOG_STDOUT !==
      "false",

    file: {
      enabled:
        process.env.LOG_FILE_ENABLED ===
        "true",

      path:
        process.env.LOG_FILE_PATH ??
        "/var/log/pague/payments-processor/application.log",
    },
  },


  // ===========================================================================
  // OpenTelemetry
  // ===========================================================================

  telemetry: {
    enabled:
      process.env.OTEL_ENABLED !==
      "false",

    serviceName:
      process.env.OTEL_SERVICE_NAME ??
      "pague-payments-processor",

    serviceVersion:
      process.env.OTEL_SERVICE_VERSION ??
      "1.0.0",

    tracesEndpoint:
      process.env.OTEL_TRACES_ENDPOINT ??
      "",

    metricsEndpoint:
      process.env.OTEL_METRICS_ENDPOINT ??
      "",

    logsEndpoint:
      process.env.OTEL_LOGS_ENDPOINT ??
      "",

    exportIntervalMillis:
      Number.parseInt(
        process.env.OTEL_EXPORT_INTERVAL_MILLIS ??
        "10000",
        10,
      ),

    disableFsInstrumentation:
      process.env.OTEL_DISABLE_FS_INSTRUMENTATION ===
      "true",
  },
});