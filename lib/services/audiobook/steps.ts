import type { StepItem } from '@/components/platform/Stepper'

export type AudiobookStepKey = 'upload' | 'configure' | 'generate' | 'results'

export const AUDIOBOOK_STEPS: { key: AudiobookStepKey; label: string }[] = [
  { key: 'upload', label: 'Upload' },
  { key: 'configure', label: 'Configure' },
  { key: 'generate', label: 'Generate' },
  { key: 'results', label: 'Results' },
]

export function stepHref(projectId: string, step: AudiobookStepKey): string {
  return `/audiobook/${projectId}/${step}`
}

export function resumeStep(status: string, hasAudio: boolean): AudiobookStepKey {
  if (status === 'generated' && hasAudio) return 'results'
  if (status === 'configured') return 'configure'
  return 'upload'
}

export function buildStepItems(
  projectId: string,
  status: string,
  hasAudio: boolean
): StepItem[] {
  const configured = status === 'configured' || status === 'generated'
  const generated = status === 'generated' && hasAudio
  const state: Record<AudiobookStepKey, { complete: boolean; reachable: boolean }> = {
    upload: { complete: true, reachable: true },
    configure: { complete: configured, reachable: true },
    generate: { complete: generated, reachable: configured },
    results: { complete: false, reachable: hasAudio },
  }
  return AUDIOBOOK_STEPS.map((s) => ({
    ...s,
    href: stepHref(projectId, s.key),
    ...state[s.key],
  }))
}

export function statusDisplay(status: string): {
  label: string
  tone: 'neutral' | 'accent' | 'success'
} {
  if (status === 'generated') return { label: 'Audiobook ready', tone: 'success' }
  if (status === 'configured') return { label: 'Ready to synthesize', tone: 'accent' }
  return { label: 'Needs setup', tone: 'neutral' }
}
