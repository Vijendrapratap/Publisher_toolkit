import type { StepItem } from '@/components/platform/Stepper'

export type StepKey = 'upload' | 'configure' | 'generate' | 'results'

export const STEPS: { key: StepKey; label: string }[] = [
  { key: 'upload', label: 'Upload' },
  { key: 'configure', label: 'Configure' },
  { key: 'generate', label: 'Generate' },
  { key: 'results', label: 'Results' },
]

export type StatusTone = 'neutral' | 'accent' | 'success'
export interface StatusBadge {
  label: string
  tone: StatusTone
}

/** Wording each service uses for its own output in the status badge. */
export interface StepConfig {
  basePath: string
  /** Badge text once the output exists, e.g. "Creatives ready". */
  ready: string
  /** Badge text once configured but not yet run, e.g. "Ready to generate". */
  readyToRun?: string
  /** Overrides the third step's label — Landing calls it "Publish". */
  generateLabel?: string
}

export function statusDisplay(status: string, config?: Pick<StepConfig, 'ready' | 'readyToRun'>): StatusBadge {
  if (status === 'generated') return { label: config?.ready ?? 'Ready', tone: 'success' }
  if (status === 'configured') return { label: config?.readyToRun ?? 'Ready to generate', tone: 'accent' }
  return { label: 'Needs setup', tone: 'neutral' }
}

/**
 * Every service walks the same upload → configure → generate → results path and
 * differs only in its URL prefix and what it calls the thing it produced.
 */
export function makeSteps(config: StepConfig) {
  const stepHref = (projectId: string, step: StepKey) => `${config.basePath}/${projectId}/${step}`
  const steps = config.generateLabel
    ? STEPS.map((s) => (s.key === 'generate' ? { ...s, label: config.generateLabel! } : s))
    : STEPS

  return {
    steps,
    stepHref,

    resumeStep(status: string, hasOutput: boolean): StepKey {
      if (status === 'generated' && hasOutput) return 'results'
      // 'generated' with nothing stored means the run failed. They are still
      // configured, so send them back to configure rather than to upload,
      // which would discard the settings they already chose.
      if (status === 'configured' || status === 'generated') return 'configure'
      return 'upload'
    },

    buildStepItems(projectId: string, status: string, hasOutput: boolean): StepItem[] {
      const configured = status === 'configured' || status === 'generated'
      const state: Record<StepKey, { complete: boolean; reachable: boolean }> = {
        upload: { complete: true, reachable: true },
        configure: { complete: configured, reachable: true },
        generate: { complete: status === 'generated' && hasOutput, reachable: configured },
        results: { complete: false, reachable: hasOutput },
      }
      return steps.map((s) => ({ ...s, href: stepHref(projectId, s.key), ...state[s.key] }))
    },

    statusDisplay: (status: string) => statusDisplay(status, config),
  }
}
