import {
  Injectable,
  OnModuleInit,
} from "@nestjs/common";

import {
  DiscoveryService,
  Reflector,
} from "@nestjs/core";

import {
  getComponentLogger,
} from "@pague-co-uk/sms-gateway-telemetry";

import {
  PAYMENT_PROVIDER,
} from "./payment-provider.decorator.js";

import type {
  PaymentProviderAdapter,
} from "./interfaces/payment-provider.adapter.js";

@Injectable()
export class PaymentProviderRegistry
  implements OnModuleInit {
  private readonly providers =
    new Map<
      string,
      PaymentProviderAdapter
    >();

  private readonly logger =
    getComponentLogger(
      "payment-provider-registry",
    );

  constructor(
    private readonly discovery:
      DiscoveryService,

    private readonly reflector:
      Reflector,
  ) { }

  // ===========================================================================
  // Provider discovery
  // ===========================================================================

  onModuleInit(): void {
    const wrappers =
      this.discovery.getProviders();

    for (
      const wrapper of wrappers
    ) {
      const instance =
        wrapper.instance;

      if (!instance) {
        continue;
      }

      const constructor =
        instance.constructor;

      const codes =
        this.reflector.get<
          string[]
        >(
          PAYMENT_PROVIDER,
          constructor,
        );

      if (
        !Array.isArray(codes) ||
        codes.some(
          (code) =>
            typeof code !==
            "string",
        )
      ) {
        continue;
      }

      if (
        typeof instance.execute !==
        "function"
      ) {
        throw new Error(
          `Payment provider '${codes.join(", ")}' does not implement execute().`,
        );
      }

      for (
        const code of codes
      ) {
        if (
          this.providers.has(
            code,
          )
        ) {
          this.logger.warn(
            {
              providerCode:
                code,
            },
            "Payment provider is already registered; skipping duplicate registration.",
          );

          continue;
        }

        this.providers.set(
          code,
          instance as PaymentProviderAdapter,
        );

        this.logger.info(
          {
            providerCode:
              code,
          },
          "Payment provider registered.",
        );
      }
    }
  }

  // ===========================================================================
  // Resolve provider by code
  // ===========================================================================

  get(
    code: string,
  ): PaymentProviderAdapter {
    const normalizedCode =
      code.trim().toUpperCase();

    const provider =
      this.providers.get(
        normalizedCode,
      );

    if (!provider) {
      throw new Error(
        `Payment provider '${normalizedCode}' is not registered.`,
      );
    }

    return provider;
  }

  // ===========================================================================
  // Provider existence
  // ===========================================================================

  has(
    code: string,
  ): boolean {
    return this.providers.has(
      code.trim().toUpperCase(),
    );
  }

  // ===========================================================================
  // Registered provider names
  // ===========================================================================

  getNames(): string[] {
    return [
      ...this.providers.keys(),
    ];
  }
}