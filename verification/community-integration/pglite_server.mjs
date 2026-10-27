// Isolated WASM PostgreSQL for migration/dialect tests; not a production dependency.
import { PGlite } from '@electric-sql/pglite';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';
const db = await PGlite.create();
await db.exec('CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;');
const server = new PGLiteSocketServer({ db, host: '127.0.0.1', port: 55439, maxConnections: 32 });
await server.start();
console.log('Isolated PGlite PostgreSQL protocol ready on 127.0.0.1:55439');
process.on('SIGINT', async () => { await server.stop(); await db.close(); process.exit(0); });
