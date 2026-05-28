import { describe, it, expect } from 'vitest'
import { fileToBase64 } from '@/utils/image'

describe('fileToBase64', () => {
  it('converts File to base64 data URL', async () => {
    const file = new File(['hello'], 'test.txt', { type: 'text/plain' })
    const result = await fileToBase64(file)
    expect(result).toMatch(/^data:text\/plain;base64,/)
  })

  it('handles empty file', async () => {
    const file = new File([], 'empty.txt', { type: 'text/plain' })
    const result = await fileToBase64(file)
    expect(result).toBe('data:text/plain;base64,')
  })
})
