/* Lee y guarda el contenido del jardín en Netlify Blobs.
   GET  -> devuelve lo publicado (o null). Es público.
   POST -> { clave, datos }; solo guarda si clave coincide con la variable de entorno EDIT_KEY. */
import { getStore } from '@netlify/blobs';
import { createHash, timingSafeEqual } from 'node:crypto';

const MAX_BYTES = 5 * 1024 * 1024; // las funciones de Netlify aceptan hasta ~6 MB por petición

const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }
});

const digest = s => createHash('sha256').update(String(s ?? '')).digest();
const text = (v, max) => (typeof v === 'string' ? v.slice(0, max) : '');

export default async (req) => {
  if (req.method === 'GET') return json(await getStore('jardin').get('data', { type: 'json' }));

  if (req.method !== 'POST') return json({ error: 'metodo' }, 405);

  const esperada = process.env.EDIT_KEY;
  if (!esperada) return json({ error: 'sin-clave' }, 500);

  const raw = await req.text();
  if (raw.length > MAX_BYTES) return json({ error: 'grande' }, 413);

  let body;
  try { body = JSON.parse(raw); } catch { return json({ error: 'formato' }, 400); }

  if (!timingSafeEqual(digest(body.clave), digest(esperada))) return json({ error: 'clave' }, 401);

  const d = body.datos;
  if (!d || typeof d !== 'object' || !Array.isArray(d.recuerdos)) return json({ error: 'formato' }, 400);

  // solo se guardan los campos conocidos, con sus tamaños acotados
  const datos = {
    nombre1: text(d.nombre1, 30),
    nombre2: text(d.nombre2, 30),
    fecha: /^\d{4}-\d{2}-\d{2}$/.test(d.fecha) ? d.fecha : '',
    carta: text(d.carta, 5000),
    recuerdos: d.recuerdos.slice(0, 24).map(m => ({
      foto: typeof m.foto === 'string' && m.foto.startsWith('data:image/') ? m.foto : '',
      titulo: text(m.titulo, 60),
      texto: text(m.texto, 300)
    }))
  };

  await getStore('jardin').setJSON('data', datos);
  return json({ ok: true });
};
