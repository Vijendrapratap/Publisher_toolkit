import { describe, it, expect } from 'vitest'
import { ADS_STEPS, buildStepItems, resumeStep, stepHref, statusDisplay } from './steps'

describe('ads steps', () => {
  it('has the four steps in order', () => {
    expect(ADS_STEPS.map((s) => s.key)).toEqual(['upload', 'configure', 'generate', 'results'])
    expect(stepHref('p1', 'configure')).toBe('/ads/p1/configure')
  })

  it('resumes where the publisher left off', () => {
    expect(resumeStep('uploaded', false)).toBe('upload')
    expect(resumeStep('configured', false)).toBe('configure')
    expect(resumeStep('generated', true)).toBe('results')
    expect(resumeStep('configured', true)).toBe('configure')
  })

  it('marks completion and reachability from status', () => {
    const uploaded = buildStepItems('p1', 'uploaded', false)
    expect(uploaded.map((s) => [s.key, s.complete, s.reachable])).toEqual([
      ['upload', true, true],
      ['configure', false, true],
      ['generate', false, false],
      ['results', false, false],
    ])

    const generated = buildStepItems('p1', 'generated', true)
    expect(generated.map((s) => s.complete)).toEqual([true, true, true, false])
    expect(generated.every((s) => s.reachable)).toBe(true)
    expect(generated[3].href).toBe('/ads/p1/results')
  })

  it('labels statuses for badges', () => {
    expect(statusDisplay('uploaded')).toEqual({ label: 'Needs setup', tone: 'neutral' })
    expect(statusDisplay('configured')).toEqual({ label: 'Ready to generate', tone: 'accent' })
    expect(statusDisplay('generated')).toEqual({ label: 'Creatives ready', tone: 'success' })
  })
})
