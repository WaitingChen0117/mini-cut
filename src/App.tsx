import { useState, useCallback, useRef } from 'react'
import { Toolbar } from '@/components/Toolbar'
import { PreviewPanel } from '@/components/PreviewPanel'
import { Timeline } from '@/components/Timeline'
import { LeftPanel } from '@/components/LeftPanel'
import { PropertiesPanel } from '@/components/PropertiesPanel'
import { TextOverlay } from '@/components/TextOverlay'
import { useEditorStore } from '@/store/editorStore'
import styles from './App.module.css'

const MIN_PANEL_W = 140
const MIN_TIMELINE_H = 80
const TOOLBAR_H = 56 // Toolbar(48) + divider(8)
const MAX_TIMELINE_H = Math.round((window.innerHeight - TOOLBAR_H) * 0.7)

export function App() {
  const [showTextOverlay, setShowTextOverlay] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [exportProgress, setExportProgress] = useState(0)
  const { tracks, totalDuration } = useEditorStore()

  // Panel sizes — initialised to equal thirds (minus 2×8px dividers)
  const [leftWidth, setLeftWidth] = useState<number | null>(() =>
    Math.round((window.innerWidth - 16) / 3)
  )
  const [rightWidth, setRightWidth] = useState<number | null>(() =>
    Math.round((window.innerWidth - 16) / 3)
  )
  const [timelineHeight, setTimelineHeight] = useState(() =>
    Math.round((window.innerHeight - TOOLBAR_H) * 0.45)
  )

  const appMainRef = useRef<HTMLDivElement>(null)

  const vDragRef = useRef<{
    side: 'left' | 'right'
    startX: number
    startW: number
    otherW: number
    totalW: number
  } | null>(null)

  const hDragRef = useRef<{ startY: number; startH: number } | null>(null)

  const handleVDown = useCallback(
    (e: React.PointerEvent, side: 'left' | 'right') => {
      e.preventDefault()
      e.currentTarget.setPointerCapture(e.pointerId)
      const main = appMainRef.current
      if (!main) return
      const totalW = main.offsetWidth
      const curLeft = leftWidth ?? totalW / 3
      const curRight = rightWidth ?? totalW / 3
      vDragRef.current = {
        side, startX: e.clientX,
        startW: side === 'left' ? curLeft : curRight,
        otherW: side === 'left' ? curRight : curLeft,
        totalW,
      }
    },
    [leftWidth, rightWidth],
  )

  const handleVMove = useCallback((e: React.PointerEvent) => {
    const d = vDragRef.current
    if (!d) return
    const dx = (e.clientX - d.startX) * (d.side === 'left' ? 1 : -1)
    const newW = Math.max(
      MIN_PANEL_W,
      Math.min(d.startW + dx, d.totalW - d.otherW - MIN_PANEL_W - 8),
    )
    if (d.side === 'left') setLeftWidth(newW)
    else setRightWidth(newW)
  }, [])

  const handleVUp = useCallback(() => { vDragRef.current = null }, [])

  const handleHDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault()
    e.currentTarget.setPointerCapture(e.pointerId)
    hDragRef.current = { startY: e.clientY, startH: timelineHeight }
  }, [timelineHeight])

  const handleHMove = useCallback((e: React.PointerEvent) => {
    const d = hDragRef.current
    if (!d) return
    const newH = Math.max(MIN_TIMELINE_H, Math.min(d.startH + (d.startY - e.clientY), MAX_TIMELINE_H))
    setTimelineHeight(newH)
  }, [])

  const handleHUp = useCallback(() => { hDragRef.current = null }, [])

  const handleExport = useCallback(async () => {
    if (tracks.length === 0) return
    setExporting(true)
    setExportProgress(0)
    try {
      const canvas = document.querySelector('canvas') as HTMLCanvasElement
      if (!canvas) return
      const stream = canvas.captureStream(30)
      const recorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
          ? 'video/webm;codecs=vp9'
          : 'video/webm',
      })
      const chunks: Blob[] = []
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data) }
      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'video/webm' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url; a.download = 'minicut-export.webm'; a.click()
        URL.revokeObjectURL(url)
        setExporting(false); setExportProgress(0)
      }
      recorder.start()
      const { setCurrentTime, setIsPlaying } = useEditorStore.getState()
      setCurrentTime(0); setIsPlaying(true)
      const duration = totalDuration * 1000
      const startAt = Date.now()
      const ticker = setInterval(() => {
        const elapsed = Date.now() - startAt
        setExportProgress(Math.min(elapsed / duration, 1))
        if (elapsed >= duration) { clearInterval(ticker); setIsPlaying(false); recorder.stop() }
      }, 100)
    } catch { setExporting(false) }
  }, [tracks, totalDuration])

  return (
    <div className={styles.app}>
      <Toolbar onExport={handleExport} />

      <div ref={appMainRef} className={styles.app__main}>
        <div
          className={styles.app__sidebar_left}
          style={leftWidth != null ? { width: leftWidth } : undefined}
        >
          <LeftPanel />
        </div>

        <div
          className={styles.app__divider_v}
          onPointerDown={(e) => handleVDown(e, 'left')}
          onPointerMove={handleVMove}
          onPointerUp={handleVUp}
        />

        <div className={styles.app__center}>
          <PreviewPanel />
        </div>

        <div
          className={styles.app__divider_v}
          onPointerDown={(e) => handleVDown(e, 'right')}
          onPointerMove={handleVMove}
          onPointerUp={handleVUp}
        />

        <div
          className={styles.app__sidebar_right}
          style={rightWidth != null ? { width: rightWidth } : undefined}
        >
          <PropertiesPanel />
        </div>
      </div>

      <div
        className={styles.app__divider_h}
        onPointerDown={handleHDown}
        onPointerMove={handleHMove}
        onPointerUp={handleHUp}
      />

      <div className={styles.app__timeline} style={{ height: timelineHeight }}>
        <Timeline />
      </div>

      {showTextOverlay && <TextOverlay onClose={() => setShowTextOverlay(false)} />}
      {exporting && (
        <div className={styles.app__export_overlay}>
          <div>正在导出视频...</div>
          <div className={styles.app__export_progress}>
            <div
              className={styles.app__export_progress_fill}
              style={{ width: `${exportProgress * 100}%` }}
            />
          </div>
          <div style={{ fontSize: 13, color: '#8a9bbf' }}>
            {Math.round(exportProgress * 100)}% 完成
          </div>
        </div>
      )}
    </div>
  )
}
