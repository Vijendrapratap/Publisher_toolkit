import { makeSteps } from '@/lib/services/shared/steps'

export const { steps: TRAILER_STEPS, stepHref, resumeStep, buildStepItems, statusDisplay } = makeSteps({
  basePath: '/trailer',
  ready: 'Trailers ready',
})
