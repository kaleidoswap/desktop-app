import { expect, it } from 'vitest'
import { preserveReplyFormatting } from '../reply-formatting'
it('keeps streamed Markdown when final text has the same content', () => {
  expect(
    preserveReplyFormatting('**Balance**\n- 10 sats', 'Balance\n10 sats')
  ).toBe('**Balance**\n- 10 sats')
})
it('uses a corrected final answer instead of stale streamed content', () => {
  expect(preserveReplyFormatting('**10 sats**', '20 sats')).toBe('20 sats')
})
it('renders final-only responses unchanged', () => {
  expect(preserveReplyFormatting('', '**Hello**')).toBe('**Hello**')
})
