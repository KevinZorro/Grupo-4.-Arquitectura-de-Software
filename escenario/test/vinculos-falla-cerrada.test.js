// @ts-check

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { crearEscenario } from '../src/escenario.js';
import { armarBateria } from './bateria.js';

/**
 * Falla nueva que deja la autorización por vínculo (PRV-3): si la consulta de vínculos no responde, no se puede
 * decidir y nadie abre una historia, ni siquiera quien sí tiene vínculo.
 */
test('con la consulta de vínculos caída nadie abre una historia (falla cerrada)', async () => {
  const bateria = armarBateria({ sinVinculo: 0 });
  const escenario = crearEscenario({
    historias: bateria.historias,
    vinculos: bateria.vinculos,
    caidaVinculos: true,
    caidaAuditoria: false,
  });

  const respuestas = await Promise.all(
    bateria.casos.map((caso) =>
      escenario.abrirHistoria({
        documento: caso.documento,
        sesion: caso.sesion,
        justificacion: caso.justificacion,
      }),
    ),
  );

  const entregadas = respuestas.filter(({ cuerpo }) => cuerpo !== null);
  assert.equal(
    entregadas.length,
    0,
    `${entregadas.length} historias salieron sin decidir el vínculo`,
  );
  assert.ok(
    respuestas.every(({ status }) => status === 503),
    'todos deben recibir 503',
  );

  // El intento negado igual queda en la auditoría.
  const registros = escenario.puertos.auditoria.listar();
  assert.equal(registros.length, bateria.casos.length);
  assert.ok(registros.every(({ resultado }) => resultado === 'denegado'));
});
