import { useState } from 'react'

export default function OverlayInspector() {
  const [lastReport, setLastReport] = useState<string | null>(null)

  function inspect() {
    try {
      const overlays = Array.from(document.querySelectorAll('[class*="fixed"][class*="inset-0"]')) as HTMLElement[]
      const report = overlays.map(el => {
        const rect = el.getBoundingClientRect()
        const classes = el.className
        return `${el.tagName.toLowerCase()} ${classes} bbox=${Math.round(rect.x)},${Math.round(rect.y)} ${Math.round(rect.width)}x${Math.round(rect.height)}`
      }).join('\n') || 'No full-screen overlays found'
      console.log('[OverlayInspector] overlays:', overlays)
      setLastReport(report)
      return overlays
    } catch (err) {
      console.error('OverlayInspector error', err)
      setLastReport('Error inspecting overlays (see console)')
      return [] as HTMLElement[]
    }
  }

  function disablePointerEvents() {
    const overlays = inspect()
    overlays.forEach(el => {
      // mark element so we can restore later if needed
      if (!el.dataset.__oiOriginalPointer) el.dataset.__oiOriginalPointer = (el.style.pointerEvents || '')
      el.style.pointerEvents = 'none'
      el.style.outline = '2px dashed rgba(220,38,38,0.8)'
    })
    setLastReport(prev => `${prev || ''}\n\nPointer-events disabled on ${overlays.length} overlays`)
  }

  function restorePointerEvents() {
    const overlays = Array.from(document.querySelectorAll('[data-__oi-original-pointer]')) as HTMLElement[]
    overlays.forEach(el => {
      el.style.pointerEvents = el.dataset.__oiOriginalPointer || ''
      el.style.outline = ''
      delete el.dataset.__oiOriginalPointer
    })
    setLastReport(prev => `${prev || ''}\n\nRestored pointer-events on ${overlays.length} overlays`)
  }

  return (
    <div className="fixed bottom-4 right-4 z-[99999]">
      <div className="bg-white/90 border rounded-md p-2 shadow-md text-xs">
        <div className="flex gap-2">
          <button className="px-2 py-1 rounded bg-primary text-white text-[11px]" onClick={inspect}>Inspect overlays</button>
          <button className="px-2 py-1 rounded border text-[11px]" onClick={disablePointerEvents}>Unblock clicks</button>
          <button className="px-2 py-1 rounded border text-[11px]" onClick={restorePointerEvents}>Restore</button>
        </div>
        {lastReport && <pre className="text-[10px] mt-2 whitespace-pre-wrap max-w-xs">{lastReport}</pre>}
      </div>
    </div>
  )
}
