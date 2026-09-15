export function timeAgo(date: Date, now: Date = new Date()): string {
  const seconds = Math.round((now.getTime() - date.getTime()) / 1000)
  if (seconds < 60) return 'just now'
  const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' })
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return rtf.format(-minutes, 'minute')
  const hours = Math.round(minutes / 60)
  if (hours < 24) return rtf.format(-hours, 'hour')
  const days = Math.round(hours / 24)
  if (days < 7) return rtf.format(-days, 'day')
  const weeks = Math.round(days / 7)
  if (weeks < 5) return rtf.format(-weeks, 'week')
  return rtf.format(-Math.round(days / 30), 'month')
}
