/* Lee y guarda el contenido del jardín en Netlify Blobs.
   GET  -> null si no hay nada publicado, o { locked: true }. Nunca devuelve el contenido.
   POST { accion: 'leer', clave }  -> devuelve { datos } si clave es EDIT_KEY o la fecha de aniversario guardada.
   POST { clave, datos }           -> guarda; solo si clave coincide con la variable de entorno EDIT_KEY. */
import { getStore } from '@netlify/blobs';
import { createHash, timingSafeEqual } from 'node:crypto';

const MAX_BYTES = 5 * 1024 * 1024; // las funciones de Netlify aceptan hasta ~6 MB por petición

const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }
});

const digest = s => createHash('sha256').update(String(s ?? '')).digest();
const text = (v, max) => (typeof v === 'string' ? v.slice(0, max) : '');
const pausa = ms => new Promise(r => setTimeout(r, ms));
const esClave = (intento, esperada) => !!esperada && timingSafeEqual(digest(intento), digest(esperada));

// la contraseña de los visitantes es la fecha guardada; acepta 21/03/2024, 21-03-2024, 21032024, 20240321 o 210324
function esFecha(fecha, intento) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(fecha || '');
  const t = String(intento ?? '').replace(/\D/g, '');
  if (!m || !t) return false;
  const [, y, mo, d] = m;
  return [d + mo + y, y + mo + d, d + mo + y.slice(2)].includes(t);
}

export default async (req) => {
  if (req.method === 'GET') return json((await getStore('jardin').get('data', { type: 'json' })) ? { locked: true } : null);

  if (req.method !== 'POST') return json({ error: 'metodo' }, 405);

  const raw = await req.text();
  if (raw.length > MAX_BYTES) return json({ error: 'grande' }, 413);

  let body;
  try { body = JSON.parse(raw); } catch { return json({ error: 'formato' }, 400); }

  if (body.accion === 'leer') {
    const guardado = await getStore('jardin').get('data', { type: 'json' });
    if (!guardado) return json({ datos: null });
    if (esClave(body.clave, process.env.EDIT_KEY) || esFecha(guardado.fecha, body.clave)) return json({ datos: guardado });
    await pausa(1200); // frena los intentos seguidos
    return json({ error: 'clave' }, 401);
  }

  if (!process.env.EDIT_KEY) return json({ error: 'sin-clave' }, 500);
  if (!esClave(body.clave, process.env.EDIT_KEY)) { await pausa(1200); return json({ error: 'clave' }, 401); }

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
