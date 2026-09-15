import type { StepItem } from '@/components/platform/Stepper'

export type AdsStepKey = 'upload' | 'configure' | 'generate' | 'results'

export const ADS_STEPS: { key: AdsStepKey; label: string }[] = [
  { key: 'upload', label: 'Upload' },
  { key: 'configure', label: 'Configure' },
  { key: 'generate', label: 'Generate' },
  { key: 'results', label: 'Results' },
]

export function stepHref(projectId: string, step: AdsStepKey): string {
  return `/ads/${projectId}/${step}`
}

export function resumeStep(status: string, hasCreativeSet: boolean): AdsStepKey {
  if (status === 'generated' && hasCreativeSet) return 'results'
  if (status === 'configured') return 'configure'
  return 'upload'
}

export function buildStepItems(projectId: string, status: string, hasCreativeSet: boolean): StepItem[] {
  const configured = status === 'configured' || status === 'generated'
  const generated = status === 'generated' && hasCreativeSet
  const state: Record<AdsStepKey, { complete: boolean; reachable: boolean }> = {
    upload: { complete: true, reachable: true },
    configure: { complete: configured, reachable: true },
    generate: { complete: generated, reachable: configured },
    results: { complete: false, reachable: hasCreativeSet },
  }
  return ADS_STEPS.map((s) => ({ ...s, href: stepHref(projectId, s.key), ...state[s.key] }))
}

export function statusDisplay(status: string): { label: string; tone: 'neutral' | 'accent' | 'success' } {
  if (status === 'generated') return { label: 'Creatives ready', tone: 'success' }
  if (status === 'configured') return { label: 'Ready to generate', tone: 'accent' }
  return { label: 'Needs setup', tone: 'neutral' }
}
