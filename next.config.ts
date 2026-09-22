import type { NextConfig } from 'next'
const config: NextConfig = {
  serverExternalPackages: ['@napi-rs/canvas', '@remotion/renderer', '@remotion/bundler'],
}
export default config
