import { CSSProperties, useEffect, useRef, memo, useMemo } from 'react'

// Move parseAnsi outside component to avoid recreating on every render
const parseAnsi = (log: string) => {
  const segments = []
  // eslint-disable-next-line no-control-regex
  const ansiRegex = /\x1b\[([\d;]*?)m/g
  let lastIndex = 0

  // Color and style mapping
  const colorMap: any = {
    '30': '#666666', // Bright Black
    '31': '#FF6B6B', // Bright Red
    '32': '#69FF94', // Bright Green
    '33': '#FFFF6B', // Bright Yellow
    '34': '#6B6BFF', // Bright Blue
    '35': '#FF6BFF', // Bright Magenta
    '36': '#6BFFFF', // Bright Cyan
    '37': '#FFFFFF', // Bright White
    '90': '#666666', // Dark Gray
    '91': '#FF4136', // Red
    '92': '#2ECC40', // Green
    '93': '#FFDC00', // Yellow
    '94': '#0074D9', // Blue
    '95': '#B10DC9', // Magenta
    '96': '#7FDBFF', // Cyan
    '97': '#F1F3F5', // Light Gray
  }

  // Reset styles between ANSI code matches
  let currentStyle: CSSProperties = {}

  // Iterate through ANSI codes
  let match
  while ((match = ansiRegex.exec(log)) !== null) {
    const codes = match[1].split(';')

    // Add text before this match
    if (match.index > lastIndex) {
      segments.push({
        ...currentStyle,
        text: log.slice(lastIndex, match.index),
      })
    }

    // Process style codes
    codes.forEach((code) => {
      switch (code) {
        case '0': // Reset
          currentStyle = {}
          break
        case '1': // Bold
          currentStyle.fontWeight = 'bold'
          break
        case '3': // Italic
          currentStyle.fontStyle = 'italic'
          break
        case '4': // Underline
          currentStyle.textDecoration = 'underline'
          break
        default:
          // Check if it's a color code
          if (colorMap[code]) {
            currentStyle.color = colorMap[code]
          }
      }
    })

    lastIndex = ansiRegex.lastIndex
  }

  // Add remaining text
  if (lastIndex < log.length) {
    segments.push({
      ...currentStyle,
      text: log.slice(lastIndex),
    })
  }

  return segments
}

// Lines without ANSI colours still get a level tint so errors stand out.
const levelColor = (log: string) => {
  if (log.includes('\x1b[')) return '#94A3B8'
  if (/\b(ERROR|FATAL|PANIC)\b/.test(log)) return '#FF6B6B'
  if (/\bWARN(ING)?\b/.test(log)) return '#FFDC00'
  return '#94A3B8'
}

// Memoize individual log line to prevent unnecessary re-renders
const LogLine = memo(({ log }: { log: string }) => {
  const segments = useMemo(() => parseAnsi(log), [log])
  const fallback = useMemo(() => levelColor(log), [log])

  return (
    <div className="whitespace-pre-wrap py-0.5 font-mono text-xs leading-5 [overflow-wrap:anywhere]">
      {segments.map((segment, segIndex) => (
        <span
          key={segIndex}
          style={{
            color: segment.color || fallback,
            fontStyle: segment.fontStyle || 'normal',
            fontWeight: segment.fontWeight || 'normal',
            textDecoration: segment.textDecoration || 'none',
          }}
        >
          {segment.text}
        </span>
      ))}
    </div>
  )
})

LogLine.displayName = 'LogLine'

// Within this distance of the bottom the view keeps following new lines.
const STICK_THRESHOLD_PX = 40

interface TerminalLogDisplayProps {
  logs: string[]
  /** Follow new lines while the user is at the bottom. */
  follow?: boolean
  /** Called when the user scrolls away from / back to the bottom. */
  onAtBottomChange?: (atBottom: boolean) => void
  /** Bump to scroll to the bottom. */
  scrollToBottomSignal?: number
  className?: string
}

const TerminalLogDisplay = memo(
  ({
    logs,
    follow = true,
    onAtBottomChange,
    scrollToBottomSignal = 0,
    className = '',
  }: TerminalLogDisplayProps) => {
    const containerRef = useRef<HTMLDivElement>(null)
    const atBottom = useRef(true)

    useEffect(() => {
      const el = containerRef.current
      if (el && follow && atBottom.current) el.scrollTop = el.scrollHeight
    }, [logs, follow])

    useEffect(() => {
      const el = containerRef.current
      if (el && scrollToBottomSignal > 0) el.scrollTop = el.scrollHeight
    }, [scrollToBottomSignal])

    return (
      <div
        className={`h-full select-text overflow-y-auto px-4 py-3 ${className}`}
        onScroll={(e) => {
          const el = e.currentTarget
          const next =
            el.scrollHeight - el.scrollTop - el.clientHeight <
            STICK_THRESHOLD_PX
          if (next !== atBottom.current) {
            atBottom.current = next
            onAtBottomChange?.(next)
          }
        }}
        ref={containerRef}
        style={{
          scrollbarColor: '#4B5563 transparent',
          scrollbarWidth: 'thin',
        }}
      >
        {logs.map((log, index) => (
          <LogLine key={`${index}-${log.slice(0, 20)}`} log={log} />
        ))}
      </div>
    )
  }
)

TerminalLogDisplay.displayName = 'TerminalLogDisplay'

export { TerminalLogDisplay }
