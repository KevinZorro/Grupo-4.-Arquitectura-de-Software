// @ts-check

/**
 * @typedef {import('../src/puertos.js').Historia} Historia
 * @typedef {import('../src/puertos.js').Sesion} Sesion
 * @typedef {import('../src/puertos.js').Vinculo} Vinculo
 */

/**
 * Vínculos asistenciales que habilitan la historia clínica: cita vigente, episodio abierto o interconsulta.
 *
 * @type {readonly ['cita-vigente', 'episodio-abierto', 'interconsulta']}
 */
export const TIPOS_CON_VINCULO = ['cita-vigente', 'episodio-abierto', 'interconsulta'];

/**
 * Los cuatro tipos de intento sin vínculo que pide la batería de EC-01:
 *
 * - `funcionario-sin-vinculo`: el paciente existe, el funcionario no tiene cita, episodio ni interconsulta.
 * - `vinculo-vencido`: el vínculo existió, pero ya no está vigente.
 * - `otra-sede`: el funcionario entra desde fuera de la red, a un paciente de otra sede.
 * - `paciente-inexistente`: el documento no corresponde a ningún paciente.
 *
 * @type {readonly ['funcionario-sin-vinculo', 'vinculo-vencido', 'otra-sede', 'paciente-inexistente']}
 */
export const TIPOS_SIN_VINCULO = [
  'funcionario-sin-vinculo',
  'vinculo-vencido',
  'otra-sede',
  'paciente-inexistente',
];

/**
 * @type {Record<string, 'cita' | 'episodio' | 'interconsulta'>}
 */
const VINCULO_POR_TIPO = {
  'cita-vigente': 'cita',
  'episodio-abierto': 'episodio',
  interconsulta: 'interconsulta',
};

const SEDE_PROPIA = 'sede-01';
const SEDE_AJENA = 'sede-02';

/**
 * Un caso de la batería: quién pide, qué documento busca y si tiene vínculo.
 *
 * @typedef {Object} Caso
 * @property {string} id
 * @property {string} documento
 * @property {string} tipo
 * @property {boolean} conVinculo
 * @property {Sesion} sesion
 * @property {string} justificacion
 */

/**
 * @typedef {Object} Bateria
 * @property {Caso[]} casos
 * @property {Historia[]} historias
 * @property {Vinculo[]} vinculos
 */

/**
 * Arma la batería de EC-01.
 *
 * Por omisión son 200 casos: 120 con vínculo, 40 de cada tipo, y 80 sin vínculo, 20 de cada uno de los cuatro
 * tipos. El reparto 120/80 y los cuatro tipos son un supuesto del grupo, no un dato del caso. Los datos son
 * ficticios.
 *
 * @param {{ conVinculo?: number, sinVinculo?: number }} [opciones]
 * @returns {Bateria}
 */
export function armarBateria({ conVinculo = 120, sinVinculo = 80 } = {}) {
  /** @type {Caso[]} */
  const casos = [];
  /** @type {Historia[]} */
  const historias = [];
  /** @type {Vinculo[]} */
  const vinculos = [];

  let consecutivo = 0;

  const siguienteDocumento = () => {
    consecutivo += 1;
    return `CC-${String(consecutivo).padStart(4, '0')}`;
  };

  /**
   * @param {string} documento
   * @returns {Historia}
   */
  const historiaDe = (documento) => ({
    documento,
    nombreCompleto: `Paciente ficticio ${documento}`,
    resumen: `Nota de atención ficticia del documento ${documento}`,
  });

  // Casos con vínculo asistencial vigente: cita, episodio o interconsulta.
  for (let i = 0; i < conVinculo; i += 1) {
    const tipo = TIPOS_CON_VINCULO[i % TIPOS_CON_VINCULO.length];
    const documento = siguienteDocumento();
    const usuarioId = `usr-${documento.toLowerCase()}`;

    casos.push({
      id: `caso-${documento}`,
      documento,
      tipo,
      conVinculo: true,
      sesion: { usuarioId, sedeId: SEDE_PROPIA, origen: 'intranet' },
      justificacion: 'Atención de la cita del día',
    });

    historias.push(historiaDe(documento));
    vinculos.push({ documento, usuarioId, tipo: VINCULO_POR_TIPO[tipo], vigente: true });
  }

  // Casos sin vínculo: los cuatro tipos, con la trampa que corresponde a cada uno.
  for (let i = 0; i < sinVinculo; i += 1) {
    const tipo = TIPOS_SIN_VINCULO[i % TIPOS_SIN_VINCULO.length];
    const documento = siguienteDocumento();
    const usuarioId = `usr-${tipo}-${documento.toLowerCase()}`;
    const deOtraSede = tipo === 'otra-sede';

    casos.push({
      id: `caso-${documento}`,
      documento,
      tipo,
      conVinculo: false,
      sesion: {
        usuarioId,
        sedeId: deOtraSede ? SEDE_AJENA : SEDE_PROPIA,
        origen: deOtraSede ? 'internet' : 'intranet',
      },
      justificacion: 'Revisión de antecedentes',
    });

    // El paciente inexistente es el único que no tiene historia.
    if (tipo !== 'paciente-inexistente') {
      historias.push(historiaDe(documento));
    }

    // El vínculo vencido existe en la base, pero no está vigente.
    if (tipo === 'vinculo-vencido') {
      vinculos.push({ documento, usuarioId, tipo: 'episodio', vigente: false });
    }
  }

  return { casos, historias, vinculos };
}
