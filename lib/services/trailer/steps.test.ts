import { describe, it, expect } from 'vitest'
import {
  TRAILER_STEPS,
  stepHref,
  resumeStep,
  buildStepItems,
  statusDisplay,
} from './steps'

describe('trailer steps', () => {
  it('defines 4 canonical steps in order', () => {
    expect(TRAILER_STEPS.map((s) => s.key)).toEqual([
      'upload',
      'configure',
      'generate',
      'results',
    ])
  })

  it('builds step hrefs pointing to /trailer/[id]/[step]', () => {
    expect(stepHref('proj_1', 'upload')).toBe('/trailer/proj_1/upload')
    expect(stepHref('proj_1', 'results')).toBe('/trailer/proj_1/results')
  })

  it('determines the correct resume step based on status and trailers', () => {
    expect(resumeStep('uploaded', false)).toBe('upload')
    expect(resumeStep('configured', false)).toBe('configure')
    expect(resumeStep('generated', true)).toBe('results')
    expect(resumeStep('generated', false)).toBe('upload')
  })

  it('builds step items with correct complete and reachable flags', () => {
    const fresh = buildStepItems('proj_1', 'uploaded', false)
    expect(fresh.find((s) => s.key === 'upload')).toEqual(
      expect.objectContaining({ complete: true, reachable: true })
    )
    expect(fresh.find((s) => s.key === 'configure')).toEqual(
      expect.objectContaining({ complete: false, reachable: true })
    )
    expect(fresh.find((s) => s.key === 'generate')).toEqual(
      expect.objectContaining({ complete: false, reachable: false })
    )
    expect(fresh.find((s) => s.key === 'results')).toEqual(
      expect.objectContaining({ complete: false, reachable: false })
    )

    const generated = buildStepItems('proj_1', 'generated', true)
    expect(generated.find((s) => s.key === 'generate')).toEqual(
      expect.objectContaining({ complete: true, reachable: true })
    )
    expect(generated.find((s) => s.key === 'results')).toEqual(
      expect.objectContaining({ complete: false, reachable: true })
    )
  })

  it('returns human-readable status display labels and tones', () => {
    expect(statusDisplay('generated')).toEqual({ label: 'Trailers ready', tone: 'success' })
    expect(statusDisplay('configured')).toEqual({ label: 'Ready to generate', tone: 'accent' })
    expect(statusDisplay('uploaded')).toEqual({ label: 'Needs setup', tone: 'neutral' })
  })
})
