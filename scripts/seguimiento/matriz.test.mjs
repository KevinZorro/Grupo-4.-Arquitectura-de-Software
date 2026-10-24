import assert from 'node:assert/strict';
import { test } from 'node:test';
import { STATUS, buildMatrix, classify, renderCsv, renderMarkdown } from './matriz.mjs';

const TZ = 'America/Bogota';
const open = { state: 'open' };
const closedAt = (closed_at) => ({ state: 'closed', closed_at });

test('open issue before its due date is pending', () => {
  const result = classify('2026-10-28', open, '2026-10-27T15:00:00Z', TZ);
  assert.deepEqual(result, { status: STATUS.PENDING, closedOn: '', daysLate: 0 });
});

test('open issue is not overdue until the due day ends in Bogota', () => {
  // 2026-10-29 04:30Z is still 28 October 23:30 in Bogota.
  assert.equal(classify('2026-10-28', open, '2026-10-29T04:30:00Z', TZ).status, STATUS.PENDING);
  assert.equal(classify('2026-10-28', open, '2026-10-29T05:05:00Z', TZ).status, STATUS.OVERDUE);
});

test('overdue issue counts the days past its due date', () => {
  assert.equal(classify('2026-10-28', open, '2026-10-31T15:00:00Z', TZ).daysLate, 3);
});

test('closing at 23:59 on the due day in Bogota is on time', () => {
  const result = classify('2026-10-25', closedAt('2026-10-26T04:59:00Z'), '2026-11-01T00:00:00Z', TZ);
  assert.equal(result.status, STATUS.ON_TIME);
  assert.equal(result.closedOn, '2026-10-25');
});

test('closing the next day is late by one day', () => {
  const result = classify('2026-10-25', closedAt('2026-10-26T05:00:00Z'), '2026-11-01T00:00:00Z', TZ);
  assert.deepEqual(result, { status: STATUS.LATE, closedOn: '2026-10-26', daysLate: 1 });
});

test('an issue closed as not planned is dropped and never late', () => {
  const issue = { state: 'closed', state_reason: 'not_planned', closed_at: '2026-12-01T10:00:00Z' };
  assert.equal(classify('2026-10-25', issue, '2026-12-02T10:00:00Z', TZ).status, STATUS.DROPPED);
});

const config = {
  timeZone: TZ,
  people: { ana: 'Ana', beto: 'Beto', carla: 'Carla' },
  tasks: [
    { issue: 1, id: 'T-1', hours: 2, due: '2026-10-25' },
    { issue: 2, id: 'T-2', hours: 3, due: '2026-10-25' },
    { issue: 3, id: 'T-3', hours: 4, due: '2026-10-30' },
    { issue: 4, id: 'T-4', hours: 1, due: '2026-10-25' },
  ],
};
const issues = new Map([
  [1, { ...closedAt('2026-10-25T20:00:00Z'), title: 'Uno', html_url: 'u1', assignees: [{ login: 'ana' }] }],
  [2, { ...closedAt('2026-10-27T20:00:00Z'), title: 'Dos, con "comillas" | y barra', html_url: 'u2', assignees: [{ login: 'ana' }] }],
  [3, { ...open, title: 'Tres', html_url: 'u3', assignees: [{ login: 'beto' }] }],
  [4, { ...open, title: 'Cuatro', html_url: 'u4', assignees: [] }],
]);
const now = '2026-10-28T15:00:00Z';

test('summary counts statuses and hours at risk per person', () => {
  const { summary } = buildMatrix(config, issues, now);
  const ana = summary.find((s) => s.owner === 'Ana');
  assert.deepEqual(
    { onTime: ana.onTime, late: ana.late, hours: ana.hours, hoursAtRisk: ana.hoursAtRisk },
    { onTime: 1, late: 1, hours: 5, hoursAtRisk: 3 },
  );
  assert.equal(summary.find((s) => s.owner === 'Beto').pending, 1);
});

test('unassigned issues are reported and people without tasks are omitted', () => {
  const { rows, summary } = buildMatrix(config, issues, now);
  assert.equal(rows.find((r) => r.id === 'T-4').owner, 'Sin asignar');
  assert.equal(rows.find((r) => r.id === 'T-4').status, STATUS.OVERDUE);
  assert.equal(summary.some((s) => s.owner === 'Carla'), false);
});

test('csv quotes cells and markdown escapes pipes', () => {
  const matrix = buildMatrix(config, issues, now);
  assert.match(renderCsv(matrix), /"Dos, con ""comillas"" \| y barra"/);
  assert.match(renderMarkdown(matrix, now, TZ), /^\| T-2 \| \[#2\]\(u2\) \| Ana \| 2026-10-25 \| Cerrada tarde \| 2026-10-27 \| 2 \| 3 \|$/m);
});
