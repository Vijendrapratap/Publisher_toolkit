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

// detached so `next` (and npx) leads its own process group — next dev spawns
// a next-server and turbopack workers that don't die with their immediate
// parent, so shutdown has to signal the whole group, not just this child.
const next = spawn('npx', ['next', 'dev', ...process.argv.slice(2)], {
  stdio: 'inherit',
  env,
  detached: true,
})

let stopping = false
const shutdown = async (code) => {
  if (stopping) return
  stopping = true
  try {
    process.kill(-next.pid, 'SIGTERM')
  } catch {
    // Group already gone — nothing to signal.
  }
  await stop()
  process.exit(code ?? 0)
}
process.on('SIGINT', () => shutdown(0))
process.on('SIGTERM', () => shutdown(0))
next.on('exit', (code) => shutdown(code ?? 0))
