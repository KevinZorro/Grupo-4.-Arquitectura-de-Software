#!/usr/bin/env node
// Builds the deadline matrix of the sprint tasks from the state of their GitHub issues.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export const STATUS = {
  ON_TIME: 'A tiempo',
  LATE: 'Cerrada tarde',
  OVERDUE: 'Vencida',
  PENDING: 'Pendiente',
  DROPPED: 'Descartada',
};

const MS_PER_DAY = 86_400_000;

const localDate = (instant, timeZone) =>
  new Date(instant).toLocaleDateString('en-CA', { timeZone });

const daysBetween = (from, to) => Math.round((Date.parse(to) - Date.parse(from)) / MS_PER_DAY);

// A task is on time when its issue closes on or before the due date, counted in the team's time zone.
export function classify(due, issue, now, timeZone) {
  if (issue.state === 'closed' && issue.state_reason === 'not_planned') {
    return { status: STATUS.DROPPED, closedOn: localDate(issue.closed_at, timeZone), daysLate: 0 };
  }
  if (issue.state === 'closed') {
    const closedOn = localDate(issue.closed_at, timeZone);
    const daysLate = Math.max(0, daysBetween(due, closedOn));
    return { status: daysLate > 0 ? STATUS.LATE : STATUS.ON_TIME, closedOn, daysLate };
  }
  const daysLate = Math.max(0, daysBetween(due, localDate(now, timeZone)));
  return { status: daysLate > 0 ? STATUS.OVERDUE : STATUS.PENDING, closedOn: '', daysLate };
}

export function buildMatrix(config, issues, now) {
  const rows = config.tasks.map((task) => {
    const issue = issues.get(task.issue);
    const login = issue.assignees?.[0]?.login;
    return {
      id: task.id,
      issue: task.issue,
      title: issue.title,
      url: issue.html_url,
      owner: config.people[login] ?? login ?? 'Sin asignar',
      hours: task.hours,
      due: task.due,
      ...classify(task.due, issue, now, config.timeZone),
    };
  });

  const counted = rows.filter((row) => row.status !== STATUS.DROPPED);
  const owners = [...new Set([...Object.values(config.people), ...counted.map((row) => row.owner)])];
  const summary = owners
    .map((owner) => {
      const own = counted.filter((row) => row.owner === owner);
      const count = (status) => own.filter((row) => row.status === status).length;
      const atRisk = own.filter((row) => [STATUS.LATE, STATUS.OVERDUE].includes(row.status));
      return {
        owner,
        tasks: own.length,
        onTime: count(STATUS.ON_TIME),
        late: count(STATUS.LATE),
        overdue: count(STATUS.OVERDUE),
        pending: count(STATUS.PENDING),
        hours: own.reduce((sum, row) => sum + row.hours, 0),
        hoursAtRisk: atRisk.reduce((sum, row) => sum + row.hours, 0),
      };
    })
    .filter((row) => row.tasks > 0);

  return { rows, summary };
}

const escapeCell = (text) => String(text).replaceAll('|', '\\|');

export function renderMarkdown({ rows, summary }, now, timeZone) {
  const stamp = new Date(now).toLocaleString('sv-SE', { timeZone });
  const lines = [
    '# Matriz de cumplimiento de fechas límite',
    '',
    `Generada el ${stamp} (${timeZone}). Una tarea cuenta a tiempo si su issue se cierra a más tardar el día de su fecha límite.`,
    '',
    '## Resumen por persona',
    '',
    '| Responsable | Tareas | A tiempo | Cerradas tarde | Vencidas | Pendientes | Horas | Horas en riesgo |',
    '|---|---|---|---|---|---|---|---|',
    ...summary.map(
      (s) =>
        `| ${s.owner} | ${s.tasks} | ${s.onTime} | ${s.late} | ${s.overdue} | ${s.pending} | ${s.hours} | ${s.hoursAtRisk} |`,
    ),
    '',
    '## Detalle por tarea',
    '',
    '| Tarea | Issue | Responsable | Vence | Estado | Cerrada | Días de retraso | Horas |',
    '|---|---|---|---|---|---|---|---|',
    ...rows.map(
      (r) =>
        `| ${r.id} | [#${r.issue}](${r.url}) | ${r.owner} | ${r.due} | ${r.status} | ${r.closedOn || '—'} | ${r.daysLate} | ${r.hours} |`,
    ),
    '',
  ];
  return lines.join('\n');
}

const csvCell = (value) => (/[",\n]/.test(String(value)) ? `"${String(value).replaceAll('"', '""')}"` : String(value));

export function renderCsv({ rows }) {
  const header = ['tarea', 'issue', 'titulo', 'responsable', 'vence', 'estado', 'cerrada', 'dias_retraso', 'horas'];
  const body = rows.map((r) =>
    [r.id, r.issue, r.title, r.owner, r.due, r.status, r.closedOn, r.daysLate, r.hours].map(csvCell).join(','),
  );
  return [header.join(','), ...body, ''].join('\n');
}

async function fetchIssue(repo, number, token) {
  const response = await fetch(`https://api.github.com/repos/${repo}/issues/${number}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
  });
  if (!response.ok) throw new Error(`Issue #${number}: GitHub answered ${response.status}`);
  return response.json();
}

async function main() {
  const [outDir = 'out'] = process.argv.slice(2);
  const { GITHUB_TOKEN: token, GITHUB_REPOSITORY: repo, MATRIX_NOW: nowOverride } = process.env;
  if (!token || !repo) throw new Error('GITHUB_TOKEN and GITHUB_REPOSITORY are required');

  const config = JSON.parse(
    readFileSync(new URL('../../docs/seguimiento/fechas-limite.json', import.meta.url), 'utf8'),
  );
  const now = nowOverride ?? new Date().toISOString();
  const entries = await Promise.all(
    config.tasks.map(async (task) => [task.issue, await fetchIssue(repo, task.issue, token)]),
  );

  const matrix = buildMatrix(config, new Map(entries), now);
  mkdirSync(outDir, { recursive: true });
  writeFileSync(`${outDir}/matriz-fechas.md`, renderMarkdown(matrix, now, config.timeZone));
  writeFileSync(`${outDir}/matriz-fechas.csv`, renderCsv(matrix));
  console.log(`Matrix written to ${outDir} (${matrix.rows.length} tasks)`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}
