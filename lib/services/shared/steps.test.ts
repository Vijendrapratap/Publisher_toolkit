import { describe, it, expect } from 'vitest'
import { makeSteps, statusDisplay } from './steps'
import { statusDisplay as adsStatus } from '../ads/steps'
import { statusDisplay as trailerStatus } from '../trailer/steps'
import { statusDisplay as landingStatus, LANDING_STEPS } from '../landing/steps'

const ads = makeSteps({ basePath: '/ads', ready: 'Creatives ready' })

describe('makeSteps', () => {
  it('builds hrefs under the service base path', () => {
    expect(ads.stepHref('p1', 'configure')).toBe('/ads/p1/configure')
    expect(makeSteps({ basePath: '/trailer', ready: 'x' }).stepHref('p1', 'results')).toBe(
      '/trailer/p1/results'
    )
  })

  it('resumes where the publisher left off', () => {
    expect(ads.resumeStep('uploaded', false)).toBe('upload')
    expect(ads.resumeStep('configured', false)).toBe('configure')
    expect(ads.resumeStep('generated', true)).toBe('results')
    // Generated status without stored output must not strand them on results.
    expect(ads.resumeStep('generated', false)).toBe('configure')
  })

  it('marks completion and reachability from status', () => {
    expect(ads.buildStepItems('p1', 'uploaded', false).map((s) => [s.key, s.complete, s.reachable])).toEqual([
      ['upload', true, true],
      ['configure', false, true],
      ['generate', false, false],
      ['results', false, false],
    ])

    const generated = ads.buildStepItems('p1', 'generated', true)
    expect(generated.map((s) => s.complete)).toEqual([true, true, true, false])
    expect(generated.every((s) => s.reachable)).toBe(true)
    expect(generated[3].href).toBe('/ads/p1/results')
  })

  it('lets a service rename the generate step without forking the flow', () => {
    expect(LANDING_STEPS.map((s) => s.label)).toEqual(['Upload', 'Configure', 'Publish', 'Results'])
  })
})

describe('statusDisplay', () => {
  it('keeps each service wording its own output', () => {
    expect(adsStatus('generated')).toEqual({ label: 'Creatives ready', tone: 'success' })
    expect(trailerStatus('generated')).toEqual({ label: 'Trailers ready', tone: 'success' })
    expect(landingStatus('generated')).toEqual({ label: 'Site published', tone: 'success' })
    expect(landingStatus('configured')).toEqual({ label: 'Ready to publish', tone: 'accent' })
  })

  it('falls back to neutral wording for a generic caller', () => {
    expect(statusDisplay('uploaded')).toEqual({ label: 'Needs setup', tone: 'neutral' })
    expect(statusDisplay('configured')).toEqual({ label: 'Ready to generate', tone: 'accent' })
  })
})
