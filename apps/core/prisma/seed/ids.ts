// Seeded rows get fixed ids so other tasks, tests and the frontend's dev user picker can name them.
const KIND_BYTE = {
  sede: 0x01,
  especialidad: 0x02,
  profesional: 0x03,
  paciente: 0x04,
  usuario: 0x05,
} as const;

export type SeedKind = keyof typeof KIND_BYTE;

/** Prisma's create inputs leave the id optional; seeded rows always carry one. */
export type WithId<T extends { id?: string }> = T & { id: string };

/**
 * A valid UUID (version 4 bits, variant 8) built from the kind of row and its number, for example
 * `00000000-0000-4000-8001-000000000003` for the third sede. Readable in a query result and
 * accepted by `z.uuid()`.
 */
export function seedId(kind: SeedKind, n: number): string {
  const kindHex = KIND_BYTE[kind].toString(16).padStart(2, '0');
  return `00000000-0000-4000-80${kindHex}-${n.toString(16).padStart(12, '0')}`;
}

/** Prisma skips undefined fields, so an update built this way never rewrites the primary key. */
export function forUpdate<T extends { id: string }>(data: T): T & { id: undefined } {
  return { ...data, id: undefined };
}
