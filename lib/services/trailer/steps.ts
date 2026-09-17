import type { StepItem } from '@/components/platform/Stepper'

export type TrailerStepKey = 'upload' | 'configure' | 'generate' | 'results'

export const TRAILER_STEPS: { key: TrailerStepKey; label: string }[] = [
  { key: 'upload', label: 'Upload' },
  { key: 'configure', label: 'Configure' },
  { key: 'generate', label: 'Generate' },
  { key: 'results', label: 'Results' },
]

export function stepHref(projectId: string, step: TrailerStepKey): string {
  return `/trailer/${projectId}/${step}`
}

export function resumeStep(status: string, hasTrailers: boolean): TrailerStepKey {
  if (status === 'generated' && hasTrailers) return 'results'
  if (status === 'configured') return 'configure'
  return 'upload'
}

export function buildStepItems(projectId: string, status: string, hasTrailers: boolean): StepItem[] {
  const configured = status === 'configured' || status === 'generated'
  const generated = status === 'generated' && hasTrailers
  const state: Record<TrailerStepKey, { complete: boolean; reachable: boolean }> = {
    upload: { complete: true, reachable: true },
    configure: { complete: configured, reachable: true },
    generate: { complete: generated, reachable: configured },
    results: { complete: false, reachable: hasTrailers },
  }
  return TRAILER_STEPS.map((s) => ({ ...s, href: stepHref(projectId, s.key), ...state[s.key] }))
}

export function statusDisplay(status: string): { label: string; tone: 'neutral' | 'accent' | 'success' } {
  if (status === 'generated') return { label: 'Trailers ready', tone: 'success' }
  if (status === 'configured') return { label: 'Ready to generate', tone: 'accent' }
  return { label: 'Needs setup', tone: 'neutral' }
}
