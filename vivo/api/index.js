// API del modo en vivo en Vercel. Conecta la lógica (_nucleo.js) con la base Postgres de Neon.
import { neon } from '@neondatabase/serverless';
import { crearManejador } from './_nucleo.js';

const url = process.env.DATABASE_URL || process.env.POSTGRES_URL || '';
const sql = url ? neon(url) : null;

async function q(texto, params = []) {
  if (!sql) {
    const e = new Error('Falta DATABASE_URL');
    e.sinBase = true;
    throw e;
  }
  return sql.query(texto, params);
}

export default crearManejador(q, {
  DATABASE_URL: url,
  REMOTE_PIN: process.env.REMOTE_PIN,
  PIN: process.env.PIN,
  TOKEN_SECRET: process.env.TOKEN_SECRET,
});
