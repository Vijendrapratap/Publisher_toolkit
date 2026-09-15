// One-command local run: database (if needed) → migrations → Next.js.
// Any extra args pass through to `next dev` (e.g. `npm run dev -- --port 3100`).
import { spawn, spawnSync } from 'node:child_process'
import { startEmbeddedDb } from './embedded-db.mjs'

const DEV_DATABASE_URL = 'postgresql://postgres:postgres@localhost:5432/publisher_toolkit_dev'
const env = { ...process.env }
let stop = async () => {}

if (!env.DATABASE_URL) {
  env.DATABASE_URL = DEV_DATABASE_URL
  ;({ stop } = await startEmbeddedDb(['publisher_toolkit_dev']))
}

const migrate = spawnSync('npx', ['prisma', 'migrate', 'deploy'], { stdio: 'inherit', env })
if (migrate.status !== 0) {
  await stop()
  process.exit(migrate.status ?? 1)
}

const next = spawn('npx', ['next', 'dev', ...process.argv.slice(2)], { stdio: 'inherit', env })
const shutdown = async () => {
  next.kill('SIGTERM')
  await stop()
  process.exit(0)
}
process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
next.on('exit', async (code) => {
  await stop()
  process.exit(code ?? 0)
})
