export const formatDate = (
  timestamp: number,
  use24h: boolean = true
): string => {
  const date = new Date(timestamp)
  return date.toLocaleString('en-US', {
    day: 'numeric',
    hour: '2-digit',
    hour12: !use24h,
    minute: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}
