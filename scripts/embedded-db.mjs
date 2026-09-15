import { existsSync } from 'node:fs'
import net from 'node:net'
import EmbeddedPostgres from 'embedded-postgres'

export const PG_PORT = 5432
const DATA_DIR = new URL('../.pgdata', import.meta.url).pathname

export function isPortOpen(port, host = '127.0.0.1') {
  return new Promise((resolve) => {
    const socket = net.connect({ port, host })
    socket.once('connect', () => { socket.destroy(); resolve(true) })
    socket.once('error', () => resolve(false))
  })
}

// Starts (or reuses) the local Postgres on PG_PORT and makes sure each named
// database exists. Data persists in .pgdata/ (gitignored).
export async function startEmbeddedDb(databases) {
  const pg = new EmbeddedPostgres({
    databaseDir: DATA_DIR,
    user: 'postgres',
    password: 'postgres',
    port: PG_PORT,
    persistent: true,
  })

  const alreadyRunning = await isPortOpen(PG_PORT)
  if (!alreadyRunning) {
    if (!existsSync(`${DATA_DIR}/PG_VERSION`)) await pg.initialise()
    await pg.start()
  }

  // Use a raw client rather than pg.createDatabase(): that method guards on
  // this.process, which is only set when *this* instance called start() —
  // it throws when reusing an already-running server (the shared-Postgres
  // path), even though the server is reachable. getPgClient() is the same
  // public helper createDatabase() uses internally, without that guard.
  for (const name of databases) {
    const client = pg.getPgClient()
    try {
      await client.connect()
      await client.query(`CREATE DATABASE "${name}"`)
    } catch (err) {
      if (!String(err?.message ?? err).includes('already exists')) throw err
    } finally {
      await client.end().catch(() => {})
    }
  }

  return { stop: alreadyRunning ? async () => {} : () => pg.stop() }
}
