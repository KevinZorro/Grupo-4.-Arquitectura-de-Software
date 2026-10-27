/** The seed loads made-up people and clinics, so it must never run against a production database. */
export function assertSeedAllowed(nodeEnv: string | undefined): void {
  if (nodeEnv === 'production') {
    throw new Error('La semilla carga datos ficticios y no se ejecuta con NODE_ENV=production.');
  }
}
