import { makeSteps } from '@/lib/services/shared/steps'

export const { steps: AUDIOBOOK_STEPS, stepHref, resumeStep, buildStepItems, statusDisplay } = makeSteps({
  basePath: '/audiobook',
  ready: 'Audiobook ready',
  readyToRun: 'Ready to synthesize',
})
