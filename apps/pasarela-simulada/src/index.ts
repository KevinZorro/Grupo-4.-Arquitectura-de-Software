import { crearApp } from './app';

const puerto = Number(process.env.PASARELA_PORT ?? 4000);
const baseUrl = (process.env.PASARELA_BASE_URL ?? `http://localhost:${puerto}`).replace(/\/+$/, '');
const urlWebhook = process.env.PAGOS_WEBHOOK_URL ?? 'http://localhost:3000/api/v1/pagos/webhook';
const secreto = process.env.PAGOS_WEBHOOK_SECRET ?? 'cambiar-en-local';

const app = crearApp({ baseUrl, urlWebhook, secreto });

app.listen(puerto, () => {
  console.log(`[pasarela] escuchando en ${baseUrl}`);
  console.log(`[pasarela] webhook del núcleo: ${urlWebhook}`);
});
