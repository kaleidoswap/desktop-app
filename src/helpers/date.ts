export const formatDate = (timestamp: number): string => {
  const date = new Date(timestamp)
  return date.toLocaleString('en-US', {
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}
