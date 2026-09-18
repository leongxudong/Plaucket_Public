import { describe, expect, it } from 'vitest'
import { formatBytes, formatDuration, safeFilename } from '../src/lib/time'

describe('formatDuration', () => {
  it('formats short recordings', () => {
    expect(formatDuration(65.9)).toBe('01:05')
  })

  it('formats meetings over an hour', () => {
    expect(formatDuration(3_661)).toBe('01:01:01')
  })

  it('does not expose negative time', () => {
    expect(formatDuration(-2)).toBe('00:00')
  })
})

describe('safeFilename', () => {
  it('normalizes titles for downloads', () => {
    expect(safeFilename('  Q4 Security / Roadmap!  ')).toBe('q4-security-roadmap')
  })

  it('uses a safe fallback', () => {
    expect(safeFilename('会议')).toBe('meeting')
  })
})

describe('formatBytes', () => {
  it('formats binary file sizes', () => {
    expect(formatBytes(1_048_576)).toBe('1.00 MB')
  })
})
