// Remotion's bundler cannot run inside Next.js, so the video composition is
// bundled once here and the app renders against the static output.
import path from 'node:path'
import { bundle } from '@remotion/bundler'

const root = process.cwd()
const outDir = path.join(root, '.remotion-bundle')

await bundle({
  entryPoint: path.join(root, 'remotion/index.ts'),
  outDir,
  webpackOverride: (config) => ({
    ...config,
    resolve: {
      ...config.resolve,
      alias: { ...(config.resolve?.alias ?? {}), '@': root },
    },
  }),
})

console.log(`Remotion bundle written to ${outDir}`)
