import { declararTopologia, publicar, type ClaveEnrutamiento, type Evento } from '@citas/eventos';
import {
  Injectable,
  Logger,
  type OnApplicationBootstrap,
  type OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { connect, type ChannelModel, type ConfirmChannel } from 'amqplib';
import type { Env } from '../config/env';
import { PrismaService } from '../prisma/prisma.service';

const INTERVALO_MS = 1_000;
const TAMANO_LOTE = 100;

/**
 * Sends the outbox to RabbitMQ in order and marks each event once the broker confirms it. When
 * the broker is down the events stay pending and the next round tries again, so none is lost. A
 * crash between the confirmation and the mark resends the event with the same idEvento, which the
 * idempotent consumers discard. It assumes a single core instance: two would not keep the order.
 */
@Injectable()
export class PublicadorPendientes implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(PublicadorPendientes.name);
  private readonly url: string;
  private conexion?: ChannelModel;
  private canal?: ConfirmChannel;
  private temporizador?: NodeJS.Timeout;
  private activo = false;
  private brokerCaido = false;

  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService<Env, true>,
  ) {
    this.url = config.get('RABBITMQ_URL', { infer: true });
  }

  onApplicationBootstrap(): void {
    this.activo = true;
    this.programar();
  }

  async onModuleDestroy(): Promise<void> {
    this.activo = false;
    clearTimeout(this.temporizador);
    await this.descartarConexion();
  }

  /** Publishes one batch of pending events and answers how many the broker confirmed. */
  async publicarPendientes(): Promise<number> {
    let enviados = 0;
    try {
      const canal = await this.obtenerCanal();
      const lote = await this.prisma.eventoSaliente.findMany({
        where: { enviadoEn: null },
        orderBy: { secuencia: 'asc' },
        take: TAMANO_LOTE,
      });
      for (const fila of lote) {
        const clave = fila.clave as ClaveEnrutamiento;
        await publicar(canal, clave, fila.contenido as Evento<typeof clave>);
        await this.prisma.eventoSaliente.update({
          where: { secuencia: fila.secuencia },
          data: { enviadoEn: new Date() },
        });
        enviados += 1;
      }
      this.brokerCaido = false;
    } catch (error) {
      // Stopping at the first failure keeps the order: what is left goes out in the next round.
      if (!this.brokerCaido) {
        const motivo = error instanceof Error ? error.message : String(error);
        this.logger.warn(`No se pudo publicar la bandeja de salida; se reintentará: ${motivo}`);
      }
      this.brokerCaido = true;
      await this.descartarConexion();
    }
    return enviados;
  }

  // Each round is scheduled when the previous one ends, so two rounds never send the same event.
  private programar(): void {
    this.temporizador = setTimeout(() => {
      void this.publicarPendientes().finally(() => {
        if (this.activo) this.programar();
      });
    }, INTERVALO_MS);
  }

  private async obtenerCanal(): Promise<ConfirmChannel> {
    if (this.canal) return this.canal;

    const conexion = await connect(this.url);
    // Without these listeners a broker restart would crash the core with an unhandled 'error'.
    conexion.on('error', () => undefined);
    conexion.on('close', () => {
      this.conexion = undefined;
      this.canal = undefined;
    });
    const canal = await conexion.createConfirmChannel();
    canal.on('error', () => undefined);
    await declararTopologia(canal);

    this.conexion = conexion;
    this.canal = canal;
    return canal;
  }

  private async descartarConexion(): Promise<void> {
    const conexion = this.conexion;
    this.conexion = undefined;
    this.canal = undefined;
    await conexion?.close().catch(() => undefined);
  }
}
