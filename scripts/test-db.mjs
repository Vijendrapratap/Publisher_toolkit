// Starts a local, real Postgres instance for integration tests — no Docker or
// system install required. Used by Task 2 (and every later task that needs a
// live database in this environment, where Docker's daemon is unreachable and
// there's no passwordless sudo for `apt install postgresql`).
//
// Usage: node scripts/test-db.mjs
// Leaves the server running in the foreground; stop with Ctrl-C or by killing
// the process. Data persists across restarts in .pgdata/ (gitignored).
import EmbeddedPostgres from 'embedded-postgres'

const DATA_DIR = new URL('../.pgdata', import.meta.url).pathname
const DB_NAME = 'ads_creative_test'
const PORT = 5432

const pg = new EmbeddedPostgres({
  databaseDir: DATA_DIR,
  user: 'postgres',
  password: 'postgres',
  port: PORT,
  persistent: true,
})

async function main() {
  await pg.initialise()
  await pg.start()

  try {
    await pg.createDatabase(DB_NAME)
  } catch (err) {
    if (!String(err?.message ?? err).includes('already exists')) throw err
  }

  console.log(`READY postgresql://postgres:postgres@localhost:${PORT}/${DB_NAME}`)

  const shutdown = async () => {
    await pg.stop()
    process.exit(0)
  }
  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)

  // Keep the process alive — embedded-postgres stops the server when its
  // owning process exits.
  await new Promise(() => {})
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
