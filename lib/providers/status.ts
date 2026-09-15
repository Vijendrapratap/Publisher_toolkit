import { isClerkConfigured } from './auth'
import { isAiConfigured } from './ai'

export type CapabilityMode = 'real' | 'local'

export interface CapabilityStatus {
  auth: CapabilityMode
  storage: CapabilityMode
  ai: CapabilityMode
  adsPush: CapabilityMode
}

const mode = (real: boolean): CapabilityMode => (real ? 'real' : 'local')

export function getCapabilityStatus(): CapabilityStatus {
  return {
    auth: mode(isClerkConfigured()),
    storage: mode(Boolean(process.env.BLOB_READ_WRITE_TOKEN)),
    ai: mode(isAiConfigured()),
    adsPush: 'local',
  }
}

export function isFullyLocal(status: CapabilityStatus): boolean {
  return Object.values(status).every((m) => m === 'local')
}
