import { makeSteps } from '@/lib/services/shared/steps'

export const { steps: ADS_STEPS, stepHref, resumeStep, buildStepItems, statusDisplay } = makeSteps({
  basePath: '/ads',
  ready: 'Creatives ready',
})
