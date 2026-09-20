import { makeSteps } from '@/lib/services/shared/steps'

export const { steps: LANDING_STEPS, stepHref, resumeStep, buildStepItems, statusDisplay } = makeSteps({
  basePath: '/landing',
  ready: 'Site published',
  readyToRun: 'Ready to publish',
  generateLabel: 'Publish',
})
