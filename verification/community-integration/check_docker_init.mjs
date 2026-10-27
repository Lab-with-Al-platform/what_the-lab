// Execute the exact Docker init SQL in isolated WASM PostgreSQL. Does not run Docker.
import { PGlite } from '@electric-sql/pglite';
import fs from 'node:fs';
import path from 'node:path';
const root=path.resolve(process.argv[2]);
const db=await PGlite.create();
try {
  await db.exec('CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;');
  const files=fs.readdirSync(path.join(root,'database/init')).filter(n=>n.endsWith('.sql')).sort();
  await db.exec('BEGIN');
  for (const file of files) await db.exec(fs.readFileSync(path.join(root,'database/init',file),'utf8'));
  await db.exec('COMMIT');
  const [{rows}]=await db.exec("SELECT count(*)::int AS count FROM pg_tables WHERE schemaname='community_private'");
  if (rows[0].count!==8) throw new Error('Expected 8 community tables');
  const common=await db.query("SELECT to_regclass('public.collaboration_request')::text AS request, to_regclass('public.notification')::text AS notification");
  if (!common.rows[0].request || !common.rows[0].notification) throw new Error('Latest request/notification missing');
  const result={engine:'PGlite WASM PostgreSQL',files:files.length,community_tables:8,latest_request_and_notification:true,docker_container_verified:false};
  fs.writeFileSync(new URL('./docker_init_result.json',import.meta.url),JSON.stringify(result,null,2));
  console.log(JSON.stringify(result));
} finally { await db.close(); }
