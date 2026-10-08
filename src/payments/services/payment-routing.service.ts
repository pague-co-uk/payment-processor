import {
  Injectable,
} from "@nestjs/common";

import {
  PaymentsRepository,
} from "../repositories/payments.repository.js";

@Injectable()
export class PaymentRoutingService {
  constructor(
    private readonly repository:
      PaymentsRepository,
  ) { }

  // ===========================================================================
  // Resolve payment provider
  // ===========================================================================

  async resolve(
    serviceId: string,
  ) {
    const providers =
      await this.repository
        .findActiveProviderServices(
          serviceId,
        );

    if (
      providers.length === 0
    ) {
      throw new Error(
        `No active payment provider is configured for service '${serviceId}'.`,
      );
    }

    return providers[0];
  }
}