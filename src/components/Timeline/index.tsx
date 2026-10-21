import { useRef, useEffect, useState, useCallback, useMemo } from 'react'
import { useEditorStore } from '@/store/editorStore'
import { clamp, formatTimecode } from '@/utils/time'
import styles from './Timeline.module.css'

const BASE_PX_PER_SEC = 80
const MIN_DURATION = 0.5
const LABEL_W = 60
const SNAP_PX = 8
const ROW_H = 52

type DragSection =
  | { kind: 'video'; rowIdx: number }
  | { kind: 'text'; rowIdx: number }
  | { kind: 'video-new' }

interface DragState {
  type: 'move' | 'resize-left' | 'resize-right' | 'playhead' | 'text-move' | 'text-resize-left' | 'text-resize-right'
  itemId: string
  startX: number
  origStart: number
  origEnd: number
  origClipStart: number
  origClipEnd: number
  clipDuration: number
  currentTrackIndex: number
  origTrackIndex: number
  pendingStart: number
}

export function Timeline() {
  const {
    tracks, mediaList, textItems, currentTime, totalDuration, selectedItemId, selectedTextId,
    updateTrackItem, removeTrackItem, addTrackItem, setCurrentTime,
    setSelectedItemId, setSelectedTextId, updateTextItem, setLibraryPreviewMediaId,
    libraryPreviewMediaId, splitAtTime,
  } = useEditorStore()

  const [isDragOver, setIsDragOver] = useState(false)
  const [libDragSection, setLibDragSection] = useState<DragSection | null>(null)
  const [draggingItemId, setDraggingItemId] = useState<string | null>(null)
  const [dragPlaceholder, setDragPlaceholder] = useState<{
    trackIndex: number; startTime: number; endTime: number; kind: 'video' | 'text'
  } | null>(null)
  const [ghostPos, setGhostPos] = useState<{ left: number; top: number } | null>(null)
  // Rows captured at drag-start — keeps source row visible while clip is being dragged away
  const [dragStartVideoRows, setDragStartVideoRows] = useState<number[] | null>(null)
  const [dragStartTextRows, setDragStartTextRows] = useState<number[] | null>(null)
  // Guide line shown during drag: y position + intent (swap | new-track)
  const [dragGuide, setDragGuide] = useState<{ y: number; intent: 'swap' | 'new-track' } | null>(null)
  // Vertical snap guide: time value of the snapped edge (null = no snap)
  const [snapGuideTime, setSnapGuideTime] = useState<number | null>(null)

  const [zoom, setZoom] = useState(1)
  const PX_PER_SEC = BASE_PX_PER_SEC * zoom
  const SNAP_S = SNAP_PX / PX_PER_SEC

  const dragRef = useRef<DragState | null>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const tracksScrollRef = useRef<HTMLDivElement>(null)
  const rulerScrollRef = useRef<HTMLDivElement>(null)
  const [containerWidth, setContainerWidth] = useState(800)

  // Sorted unique trackIndex values — only rows with clips
  const videoTrackIndices = useMemo(
    () => [...new Set(tracks.map((t) => t.trackIndex))].sort((a, b) => a - b),
    [tracks],
  )
  const textTrackIndices = useMemo(
    () => [...new Set(textItems.map((t) => t.trackIndex))].sort((a, b) => a - b),
    [textItems],
  )

  // During drag: keep all rows from drag-start visible even if they become empty
  const displayVideoRows = useMemo(() => {
    if (!dragStartVideoRows) return videoTrackIndices
    const all = new Set([...videoTrackIndices, ...dragStartVideoRows])
    return [...all].sort((a, b) => a - b)
  }, [videoTrackIndices, dragStartVideoRows])

  const displayTextRows = useMemo(() => {
    if (!dragStartTextRows) return textTrackIndices
    const all = new Set([...textTrackIndices, ...dragStartTextRows])
    return [...all].sort((a, b) => a - b)
  }, [textTrackIndices, dragStartTextRows])

  // Stable refs for event handlers
  const videoTrackIndicesRef = useRef(videoTrackIndices)
  videoTrackIndicesRef.current = videoTrackIndices
  const textTrackIndicesRef = useRef(textTrackIndices)
  textTrackIndicesRef.current = textTrackIndices
  const displayVideoRowsRef = useRef(displayVideoRows)
  displayVideoRowsRef.current = displayVideoRows
  const displayTextRowsRef = useRef(displayTextRows)
  displayTextRowsRef.current = displayTextRows
  const dragStartVideoRowsRef = useRef<number[] | null>(null)
  dragStartVideoRowsRef.current = dragStartVideoRows
  const dragStartTextRowsRef = useRef<number[] | null>(null)
  dragStartTextRowsRef.current = dragStartTextRows
  const pxPerSecRef = useRef(PX_PER_SEC)
  pxPerSecRef.current = PX_PER_SEC

  useEffect(() => {
    const el = tracksScrollRef.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) => {
      setContainerWidth(Math.floor(entry.contentRect.width) - LABEL_W)
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const contentWidth = Math.max(totalDuration * PX_PER_SEC + 200, containerWidth)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    canvas.width = contentWidth
    canvas.height = 24
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.fillStyle = '#0a0e18'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.strokeStyle = '#2a3a5a'
    ctx.fillStyle = '#4a5a7a'
    ctx.font = '10px monospace'
    ctx.textAlign = 'center'
    const minLabelPx = 60
    let labelInterval = 1
    for (const n of [1, 2, 5, 10, 15, 30, 60]) {
      if (n * PX_PER_SEC >= minLabelPx) { labelInterval = n; break }
    }
    const totalSecs = Math.ceil(canvas.width / PX_PER_SEC) + 1
    for (let i = 0; i <= totalSecs; i++) {
      const x = i * PX_PER_SEC
      const isLabel = i % labelInterval === 0
      ctx.beginPath(); ctx.moveTo(x, isLabel ? 0 : canvas.height * 0.6); ctx.lineTo(x, canvas.height); ctx.stroke()
      if (isLabel) ctx.fillText(formatTimecode(i), x, canvas.height - 3)
    }
  }, [contentWidth])

  const getMedia = (mediaId: string) => mediaList.find((m) => m.id === mediaId)

  const getSnapPoints = (excludeId: string): number[] => {
    const pts = new Set<number>([0])
    tracks.forEach((t) => { if (t.id !== excludeId) { pts.add(t.startTime); pts.add(t.endTime) } })
    textItems.forEach((t) => { if (t.id !== excludeId) { pts.add(t.startTime); pts.add(t.endTime) } })
    return Array.from(pts)
  }

  const snapTo = (t: number, pts: number[]): number => {
    let best = t; let bestDist = SNAP_S
    for (const p of pts) { const d = Math.abs(t - p); if (d < bestDist) { bestDist = d; best = p } }
    return best
  }

  // Map clientY → section using stable rows from drag-start (or current if no drag)
  const getSectionFromY = useCallback((
    clientY: number,
    draggingVideo: boolean,
    useStable = true,
  ): DragSection | null => {
    const el = tracksScrollRef.current
    if (!el) return null
    const rect = el.getBoundingClientRect()
    const relY = clientY - rect.top + el.scrollTop

    const stableVideo = useStable
      ? (dragStartVideoRowsRef.current ?? videoTrackIndicesRef.current)
      : videoTrackIndicesRef.current
    const stableText = useStable
      ? (dragStartTextRowsRef.current ?? textTrackIndicesRef.current)
      : textTrackIndicesRef.current

    const vRows = stableVideo.length
    const tRows = stableText.length
    // Text rows sit above video rows
    const textH = tRows * ROW_H

    if (relY < tRows * ROW_H) {
      return { kind: 'text', rowIdx: clamp(Math.floor(relY / ROW_H), 0, Math.max(tRows - 1, 0)) }
    }

    const videoRelY = relY - textH
    if (videoRelY >= 0 && videoRelY < vRows * ROW_H) {
      return { kind: 'video', rowIdx: clamp(Math.floor(videoRelY / ROW_H), 0, Math.max(vRows - 1, 0)) }
    }
    if (draggingVideo && videoRelY >= 0 && videoRelY < (vRows + 1) * ROW_H) {
      return { kind: 'video-new' }
    }
    return null
  }, [])

  const handleTracksScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    if (rulerScrollRef.current) rulerScrollRef.current.scrollLeft = e.currentTarget.scrollLeft
  }, [])

  const handlePointerDown = (e: React.PointerEvent, itemId: string, type: DragState['type']) => {
    e.stopPropagation()
    e.currentTarget.setPointerCapture(e.pointerId)

    if (type === 'playhead') {
      setLibraryPreviewMediaId(null)
      dragRef.current = { type, itemId: '', startX: e.clientX, origStart: currentTime, origEnd: 0, origClipStart: 0, origClipEnd: 0, clipDuration: 0, currentTrackIndex: 0, origTrackIndex: 0, pendingStart: 0 }
      return
    }

    if (type === 'text-move' || type === 'text-resize-left' || type === 'text-resize-right') {
      setLibraryPreviewMediaId(null)
      const item = textItems.find((t) => t.id === itemId)
      if (!item) return
      setSelectedTextId(itemId)
      if (type === 'text-move') {
        setDraggingItemId(itemId)
        setDragPlaceholder({ trackIndex: item.trackIndex, startTime: item.startTime, endTime: item.endTime, kind: 'text' })
      }
      const rows = [...textTrackIndicesRef.current]
      setDragStartTextRows(rows)
      dragStartTextRowsRef.current = rows
      dragRef.current = { type, itemId, startX: e.clientX, origStart: item.startTime, origEnd: item.endTime, origClipStart: 0, origClipEnd: 0, clipDuration: 0, currentTrackIndex: item.trackIndex, origTrackIndex: item.trackIndex, pendingStart: item.startTime }
      return
    }

    const track = tracks.find((t) => t.id === itemId)
    if (!track) return
    setLibraryPreviewMediaId(null)
    setSelectedItemId(itemId)
    if (type === 'move') {
      setDraggingItemId(itemId)
      setDragPlaceholder({ trackIndex: track.trackIndex, startTime: track.startTime, endTime: track.endTime, kind: 'video' })
    }
    const rows = [...videoTrackIndicesRef.current]
    setDragStartVideoRows(rows)
    dragStartVideoRowsRef.current = rows
    dragRef.current = { type, itemId, startX: e.clientX, origStart: track.startTime, origEnd: track.endTime, origClipStart: track.clipStart, origClipEnd: track.clipEnd, clipDuration: track.clipEnd - track.clipStart, currentTrackIndex: track.trackIndex, origTrackIndex: track.trackIndex, pendingStart: track.startTime }
  }

  const handlePointerMove = (e: React.PointerEvent) => {
    const d = dragRef.current
    if (!d) return
    const dt = (e.clientX - d.startX) / PX_PER_SEC

    if (d.type === 'playhead') {
      setCurrentTime(clamp(d.origStart + dt, 0, totalDuration))
      return
    }

    if (d.type === 'text-move') {
      const pts = getSnapPoints(d.itemId)
      const dur = d.origEnd - d.origStart
      let newStart = clamp(d.origStart + dt, 0, Infinity)
      const ss = snapTo(newStart, pts); const se = snapTo(newStart + dur, pts)
      if (ss !== newStart) { newStart = ss; setSnapGuideTime(ss) }
      else if (se !== newStart + dur) { newStart = se - dur; setSnapGuideTime(se) }
      else { setSnapGuideTime(null) }

      // Track from Y — free move, no collision check during drag
      const section = getSectionFromY(e.clientY, false)
      const stableRows = dragStartTextRowsRef.current ?? textTrackIndicesRef.current

      // Detect "text-new" zone: the one row slot directly below all text rows
      const tracksEl = tracksScrollRef.current
      let isTextNew = false
      if (tracksEl) {
        const rect = tracksEl.getBoundingClientRect()
        const relY = e.clientY - rect.top + tracksEl.scrollTop
        isTextNew = relY >= stableRows.length * ROW_H && relY < (stableRows.length + 1) * ROW_H
      }

      let newTrackIndex = d.currentTrackIndex
      if (section?.kind === 'text') {
        newTrackIndex = stableRows[section.rowIdx] ?? d.currentTrackIndex
      } else if (isTextNew) {
        newTrackIndex = (stableRows[stableRows.length - 1] ?? -1) + 1
      }
      d.currentTrackIndex = newTrackIndex
      d.pendingStart = newStart

      // Update ghost position — follows mouse freely, no store update during drag
      const tracksEl2 = tracksScrollRef.current
      if (tracksEl2) {
        const rect2 = tracksEl2.getBoundingClientRect()
        const relY2 = e.clientY - rect2.top + tracksEl2.scrollTop
        setGhostPos({ left: LABEL_W + newStart * PX_PER_SEC, top: relY2 - 21 })
      }

      // Guide: direction-aware, distinguishes same-track swap / cross-track / new-track
      const latestT = useEditorStore.getState().textItems
      const wouldOverlapT = latestT.some(
        (t) => t.id !== d.itemId && t.trackIndex === newTrackIndex
          && newStart < t.endTime && (newStart + dur) > t.startTime,
      )
      if (wouldOverlapT) {
        if (newTrackIndex === d.origTrackIndex) {
          // Same-track overlap → vertical intent guide at center of other clip
          const sameOverlap = latestT.find(
            (t) => t.id !== d.itemId && t.trackIndex === d.origTrackIndex
              && newStart < t.endTime && (newStart + dur) > t.startTime,
          )
          if (sameOverlap) {
            setSnapGuideTime((sameOverlap.startTime + sameOverlap.endTime) / 2)
          }
          setDragGuide(null)
        } else {
          // Cross-track overlap → horizontal guide
          const sourceAlone = latestT.filter((t) => t.id !== d.itemId && t.trackIndex === d.origTrackIndex).length === 0
          const targetSingle = latestT.filter((t) => t.id !== d.itemId && t.trackIndex === newTrackIndex).length === 1
          const intent: 'swap' | 'new-track' = sourceAlone && targetSingle ? 'swap' : 'new-track'
          const tRowIdx = stableRows.indexOf(newTrackIndex)
          const rowIdx = tRowIdx >= 0 ? tRowIdx : stableRows.length - 1
          const el = tracksScrollRef.current
          let guideY = (rowIdx + 1) * ROW_H
          if (el) {
            const rect = el.getBoundingClientRect()
            const relY = e.clientY - rect.top + el.scrollTop
            const rowCenter = rowIdx * ROW_H + ROW_H / 2
            guideY = relY < rowCenter ? rowIdx * ROW_H : (rowIdx + 1) * ROW_H
          }
          setDragGuide({ y: guideY, intent })
        }
      } else if (isTextNew) {
        // New text track zone → guide at the boundary between text and video rows
        setDragGuide({ y: stableRows.length * ROW_H, intent: 'new-track' })
      } else {
        setDragGuide(null)
      }
      return
    }
    if (d.type === 'text-resize-left') {
      const raw = clamp(d.origStart + dt, 0, d.origEnd - MIN_DURATION)
      const t = snapTo(raw, getSnapPoints(d.itemId))
      setSnapGuideTime(t !== raw ? t : null)
      updateTextItem(d.itemId, { startTime: t })
      return
    }
    if (d.type === 'text-resize-right') {
      const raw = clamp(d.origEnd + dt, d.origStart + MIN_DURATION, Infinity)
      const t = snapTo(raw, getSnapPoints(d.itemId))
      setSnapGuideTime(t !== raw ? t : null)
      updateTextItem(d.itemId, { endTime: t })
      return
    }

    const track = tracks.find((t) => t.id === d.itemId)
    if (!track) return
    const media = getMedia(track.mediaId)

    if (d.type === 'move') {
      const pts = getSnapPoints(d.itemId)
      const dur = d.origEnd - d.origStart
      let newStart = clamp(d.origStart + dt, 0, Infinity)
      const ss = snapTo(newStart, pts); const se = snapTo(newStart + dur, pts)
      if (ss !== newStart) { newStart = ss; setSnapGuideTime(ss) }
      else if (se !== newStart + dur) { newStart = se - dur; setSnapGuideTime(se) }
      else { setSnapGuideTime(null) }

      // Track from Y — free move, no collision check during drag
      const section = getSectionFromY(e.clientY, true)
      const stableRows = dragStartVideoRowsRef.current ?? videoTrackIndicesRef.current
      let newTrackIndex = d.currentTrackIndex
      if (section?.kind === 'video') {
        newTrackIndex = stableRows[section.rowIdx] ?? d.currentTrackIndex
      } else if (section?.kind === 'video-new') {
        newTrackIndex = (stableRows[stableRows.length - 1] ?? -1) + 1
      }
      d.currentTrackIndex = newTrackIndex
      d.pendingStart = newStart

      // Update ghost position — follows mouse freely, no store update during drag
      const tracksEl = tracksScrollRef.current
      if (tracksEl) {
        const rect = tracksEl.getBoundingClientRect()
        const relY = e.clientY - rect.top + tracksEl.scrollTop
        setGhostPos({ left: LABEL_W + newStart * PX_PER_SEC, top: relY - 21 })
      }

      // Guide: direction-aware, distinguishes swap vs new-track
      const stableTextCount = (dragStartTextRowsRef.current ?? textTrackIndicesRef.current).length
      const latestV = useEditorStore.getState().tracks
      const wouldOverlapV = section?.kind !== 'video-new' && latestV.some(
        (t) => t.id !== d.itemId && t.trackIndex === newTrackIndex
          && newStart < t.endTime && (newStart + dur) > t.startTime,
      )
      const isNewZone = section?.kind === 'video-new' || wouldOverlapV
      if (isNewZone) {
        if (wouldOverlapV && newTrackIndex === d.origTrackIndex) {
          // Same-track overlap → vertical intent guide at center of other clip
          const sameOverlap = latestV.find(
            (t) => t.id !== d.itemId && t.trackIndex === d.origTrackIndex
              && newStart < t.endTime && (newStart + dur) > t.startTime,
          )
          if (sameOverlap) {
            setSnapGuideTime((sameOverlap.startTime + sameOverlap.endTime) / 2)
          }
          setDragGuide(null)
        } else {
          // Cross-track overlap or new-track zone → horizontal guide
          let intent: 'swap' | 'new-track' = 'new-track'
          if (wouldOverlapV) {
            const sourceAlone = latestV.filter((t) => t.id !== d.itemId && t.trackIndex === d.origTrackIndex).length === 0
            const targetSingle = latestV.filter((t) => t.id !== d.itemId && t.trackIndex === newTrackIndex).length === 1
            if (sourceAlone && targetSingle) intent = 'swap'
          }
          const vRowIdx = stableRows.indexOf(newTrackIndex)
          const el = tracksScrollRef.current
          let guideY = stableTextCount * ROW_H + stableRows.length * ROW_H
          if (vRowIdx >= 0 && el) {
            const rect = el.getBoundingClientRect()
            const relY = e.clientY - rect.top + el.scrollTop
            const rowTop = stableTextCount * ROW_H + vRowIdx * ROW_H
            const rowCenter = rowTop + ROW_H / 2
            guideY = relY < rowCenter ? rowTop : rowTop + ROW_H
          }
          setDragGuide({ y: guideY, intent })
        }
      } else {
        setDragGuide(null)
      }
    } else if (d.type === 'resize-left') {
      const maxClipDur = media ? media.duration : d.clipDuration
      const raw = clamp(d.origStart + dt, 0, d.origEnd - MIN_DURATION)
      const newStart = snapTo(raw, getSnapPoints(d.itemId))
      setSnapGuideTime(newStart !== raw ? newStart : null)
      updateTrackItem(d.itemId, { startTime: newStart, clipStart: clamp(d.origClipStart + (newStart - d.origStart), 0, maxClipDur - MIN_DURATION) })
    } else if (d.type === 'resize-right') {
      const maxClipDur = media ? media.duration : d.clipDuration
      const raw = clamp(d.origEnd + dt, d.origStart + MIN_DURATION, Infinity)
      const newEnd = snapTo(raw, getSnapPoints(d.itemId))
      setSnapGuideTime(newEnd !== raw ? newEnd : null)
      updateTrackItem(d.itemId, { endTime: newEnd, clipEnd: clamp(d.origClipEnd + (newEnd - d.origEnd), d.origClipStart + MIN_DURATION, maxClipDur) })
    }
  }

  const handlePointerUp = () => {
    const d = dragRef.current

    if (d) {
      // On release: first commit pending position to store, then resolve overlaps
      if (d.type === 'move') {
        const dur = d.origEnd - d.origStart
        updateTrackItem(d.itemId, { startTime: d.pendingStart, endTime: d.pendingStart + dur, trackIndex: d.currentTrackIndex })
        const latest = useEditorStore.getState().tracks
        const item = latest.find((t) => t.id === d.itemId)
        if (item) {
          const overlaps = latest.some(
            (t) => t.id !== d.itemId && t.trackIndex === item.trackIndex
              && item.startTime < t.endTime && item.endTime > t.startTime,
          )
          if (overlaps) {
            if (item.trackIndex === d.origTrackIndex) {
              // Same-track: swap time positions
              const sameOverlaps = latest.filter(
                (t) => t.id !== d.itemId && t.trackIndex === item.trackIndex
                  && item.startTime < t.endTime && item.endTime > t.startTime,
              )
              if (sameOverlaps.length === 1) {
                const other = sameOverlaps[0]
                updateTrackItem(d.itemId, { startTime: other.startTime, endTime: other.startTime + dur })
                updateTrackItem(other.id, { startTime: d.origStart, endTime: d.origStart + (other.endTime - other.startTime) })
              } else {
                updateTrackItem(d.itemId, { trackIndex: Math.max(...latest.map((t) => t.trackIndex)) + 1 })
              }
            } else {
              // Cross-track: swap track indices if both are single-clip, else new track
              const sourceAlone = latest.filter((t) => t.trackIndex === d.origTrackIndex).length === 0
              const targetOthers = latest.filter((t) => t.id !== d.itemId && t.trackIndex === item.trackIndex)
              if (sourceAlone && targetOthers.length === 1) {
                updateTrackItem(targetOthers[0].id, { trackIndex: d.origTrackIndex })
              } else {
                updateTrackItem(d.itemId, { trackIndex: Math.max(...latest.map((t) => t.trackIndex)) + 1 })
              }
            }
          }
        }
      }
      if (d.type === 'text-move') {
        const dur = d.origEnd - d.origStart
        updateTextItem(d.itemId, { startTime: d.pendingStart, endTime: d.pendingStart + dur, trackIndex: d.currentTrackIndex })
        const latest = useEditorStore.getState().textItems
        const item = latest.find((t) => t.id === d.itemId)
        if (item) {
          const overlaps = latest.some(
            (t) => t.id !== d.itemId && t.trackIndex === item.trackIndex
              && item.startTime < t.endTime && item.endTime > t.startTime,
          )
          if (overlaps) {
            if (item.trackIndex === d.origTrackIndex) {
              // Same-track: swap time positions
              const sameOverlaps = latest.filter(
                (t) => t.id !== d.itemId && t.trackIndex === item.trackIndex
                  && item.startTime < t.endTime && item.endTime > t.startTime,
              )
              if (sameOverlaps.length === 1) {
                const other = sameOverlaps[0]
                updateTextItem(d.itemId, { startTime: other.startTime, endTime: other.startTime + dur })
                updateTextItem(other.id, { startTime: d.origStart, endTime: d.origStart + (other.endTime - other.startTime) })
              } else {
                updateTextItem(d.itemId, { trackIndex: Math.max(...latest.map((t) => t.trackIndex)) + 1 })
              }
            } else {
              // Cross-track: swap track indices if both are single-clip, else new track
              const sourceAlone = latest.filter((t) => t.trackIndex === d.origTrackIndex).length === 0
              const targetOthers = latest.filter((t) => t.id !== d.itemId && t.trackIndex === item.trackIndex)
              if (sourceAlone && targetOthers.length === 1) {
                updateTextItem(targetOthers[0].id, { trackIndex: d.origTrackIndex })
              } else {
                updateTextItem(d.itemId, { trackIndex: Math.max(...latest.map((t) => t.trackIndex)) + 1 })
              }
            }
          }
        }
      }
    }

    dragRef.current = null
    setDraggingItemId(null)
    setDragPlaceholder(null)
    setGhostPos(null)
    setDragStartVideoRows(null)
    setDragStartTextRows(null)
    dragStartVideoRowsRef.current = null
    dragStartTextRowsRef.current = null
    setDragGuide(null)
    setSnapGuideTime(null)
  }

  const handleTracksClick = (e: React.MouseEvent) => {
    if (!(e.target as HTMLElement).closest(`.${styles.timeline__item}`)) {
      setSelectedItemId(null)
      setSelectedTextId(null)
      setLibraryPreviewMediaId(null)
      const el = tracksScrollRef.current
      if (el) {
        const x = e.clientX - el.getBoundingClientRect().left - LABEL_W + el.scrollLeft
        if (x >= 0) setCurrentTime(clamp(x / PX_PER_SEC, 0, totalDuration))
      }
    }
  }

  const handleRulerClick = (e: React.MouseEvent) => {
    setLibraryPreviewMediaId(null)
    const rect = e.currentTarget.getBoundingClientRect()
    const scrollLeft = rulerScrollRef.current?.scrollLeft ?? 0
    const x = e.clientX - rect.left - LABEL_W + scrollLeft
    if (x < 0) return
    setCurrentTime(clamp(x / PX_PER_SEC, 0, totalDuration))
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(true)
    setLibDragSection(getSectionFromY(e.clientY, true, false))
  }

  const handleDragLeave = () => { setIsDragOver(false); setLibDragSection(null) }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    setLibDragSection(null)
    const mediaId = e.dataTransfer.getData('text/media-id')
    if (!mediaId) return
    const media = mediaList.find((m) => m.id === mediaId)
    if (!media) return

    const vIndices = videoTrackIndicesRef.current
    let targetTrackIndex = (vIndices[vIndices.length - 1] ?? -1) + 1
    let startTime = 0

    const tracksEl = tracksScrollRef.current
    if (tracksEl) {
      const section = getSectionFromY(e.clientY, true, false)
      if (section?.kind === 'video') targetTrackIndex = vIndices[section.rowIdx] ?? 0
      const rect = tracksEl.getBoundingClientRect()
      startTime = Math.max(0, (e.clientX - rect.left - LABEL_W + tracksEl.scrollLeft) / pxPerSecRef.current)
    } else {
      startTime = tracks.reduce((m, t) => Math.max(m, t.endTime), 0)
    }

    addTrackItem({ id: Math.random().toString(36).slice(2), mediaId, trackIndex: targetTrackIndex, startTime, endTime: startTime + media.duration, clipStart: 0, clipEnd: media.duration })
  }

  const playheadLeft = LABEL_W + currentTime * PX_PER_SEC

  // Ghost clip data — read from store (item stays at original position during drag)
  const ghostTrack = draggingItemId ? tracks.find((t) => t.id === draggingItemId) : null
  const ghostText = draggingItemId ? textItems.find((t) => t.id === draggingItemId) : null
  const ghostMedia = ghostTrack ? getMedia(ghostTrack.mediaId) : null

  // ── keyboard shortcut: B = split at playhead ──────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'b' || e.key === 'B') {
        if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
        e.preventDefault()
        const { currentTime: t, totalDuration: td } = useEditorStore.getState()
        if (t > 0 && t < td) splitAtTime(t)
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [splitAtTime])

  return (
    <div className={styles.timeline}>
      {/* ── Toolbar ── */}
      <div className={styles.timeline__toolbar}>
        <div className={styles.timeline__toolbar_left}>
          <button
            className={styles.timeline__tool_btn}
            title="分割 (B)"
            onClick={() => { if (currentTime > 0 && currentTime < totalDuration) splitAtTime(currentTime) }}
          >✂ 分割</button>
        </div>
        <div className={styles.timeline__toolbar_right}>
          <button className={styles.timeline__zoom_btn} onClick={() => setZoom((z) => Math.max(0.25, +(z - 0.25).toFixed(2)))} title="缩小">−</button>
          <input type="range" min={0.25} max={4} step={0.25} value={zoom} onChange={(e) => setZoom(Number(e.target.value))} className={styles.timeline__zoom_slider} title={`缩放 ${Math.round(zoom * 100)}%`} />
          <button className={styles.timeline__zoom_btn} onClick={() => setZoom((z) => Math.min(4, +(z + 0.25).toFixed(2)))} title="放大">+</button>
          <span className={styles.timeline__zoom_label}>{Math.round(zoom * 100)}%</span>
        </div>
      </div>

      {/* ── Ruler ── */}
      <div className={styles.timeline__topbar}>
        <div className={styles.timeline__ruler} onClick={handleRulerClick}>
          <div className={styles.timeline__label_corner} />
          <div ref={rulerScrollRef} className={styles.timeline__ruler_scroll}>
            <canvas ref={canvasRef} className={styles.timeline__ruler_canvas} />
          </div>
        </div>
      </div>

      <div
        ref={tracksScrollRef}
        className={styles.timeline__tracks}
        onScroll={handleTracksScroll}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onClick={handleTracksClick}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {tracks.length === 0 && textItems.length === 0 && !isDragOver && (
          <div className={styles.timeline__empty}>将素材拖拽到此处，或点击素材库中的"+"添加</div>
        )}

        {/* Text track rows — rendered above video rows */}
        {displayTextRows.map((trackIdx, rowIdx) => {
          const rowItems = textItems.filter((t) => t.trackIndex === trackIdx)
          return (
            <div key={`t-${trackIdx}`} className={styles.timeline__track_row}>
              <div className={styles.timeline__track_label}>
                <span className={styles.timeline__track_icon}>T</span>
                <span className={styles.timeline__track_label_text}>
                  {displayTextRows.length === 1 ? '文字' : `文字 ${rowIdx + 1}`}
                </span>
              </div>
              <div className={styles.timeline__track_content} style={{ width: contentWidth }}>
                {/* Placeholder shown at original position while dragging */}
                {dragPlaceholder?.kind === 'text' && dragPlaceholder.trackIndex === trackIdx && ghostPos !== null && (
                  <div
                    className={styles.timeline__item_placeholder}
                    style={{
                      left: dragPlaceholder.startTime * PX_PER_SEC,
                      width: Math.max((dragPlaceholder.endTime - dragPlaceholder.startTime) * PX_PER_SEC, 20),
                    }}
                  />
                )}
                {rowItems.map((item) => {
                  if (item.id === draggingItemId && ghostPos !== null) return null
                  const left = item.startTime * PX_PER_SEC
                  const width = Math.max((item.endTime - item.startTime) * PX_PER_SEC, 20)
                  const isSelected = !libraryPreviewMediaId && selectedTextId === item.id
                  const isDragging = draggingItemId === item.id
                  return (
                    <div
                      key={item.id}
                      className={`${styles.timeline__item} ${styles.timeline__item_text} ${isSelected ? styles['timeline__item--selected'] : ''} ${isDragging ? styles['timeline__item--dragging'] : ''}`}
                      style={{ left, width }}
                      onPointerDown={(e) => handlePointerDown(e, item.id, 'text-move')}
                      title="拖拽移动 | 上下换轨道 | 两端调整时长"
                    >
                      {isSelected && <div className={styles.timeline__resize_handle} onPointerDown={(e) => handlePointerDown(e, item.id, 'text-resize-left')} />}
                      <span className={styles.timeline__item_label}>{item.text}</span>
                      {isSelected && <div className={styles.timeline__resize_handle} onPointerDown={(e) => handlePointerDown(e, item.id, 'text-resize-right')} />}
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}

        {/* Video track rows */}
        {displayVideoRows.map((trackIdx, rowIdx) => {
          const rowTracks = tracks.filter((t) => t.trackIndex === trackIdx)
          const isLibTarget = libDragSection?.kind === 'video' && libDragSection.rowIdx === rowIdx
          return (
            <div key={`v-${trackIdx}`} className={`${styles.timeline__track_row} ${isLibTarget ? styles['timeline__track_row--drag-target'] : ''}`}>
              <div className={styles.timeline__track_label}>
                <span className={styles.timeline__track_icon}>▶</span>
                <span className={styles.timeline__track_label_text}>
                  {displayVideoRows.length === 1 ? '视频' : `视频 ${rowIdx + 1}`}
                </span>
              </div>
              <div className={styles.timeline__track_content} style={{ width: contentWidth }}>
                {/* Placeholder shown at original position while dragging */}
                {dragPlaceholder?.kind === 'video' && dragPlaceholder.trackIndex === trackIdx && ghostPos !== null && (
                  <div
                    className={styles.timeline__item_placeholder}
                    style={{
                      left: dragPlaceholder.startTime * PX_PER_SEC,
                      width: Math.max((dragPlaceholder.endTime - dragPlaceholder.startTime) * PX_PER_SEC, 20),
                    }}
                  />
                )}
                {rowTracks.map((track) => {
                  if (track.id === draggingItemId && ghostPos !== null) return null
                  const media = getMedia(track.mediaId)
                  const left = track.startTime * PX_PER_SEC
                  const width = (track.endTime - track.startTime) * PX_PER_SEC
                  const isSelected = !libraryPreviewMediaId && selectedItemId === track.id
                  const isDragging = draggingItemId === track.id
                  return (
                    <div
                      key={track.id}
                      className={`${styles.timeline__item} ${styles.timeline__item_video} ${isSelected ? styles['timeline__item--selected'] : ''} ${isDragging ? styles['timeline__item--dragging'] : ''}`}
                      style={{ left, width }}
                      onPointerDown={(e) => handlePointerDown(e, track.id, 'move')}
                      onDoubleClick={() => removeTrackItem(track.id)}
                      title="拖拽移动 | 上下换轨道 | 两端裁剪 | 双击删除"
                    >
                      {isSelected && <div className={styles.timeline__resize_handle} onPointerDown={(e) => handlePointerDown(e, track.id, 'resize-left')} />}
                      <div className={styles.timeline__item_inner}>
                        <span className={styles.timeline__item_name}>{(media?.name ?? '未知').replace(/\.[^.]+$/, '')}</span>
                        <span className={styles.timeline__item_dur}>{formatTimecode(track.endTime - track.startTime)}</span>
                      </div>
                      {isSelected && <div className={styles.timeline__resize_handle} onPointerDown={(e) => handlePointerDown(e, track.id, 'resize-right')} />}
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}

        {/* Floating ghost — follows mouse freely during drag */}
        {ghostPos && dragPlaceholder && (
          <div
            className={`${styles.timeline__item} ${dragPlaceholder.kind === 'video' ? styles.timeline__item_video : styles.timeline__item_text} ${styles['timeline__item--selected']} ${styles['timeline__item--dragging']}`}
            style={{
              left: ghostPos.left,
              top: ghostPos.top,
              width: Math.max((dragPlaceholder.endTime - dragPlaceholder.startTime) * PX_PER_SEC, 20),
              height: ROW_H - 10,
              pointerEvents: 'none',
            }}
          >
            <div className={styles.timeline__resize_handle} />
            {dragPlaceholder.kind === 'video' && ghostTrack ? (
              <div className={styles.timeline__item_inner}>
                <span className={styles.timeline__item_name}>{(ghostMedia?.name ?? '未知').replace(/\.[^.]+$/, '')}</span>
                <span className={styles.timeline__item_dur}>{formatTimecode(ghostTrack.endTime - ghostTrack.startTime)}</span>
              </div>
            ) : dragPlaceholder.kind === 'text' && ghostText ? (
              <span className={styles.timeline__item_label}>{ghostText.text}</span>
            ) : null}
            <div className={styles.timeline__resize_handle} />
          </div>
        )}

        {/* Drag guide line — only appears when drop would create a new track */}
        {dragGuide && (
          <div
            className={styles.timeline__guide}
            style={{ top: dragGuide.y }}
          />
        )}

        {/* Vertical snap guide — shown when a clip edge snaps to an alignment point */}
        {snapGuideTime !== null && (
          <div
            className={styles.timeline__snap_guide}
            style={{ left: LABEL_W + snapGuideTime * PX_PER_SEC }}
          />
        )}

        {/* Playhead */}
        <div
          className={styles.timeline__playhead}
          style={{ left: playheadLeft, cursor: 'ew-resize' }}
          onPointerDown={(e) => handlePointerDown(e, '', 'playhead')}
        />
      </div>
    </div>
  )
}
