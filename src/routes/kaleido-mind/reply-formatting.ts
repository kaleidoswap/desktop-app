// Some providers return a plain-text final summary of the same streamed answer.
// Keep Markdown only when the visible content agrees; a changed final answer wins.
export function preserveReplyFormatting(
  streamed: string,
  final: string
): string {
  const normalize = (text: string) =>
    text
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .replace(/^[ \t]*(?:#{1,6} |[-*>] |\d+\. )/gm, '')
      .replace(/[*_`~]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
  return streamed && normalize(streamed) === normalize(final) ? streamed : final
}
