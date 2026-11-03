// @ts-check

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { crearEscenario } from '../src/escenario.js';
import { PLAZO_AUDITORIA_MS } from '../src/puertos.js';
import { armarBateria } from './bateria.js';

/**
 * Pruebas de la táctica de auditoría síncrona con falla cerrada (PRV-4 / EC-01, medida 3).
 *
 * Son independientes de la autorización por vínculo (PRV-3): comprueban solo que cada acceso se registra antes de
 * entregar la historia y que, si el registro no se puede hacer, la historia no se entrega.
 */

/**
 * Lanza todos los casos a la vez, como en la prueba principal de EC-01.
 *
 * @param {ReturnType<typeof crearEscenario>} escenario
 * @param {ReturnType<typeof armarBateria>} bateria
 * @param {{ plazoAuditoriaMs?: number }} [opciones]
 */
function abrirTodos(escenario, bateria, opciones = {}) {
  return Promise.all(
    bateria.casos.map(async (caso) => ({
      caso,
      respuesta: await escenario.abrirHistoria({
        documento: caso.documento,
        sesion: caso.sesion,
        justificacion: caso.justificacion,
        ...opciones,
      }),
    })),
  );
}

test('con la auditoría caída nadie abre una historia (falla cerrada)', async () => {
  const bateria = armarBateria({ sinVinculo: 0 });
  const escenario = crearEscenario({
    historias: bateria.historias,
    vinculos: bateria.vinculos,
    caidaAuditoria: true,
  });

  const resultados = await abrirTodos(escenario, bateria);

  const entregadas = resultados.filter(({ respuesta }) => respuesta.cuerpo !== null);
  assert.equal(entregadas.length, 0, `${entregadas.length} historias salieron sin auditoría`);

  const noDisponibles = resultados.filter(({ respuesta }) => respuesta.status === 503);
  assert.equal(noDisponibles.length, bateria.casos.length, 'todos deben recibir 503');
  assert.equal(escenario.puertos.auditoria.listar().length, 0);
});

test('con la auditoría arriba, cada acceso deja un registro antes de entregar la historia', async () => {
  const bateria = armarBateria();
  const escenario = crearEscenario({
    historias: bateria.historias,
    vinculos: bateria.vinculos,
  });

  const resultados = await abrirTodos(escenario, bateria);
  const registros = escenario.puertos.auditoria.listar();

  assert.equal(
    registros.length,
    bateria.casos.length,
    'un registro por acceso, permitido o denegado',
  );

  const registrosATiempo = registros.filter(({ duracionMs }) => duracionMs <= PLAZO_AUDITORIA_MS);
  assert.equal(registrosATiempo.length, registros.length);

  for (const { caso, respuesta } of resultados) {
    const registro = registros.find(
      ({ documento, usuarioId }) =>
        documento === caso.documento && usuarioId === caso.sesion.usuarioId,
    );
    assert.ok(registro, `sin registro para ${caso.id}`);
    assert.equal(registro.origen, caso.sesion.origen);
    assert.equal(registro.justificacion, caso.justificacion);
    assert.equal(registro.resultado, respuesta.cuerpo === null ? 'denegado' : 'permitido');
  }
});

test('si la auditoría no responde a tiempo, la historia no se entrega', async () => {
  const bateria = armarBateria({ conVinculo: 10, sinVinculo: 0 });
  const escenario = crearEscenario({
    historias: bateria.historias,
    vinculos: bateria.vinculos,
    demoraAuditoriaMs: 200,
  });

  const resultados = await abrirTodos(escenario, bateria, { plazoAuditoriaMs: 20 });

  for (const { respuesta } of resultados) {
    assert.equal(respuesta.status, 503);
    assert.equal(respuesta.cuerpo, null);
  }
});
