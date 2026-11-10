// Cria/atualiza as tabelas no banco do DATABASE_URL (Neon) rodando o db/schema.sql.
// Uso (na pasta do projeto): npm run banco
// Pode rodar de novo quando o schema mudar: cada comando só cria o que ainda não existe.
import { readFile } from 'node:fs/promises';
import { neon } from '@neondatabase/serverless';

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('Falta o DATABASE_URL: cole a connection string do Neon na linha DATABASE_URL= do arquivo .env');
  process.exit(1);
}
const texto = await readFile(new URL('./schema.sql', import.meta.url), 'utf8');
// tira os comentários (-- até o fim da linha) e separa um comando por ";"
const comandos = texto
  .split(/\r?\n/).map((l) => l.replace(/--.*$/, '')).join('\n') // \r?: arquivo salvo no Windows
  .split(';').map((c) => c.trim()).filter(Boolean);
const sql = neon(url);
const host = new URL(url).host.replace(/^[^.]+/, '…'); // mostra só o fim do endereço, sem o nome do banco
console.log(`Aplicando ${comandos.length} comandos no banco ${host}`);
for (const [i, c] of comandos.entries()) {
  await sql.query(c);
  console.log(`  ${String(i + 1).padStart(2)}. ok  ${c.split('\n')[0].slice(0, 70)}`);
}
const tabelas = await sql.query("select string_agg(table_name, ', ' order by table_name) as t from information_schema.tables where table_schema = 'public'");
console.log(`Pronto. Tabelas no banco: ${tabelas[0].t}`);
