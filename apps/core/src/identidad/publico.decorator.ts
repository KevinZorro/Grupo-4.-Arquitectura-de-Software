import { SetMetadata } from '@nestjs/common';

export const ES_PUBLICO = 'es-publico';

/**
 * Opts a route (or a whole controller) out of authentication. Every other route denies by default,
 * so use it only for what must be reachable without a user: the health probe, signed webhooks
 * that check their own signature, and the internal contract of the adapters.
 */
export const Publico = (): MethodDecorator & ClassDecorator => SetMetadata(ES_PUBLICO, true);
