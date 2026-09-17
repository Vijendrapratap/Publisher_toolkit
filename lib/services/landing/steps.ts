import type { StepItem } from '@/components/platform/Stepper'

export type LandingStepKey = 'upload' | 'configure' | 'generate' | 'results'

export const LANDING_STEPS: { key: LandingStepKey; label: string }[] = [
  { key: 'upload', label: 'Upload' },
  { key: 'configure', label: 'Configure' },
  { key: 'generate', label: 'Publish' },
  { key: 'results', label: 'Results' },
]

export function stepHref(projectId: string, step: LandingStepKey): string {
  return `/landing/${projectId}/${step}`
}

export function resumeStep(status: string, hasPublished: boolean): LandingStepKey {
  if (status === 'generated' && hasPublished) return 'results'
  if (status === 'configured') return 'configure'
  return 'upload'
}

export function buildStepItems(
  projectId: string,
  status: string,
  hasPublished: boolean
): StepItem[] {
  const configured = status === 'configured' || status === 'generated'
  const generated = status === 'generated' && hasPublished
  const state: Record<LandingStepKey, { complete: boolean; reachable: boolean }> = {
    upload: { complete: true, reachable: true },
    configure: { complete: configured, reachable: true },
    generate: { complete: generated, reachable: configured },
    results: { complete: false, reachable: hasPublished },
  }
  return LANDING_STEPS.map((s) => ({
    ...s,
    href: stepHref(projectId, s.key),
    ...state[s.key],
  }))
}

export function statusDisplay(status: string): {
  label: string
  tone: 'neutral' | 'accent' | 'success'
} {
  if (status === 'generated') return { label: 'Site published', tone: 'success' }
  if (status === 'configured') return { label: 'Ready to publish', tone: 'accent' }
  return { label: 'Needs setup', tone: 'neutral' }
}
