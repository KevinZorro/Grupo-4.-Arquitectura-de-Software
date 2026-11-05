-- CreateEnum
CREATE TYPE "modalidad" AS ENUM ('VIRTUAL', 'PRESENCIAL');

-- CreateEnum
CREATE TYPE "estado_cita" AS ENUM ('PENDIENTE_PAGO', 'CONFIRMADA', 'CANCELADA');

-- CreateTable
CREATE TABLE "franja" (
    "id" UUID NOT NULL,
    "profesional_id" UUID NOT NULL,
    "sede_id" UUID NOT NULL,
    "modalidad" "modalidad" NOT NULL,
    "inicia_en" TIMESTAMPTZ(3) NOT NULL,
    "termina_en" TIMESTAMPTZ(3) NOT NULL,
    "creado_en" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "franja_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cita" (
    "id" UUID NOT NULL,
    "franja_id" UUID NOT NULL,
    "paciente_id" UUID NOT NULL,
    "estado" "estado_cita" NOT NULL,
    "bloqueo_vence_en" TIMESTAMPTZ(3),
    "clave_idempotencia" TEXT NOT NULL,
    "creado_en" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "cita_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "franja_inicia_en_idx" ON "franja"("inicia_en");

-- CreateIndex
CREATE UNIQUE INDEX "franja_profesional_id_inicia_en_key" ON "franja"("profesional_id", "inicia_en");

-- CreateIndex
CREATE INDEX "cita_paciente_id_idx" ON "cita"("paciente_id");

-- CreateIndex
CREATE INDEX "cita_franja_id_idx" ON "cita"("franja_id");

-- CreateIndex
CREATE UNIQUE INDEX "cita_paciente_id_clave_idempotencia_key" ON "cita"("paciente_id", "clave_idempotencia");

-- AddForeignKey
ALTER TABLE "franja" ADD CONSTRAINT "franja_profesional_id_fkey" FOREIGN KEY ("profesional_id") REFERENCES "profesional"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "franja" ADD CONSTRAINT "franja_sede_id_fkey" FOREIGN KEY ("sede_id") REFERENCES "sede"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cita" ADD CONSTRAINT "cita_franja_id_fkey" FOREIGN KEY ("franja_id") REFERENCES "franja"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Hand-written: Prisma cannot declare these.
-- A franja holds at most one cita that is not CANCELADA; a cancelled one frees it for the next.
CREATE UNIQUE INDEX "cita_franja_activa_key" ON "cita"("franja_id") WHERE "estado" <> 'CANCELADA';

ALTER TABLE "franja" ADD CONSTRAINT "franja_termina_despues_check" CHECK ("termina_en" > "inicia_en");
