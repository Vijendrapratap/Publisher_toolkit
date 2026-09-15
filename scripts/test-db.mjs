// Local Postgres for integration tests. Usage: node scripts/test-db.mjs
// Stays in the foreground; stop with Ctrl-C.
import { PG_PORT, startEmbeddedDb } from './embedded-db.mjs'

const DB_NAME = 'ads_creative_test'
const { stop } = await startEmbeddedDb([DB_NAME])
console.log(`READY postgresql://postgres:postgres@localhost:${PG_PORT}/${DB_NAME}`)

const shutdown = async () => { await stop(); process.exit(0) }
process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
await new Promise(() => {})
