import { useEffect, useRef, useCallback, useState } from 'react'
import { useEditorStore } from '@/store/editorStore'
import { usePlayback } from '@/hooks/usePlayback'
import { formatTC, clamp } from '@/utils/time'
import type { TextItem } from '@/types/editor'
import styles from './PreviewPanel.module.css'

const PAD = 10
const HANDLE_R = 5
const ROT_DIST = 28

type AspectRatio = '16:9' | '4:3' | '9:16'
const RATIO_DIMS: Record<AspectRatio, [number, number]> = {
  '16:9': [1280, 720],
  '4:3':  [1280, 960],
  '9:16': [720, 1280],
}

function drawVideoContain(ctx: CanvasRenderingContext2D, video: HTMLVideoElement, cw: number, ch: number) {
  const vw = video.videoWidth || cw
  const vh = video.videoHeight || ch
  const videoAr = vw / vh
  const canvasAr = cw / ch
  let dx = 0, dy = 0, dw = cw, dh = ch
  if (videoAr > canvasAr) {
    dh = cw / videoAr
    dy = (ch - dh) / 2
  } else if (videoAr < canvasAr) {
    dw = ch * videoAr
    dx = (cw - dw) / 2
  }
  ctx.fillStyle = '#0d1117'
  ctx.fillRect(0, 0, cw, ch)
  ctx.drawImage(video, dx, dy, dw, dh)
}

function deg2rad(d: number) { return d * Math.PI / 180 }

function localToCanvas(lx: number, ly: number, cx: number, cy: number, cos: number, sin: number) {
  return { x: cx + lx * cos - ly * sin, y: cy + lx * sin + ly * cos }
}

function toLocal(px: number, py: number, cx: number, cy: number, cos: number, sin: number, scale: number) {
  const dx = px - cx; const dy = py - cy
  return { lx: (dx * cos + dy * sin) / scale, ly: (-dx * sin + dy * cos) / scale }
}

interface TextMetrics { tw: number; th: number }

function measureText(canvas: HTMLCanvasElement, item: TextItem): TextMetrics {
  const ctx = canvas.getContext('2d')!
  ctx.save()
  ctx.font = `${item.fontWeight} ${item.fontSize}px sans-serif`
  const tw = ctx.measureText(item.text).width
  ctx.restore()
  return { tw, th: item.fontSize * 1.35 }
}

type HandleType = 'tl' | 'tr' | 'bl' | 'br' | 'rotate'

function hitHandle(lx: number, ly: number, tw: number, th: number, scale: number): HandleType | null {
  const hw = tw / 2 + PAD; const hh = th / 2 + PAD
  const rotY = -(hh * scale + ROT_DIST) / scale
  if (Math.hypot(lx, ly - rotY) <= (12 / scale)) return 'rotate'
  for (const [hlx, hly, id] of [
    [-hw, -hh, 'tl'], [hw, -hh, 'tr'], [-hw, hh, 'bl'], [hw, hh, 'br'],
  ] as [number, number, HandleType][]) {
    if (Math.abs(lx - hlx) <= (8 / scale) && Math.abs(ly - hly) <= (8 / scale)) return id
  }
  return null
}

function insideText(lx: number, ly: number, tw: number, th: number) {
  return Math.abs(lx) <= tw / 2 + PAD && Math.abs(ly) <= th / 2 + PAD
}

function resizeCursor(handle: 'tl' | 'tr' | 'bl' | 'br', rotationDeg: number): string {
  const localAngle = { tl: -135, tr: -45, bl: 135, br: 45 }[handle]
  const a = ((localAngle + rotationDeg) % 180 + 180) % 180
  if (a < 22.5 || a >= 157.5) return 'ew-resize'
  if (a < 67.5) return 'nwse-resize'
  if (a < 112.5) return 'ns-resize'
  return 'nesw-resize'
}

export function PreviewPanel() {
  const {
    currentTime, totalDuration, isPlaying, mediaList, textItems,
    setSelectedTextId, setSelectedItemId, updateTextItem,
    libraryPreviewMediaId, libraryPreviewPlaying, previewTextPreset,
    setLibraryPreviewPlaying,
  } = useEditorStore()
  const { togglePlay, seek, registerVideo } = usePlayback()

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const videoRefs = useRef<Map<string, HTMLVideoElement>>(new Map())
  const rafRef = useRef<number | null>(null)

  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('16:9')
  const canvasW = RATIO_DIMS[aspectRatio][0]
  const canvasH = RATIO_DIMS[aspectRatio][1]
  const [canvasCursor, setCanvasCursor] = useState('default')
  const [isFullscreen, setIsFullscreen] = useState(false)

  // Inline text editing
  const [editingTextId, setEditingTextId] = useState<string | null>(null)
  const [editOverlay, setEditOverlay] = useState({ left: 0, top: 0, width: 0, fontSize: 14, color: '#fff' })
  const editInputRef = useRef<HTMLInputElement>(null)

  // Library / text preset preview DOM refs (updated in RAF to avoid 60fps React re-renders)
  const libTimeRef = useRef<HTMLSpanElement>(null)
  const textTimeRef = useRef<HTMLSpanElement>(null)

  // Fullscreen overlay DOM refs
  const fsProgressFillRef = useRef<HTMLDivElement>(null)
  const fsTimeCurRef = useRef<HTMLSpanElement>(null)
  const fsPlayBtnRef = useRef<HTMLButtonElement>(null)

  // Pointer interaction state
  const dragRef = useRef<{
    kind: 'move' | 'resize' | 'rotate'
    textId: string
    handle?: HandleType
    startClientX: number; startClientY: number
    origX: number; origY: number; hasMoved: boolean
    startDist?: number; origScale?: number
    startAngle?: number; origRotation?: number
  } | null>(null)

  // ── drawToCanvas ──────────────────────────────────────────────────────────

  const drawToCanvas = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const {
      currentTime: t, tracks, textItems: txts, selectedTextId: selId,
      libraryPreviewMediaId: lpId, previewTextPreset: ptPreset,
    } = useEditorStore.getState()

    // ── Library preview mode ──────────────────────────────────────────────
    if (lpId) {
      const video = videoRefs.current.get(lpId)
      if (video && video.readyState >= 2) {
        ctx.clearRect(0, 0, canvas.width, canvas.height)
        drawVideoContain(ctx, video, canvas.width, canvas.height)
      }
      // readyState < 2 (seeking): keep last frame, no black fill
      return
    }

    // ── Normal timeline rendering ─────────────────────────────────────────
    const activeTrack = tracks.find((tr) => t >= tr.startTime && t < tr.endTime)

    if (activeTrack) {
      const video = videoRefs.current.get(activeTrack.mediaId)
      if (video && video.readyState >= 2) {
        ctx.clearRect(0, 0, canvas.width, canvas.height)
        drawVideoContain(ctx, video, canvas.width, canvas.height)
      }
      // readyState < 2 (seeking): keep last frame, no black fill
    } else {
      ctx.fillStyle = '#0d1117'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
    }

    // Timeline text overlays
    const visible = txts.filter((tx) => t >= tx.startTime && t < tx.endTime)
    visible.forEach((item) => {
      const cx = item.x * canvas.width
      const cy = item.y * canvas.height
      const scale = item.scale ?? 1
      const rot = deg2rad(item.rotation ?? 0)
      ctx.save()
      ctx.translate(cx, cy)
      ctx.rotate(rot)
      ctx.scale(scale, scale)
      ctx.font = `${item.fontWeight} ${item.fontSize}px sans-serif`
      ctx.fillStyle = item.color
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.shadowColor = 'rgba(0,0,0,0.85)'
      ctx.shadowBlur = 6
      ctx.fillText(item.text, 0, 0)
      ctx.restore()
    })

    // Text preset preview overlay (not on timeline, just visual preview)
    if (ptPreset) {
      ctx.save()
      ctx.translate(canvas.width / 2, canvas.height * 0.75)
      ctx.font = `${ptPreset.fontWeight} ${ptPreset.fontSize}px sans-serif`
      ctx.fillStyle = ptPreset.color
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.shadowColor = 'rgba(0,0,0,0.85)'
      ctx.shadowBlur = 6
      ctx.fillText(ptPreset.text, 0, 0)
      // Dashed underline to indicate preview mode
      const tw = ctx.measureText(ptPreset.text).width
      ctx.setLineDash([4, 3])
      ctx.strokeStyle = 'rgba(255,255,255,0.4)'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(-tw / 2, ptPreset.fontSize * 0.7)
      ctx.lineTo(tw / 2, ptPreset.fontSize * 0.7)
      ctx.stroke()
      ctx.setLineDash([])
      ctx.restore()
    }

    // Selection handles
    if (selId) {
      const sel = visible.find((tx) => tx.id === selId)
      if (sel) {
        const { tw, th } = measureText(canvas, sel)
        const scale = sel.scale ?? 1
        const rot = deg2rad(sel.rotation ?? 0)
        const cx = sel.x * canvas.width
        const cy = sel.y * canvas.height
        const cos = Math.cos(rot); const sin = Math.sin(rot)
        const hw = tw / 2 + PAD; const hh = th / 2 + PAD

        ctx.save()
        ctx.translate(cx, cy)
        ctx.rotate(rot)
        ctx.scale(scale, scale)
        ctx.strokeStyle = 'rgba(255,255,255,0.85)'
        ctx.lineWidth = 1.5 / scale
        ctx.setLineDash([5 / scale, 4 / scale])
        ctx.strokeRect(-hw, -hh, hw * 2, hh * 2)
        ctx.setLineDash([])
        ctx.restore()

        ctx.fillStyle = '#fff'
        ctx.strokeStyle = 'rgba(80,80,80,0.8)'
        ctx.lineWidth = 1
        const corners: [number, number][] = [[-hw, -hh], [hw, -hh], [-hw, hh], [hw, hh]]
        for (const [lx, ly] of corners) {
          const p = localToCanvas(lx * scale, ly * scale, cx, cy, cos, sin)
          ctx.beginPath()
          ctx.rect(p.x - HANDLE_R, p.y - HANDLE_R, HANDLE_R * 2, HANDLE_R * 2)
          ctx.fill(); ctx.stroke()
        }

        const topMid = localToCanvas(0, -hh * scale, cx, cy, cos, sin)
        const rotHandle = localToCanvas(0, -(hh * scale + ROT_DIST), cx, cy, cos, sin)
        ctx.beginPath()
        ctx.moveTo(topMid.x, topMid.y)
        ctx.lineTo(rotHandle.x, rotHandle.y)
        ctx.strokeStyle = 'rgba(255,255,255,0.7)'
        ctx.lineWidth = 1
        ctx.stroke()

        ctx.beginPath()
        ctx.arc(rotHandle.x, rotHandle.y, 7, 0, Math.PI * 2)
        ctx.fillStyle = '#fff'
        ctx.fill()
        ctx.strokeStyle = 'rgba(80,80,80,0.8)'
        ctx.lineWidth = 1
        ctx.stroke()

        ctx.save()
        ctx.translate(rotHandle.x, rotHandle.y)
        ctx.strokeStyle = '#555'
        ctx.lineWidth = 1.5
        ctx.beginPath()
        ctx.arc(0, 0, 4, -Math.PI * 0.8, Math.PI * 0.6)
        ctx.stroke()
        ctx.restore()
      }
    }
  }, [])

  // ── video registration ────────────────────────────────────────────────────

  const registerLocalVideo = useCallback(
    (mediaId: string, el: HTMLVideoElement | null) => {
      if (el) {
        videoRefs.current.set(mediaId, el)
        el.addEventListener('seeked', drawToCanvas)
      } else {
        const existing = videoRefs.current.get(mediaId)
        if (existing) existing.removeEventListener('seeked', drawToCanvas)
        videoRefs.current.delete(mediaId)
      }
      registerVideo(mediaId, el)
    },
    [registerVideo, drawToCanvas],
  )

  // ── RAF loop ──────────────────────────────────────────────────────────────

  const frameLoop = useCallback(() => {
    const {
      currentTime: t, tracks, isPlaying: playing, totalDuration: td,
      libraryPreviewMediaId: lpId, libraryPreviewPlaying: lpPlaying,
      mediaList: mList,
    } = useEditorStore.getState()

    if (lpId) {
      // Library preview mode
      const video = videoRefs.current.get(lpId)
      if (video) {
        const media = mList.find((m) => m.id === lpId)
        if (lpPlaying) {
          if (video.paused) {
            video.currentTime = useEditorStore.getState().libraryPreviewTime
            video.play().catch(() => {})
          }
          const ct = video.currentTime
          useEditorStore.getState().setLibraryPreviewTime(ct)
          if (libTimeRef.current) libTimeRef.current.textContent = formatTC(ct)
          // Fullscreen overlay
          if (media && media.duration > 0) {
            if (fsProgressFillRef.current) fsProgressFillRef.current.style.width = `${(ct / media.duration) * 100}%`
          }
          if (fsTimeCurRef.current) fsTimeCurRef.current.textContent = formatTC(ct)
          if (fsPlayBtnRef.current) fsPlayBtnRef.current.textContent = '⏸'
          // Auto-stop at end
          if (media && ct >= media.duration - 0.05) {
            video.pause()
            useEditorStore.getState().setLibraryPreviewPlaying(false)
          }
        } else {
          if (!video.paused) video.pause()
          const lpTime = useEditorStore.getState().libraryPreviewTime
          if (Math.abs(video.currentTime - lpTime) > 0.05) video.currentTime = lpTime
          if (libTimeRef.current) libTimeRef.current.textContent = formatTC(lpTime)
          // Fullscreen overlay
          const dur = mList.find((m) => m.id === lpId)?.duration ?? 0
          if (dur > 0 && fsProgressFillRef.current) fsProgressFillRef.current.style.width = `${(lpTime / dur) * 100}%`
          if (fsTimeCurRef.current) fsTimeCurRef.current.textContent = formatTC(lpTime)
          if (fsPlayBtnRef.current) fsPlayBtnRef.current.textContent = '▶'
        }
      }
      drawToCanvas()
      rafRef.current = requestAnimationFrame(frameLoop)
      return
    }

    // Normal timeline mode
    drawToCanvas()

    // Update text preset time display DOM directly
    if (useEditorStore.getState().previewTextPreset) {
      if (textTimeRef.current) textTimeRef.current.textContent = formatTC(t)
    }

    // Fullscreen overlay
    if (td > 0 && fsProgressFillRef.current) fsProgressFillRef.current.style.width = `${(t / td) * 100}%`
    if (fsTimeCurRef.current) fsTimeCurRef.current.textContent = formatTC(t)
    if (fsPlayBtnRef.current) fsPlayBtnRef.current.textContent = playing ? '⏸' : '▶'

    if (!playing) {
      const activeTrack = tracks.find((tr) => t >= tr.startTime && t < tr.endTime)
      if (activeTrack) {
        const video = videoRefs.current.get(activeTrack.mediaId)
        if (video) {
          const expected = activeTrack.clipStart + (t - activeTrack.startTime)
          if (!video.seeking && Math.abs(video.currentTime - expected) > 0.001) {
            video.currentTime = expected
          }
        }
      }
    }

    rafRef.current = requestAnimationFrame(frameLoop)
  }, [drawToCanvas])

  useEffect(() => {
    rafRef.current = requestAnimationFrame(frameLoop)
    return () => { if (rafRef.current !== null) cancelAnimationFrame(rafRef.current) }
  }, [frameLoop])

  // ── fullscreen state sync ─────────────────────────────────────────────────

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', handler)
    return () => document.removeEventListener('fullscreenchange', handler)
  }, [])

  // ── keyboard ──────────────────────────────────────────────────────────────

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.code === 'Space' && e.target === document.body) {
        e.preventDefault()
        const { libraryPreviewMediaId: lpId } = useEditorStore.getState()
        if (lpId) {
          useEditorStore.getState().setLibraryPreviewPlaying(!useEditorStore.getState().libraryPreviewPlaying)
        } else {
          togglePlay()
        }
      }
      if ((e.key === 'Escape' || e.key === 'Delete' || e.key === 'Backspace') && e.target === document.body) {
        const { selectedItemId, selectedTextId, removeTrackItem, removeTextItem, setSelectedItemId, setSelectedTextId } = useEditorStore.getState()
        if (selectedItemId) { removeTrackItem(selectedItemId); setSelectedItemId(null) }
        else if (selectedTextId) { removeTextItem(selectedTextId); setSelectedTextId(null) }
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [togglePlay])

  // ── coordinate helpers ────────────────────────────────────────────────────

  const getCanvasCoord = (clientX: number, clientY: number) => {
    const c = canvasRef.current; if (!c) return null
    const r = c.getBoundingClientRect()
    return {
      x: (clientX - r.left) * (c.width / r.width),
      y: (clientY - r.top) * (c.height / r.height),
    }
  }

  const hitTest = useCallback((px: number, py: number): {
    item: TextItem; handle: HandleType | null
  } | null => {
    const c = canvasRef.current; if (!c) return null
    const { currentTime: t, textItems: txts, selectedTextId: selId } = useEditorStore.getState()
    const visible = txts.filter((tx) => t >= tx.startTime && t < tx.endTime)

    if (selId) {
      const sel = visible.find((tx) => tx.id === selId)
      if (sel) {
        const { tw, th } = measureText(c, sel)
        const scale = sel.scale ?? 1
        const rot = deg2rad(sel.rotation ?? 0)
        const cx = sel.x * c.width; const cy = sel.y * c.height
        const cos = Math.cos(rot); const sin = Math.sin(rot)
        const { lx, ly } = toLocal(px, py, cx, cy, cos, sin, scale)
        const h = hitHandle(lx, ly, tw, th, scale)
        if (h) return { item: sel, handle: h }
      }
    }

    for (const item of [...visible].reverse()) {
      const { tw, th } = measureText(c, item)
      const scale = item.scale ?? 1
      const rot = deg2rad(item.rotation ?? 0)
      const cx = item.x * c.width; const cy = item.y * c.height
      const cos = Math.cos(rot); const sin = Math.sin(rot)
      const { lx, ly } = toLocal(px, py, cx, cy, cos, sin, scale)
      if (insideText(lx, ly, tw, th)) return { item, handle: null }
    }
    return null
  }, [])

  // ── canvas pointer events ─────────────────────────────────────────────────

  const handleCanvasPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (editingTextId) return
    const coord = getCanvasCoord(e.clientX, e.clientY)
    if (!coord) return
    const hit = hitTest(coord.x, coord.y)

    if (!hit) {
      setSelectedTextId(null); setSelectedItemId(null); return
    }

    e.currentTarget.setPointerCapture(e.pointerId)
    setSelectedTextId(hit.item.id)

    const { item, handle } = hit
    const cx = item.x * canvasRef.current!.width
    const cy = item.y * canvasRef.current!.height

    if (handle === 'rotate') {
      const angle = Math.atan2(coord.y - cy, coord.x - cx)
      dragRef.current = {
        kind: 'rotate', textId: item.id, handle,
        startClientX: e.clientX, startClientY: e.clientY,
        origX: item.x, origY: item.y, hasMoved: false,
        startAngle: angle, origRotation: item.rotation ?? 0,
      }
      setCanvasCursor('grabbing')
    } else if (handle) {
      const { tw, th } = measureText(canvasRef.current!, item)
      const scale = item.scale ?? 1
      const hw = (tw / 2 + PAD) * scale; const hh = (th / 2 + PAD) * scale
      const rot = deg2rad(item.rotation ?? 0)
      const cos = Math.cos(rot); const sin = Math.sin(rot)
      const hpos = {
        tl: localToCanvas(-hw, -hh, cx, cy, cos, sin),
        tr: localToCanvas(hw, -hh, cx, cy, cos, sin),
        bl: localToCanvas(-hw, hh, cx, cy, cos, sin),
        br: localToCanvas(hw, hh, cx, cy, cos, sin),
      }[handle]!
      const dist = Math.hypot(hpos.x - cx, hpos.y - cy)
      dragRef.current = {
        kind: 'resize', textId: item.id, handle,
        startClientX: e.clientX, startClientY: e.clientY,
        origX: item.x, origY: item.y, hasMoved: false,
        startDist: dist, origScale: scale,
      }
      setCanvasCursor(resizeCursor(handle, item.rotation ?? 0))
    } else {
      dragRef.current = {
        kind: 'move', textId: item.id,
        startClientX: e.clientX, startClientY: e.clientY,
        origX: item.x, origY: item.y, hasMoved: false,
      }
      setCanvasCursor('grabbing')
    }
  }

  const handleCanvasPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const d = dragRef.current
    const canvas = canvasRef.current
    if (!d || !canvas) {
      if (!editingTextId) {
        const coord = getCanvasCoord(e.clientX, e.clientY)
        if (coord) {
          const hit = hitTest(coord.x, coord.y)
          if (!hit) setCanvasCursor('default')
          else if (hit.handle === 'rotate') setCanvasCursor('grab')
          else if (hit.handle) setCanvasCursor(resizeCursor(hit.handle, hit.item.rotation ?? 0))
          else setCanvasCursor('grab')
        }
      }
      return
    }

    const rect = canvas.getBoundingClientRect()

    if (d.kind === 'move') {
      const dx = (e.clientX - d.startClientX) / rect.width
      const dy = (e.clientY - d.startClientY) / rect.height
      if (Math.abs(dx) > 0.003 || Math.abs(dy) > 0.003) d.hasMoved = true
      if (!d.hasMoved) return
      updateTextItem(d.textId, {
        x: clamp(d.origX + dx, 0.02, 0.98),
        y: clamp(d.origY + dy, 0.02, 0.98),
      })
    } else if (d.kind === 'rotate') {
      const cx = d.origX * canvas.width * (rect.width / canvas.width) + rect.left
      const cy = d.origY * canvas.height * (rect.height / canvas.height) + rect.top
      const angle = Math.atan2(e.clientY - cy, e.clientX - cx)
      const delta = (angle - d.startAngle!) * (180 / Math.PI)
      d.hasMoved = true
      updateTextItem(d.textId, { rotation: (d.origRotation! + delta + 360) % 360 })
    } else if (d.kind === 'resize') {
      const cx = d.origX * canvas.width * (rect.width / canvas.width) + rect.left
      const cy = d.origY * canvas.height * (rect.height / canvas.height) + rect.top
      const dist = Math.hypot(e.clientX - cx, e.clientY - cy)
      d.hasMoved = true
      const newScale = clamp((d.origScale! * dist) / d.startDist!, 0.1, 10)
      updateTextItem(d.textId, { scale: newScale })
    }
  }

  const handleCanvasPointerUp = () => {
    dragRef.current = null
    setCanvasCursor('default')
  }

  // ── double-click → inline edit ───────────────────────────────────────────

  const handleCanvasDblClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const coord = getCanvasCoord(e.clientX, e.clientY)
    if (!coord) return
    const hit = hitTest(coord.x, coord.y)
    if (!hit || hit.handle) return

    const { item } = hit
    const canvas = canvasRef.current; const stage = stageRef.current
    if (!canvas || !stage) return

    const canvasRect = canvas.getBoundingClientRect()
    const stageRect = stage.getBoundingClientRect()
    const scaleX = canvasRect.width / canvas.width
    const scaleY = canvasRect.height / canvas.height

    const { tw } = measureText(canvas, item)
    const scaledFontSize = Math.round(item.fontSize * (item.scale ?? 1) * scaleY)
    const inputW = Math.max(tw * (item.scale ?? 1) * scaleX + 40, 120)
    const cx = canvasRect.left - stageRect.left + item.x * canvasRect.width
    const cy = canvasRect.top - stageRect.top + item.y * canvasRect.height

    setEditingTextId(item.id)
    setEditOverlay({ left: cx - inputW / 2, top: cy - scaledFontSize * 0.75, width: inputW, fontSize: scaledFontSize, color: item.color })
    setSelectedTextId(item.id)
    setTimeout(() => editInputRef.current?.select(), 0)
  }

  const commitEdit = () => { setEditingTextId(null) }

  const handleEditKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') { e.preventDefault(); commitEdit() }
    if (e.key === 'Escape') { setEditingTextId(null) }
    e.stopPropagation()
  }

  // ── fullscreen ────────────────────────────────────────────────────────────

  const handleFullscreen = () => {
    const el = stageRef.current
    if (!el) return
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {})
    } else {
      el.requestFullscreen().catch(() => {})
    }
  }

  const handleFsProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    const frac = clamp((e.clientX - r.left) / r.width, 0, 1)
    const lpId = useEditorStore.getState().libraryPreviewMediaId
    if (lpId) {
      const media = mediaList.find((m) => m.id === lpId)
      if (!media) return
      const t = frac * media.duration
      useEditorStore.getState().setLibraryPreviewTime(t)
      useEditorStore.getState().setLibraryPreviewPlaying(false)
      const video = videoRefs.current.get(lpId)
      if (video) video.currentTime = t
    } else {
      seek(frac * totalDuration)
    }
  }

  const handleFsPlay = () => {
    const lpId = useEditorStore.getState().libraryPreviewMediaId
    if (lpId) {
      useEditorStore.getState().setLibraryPreviewPlaying(!useEditorStore.getState().libraryPreviewPlaying)
    } else {
      togglePlay()
    }
  }


  const editingItem = editingTextId ? textItems.find((t) => t.id === editingTextId) : null
  const libraryPreviewMedia = libraryPreviewMediaId ? mediaList.find((m) => m.id === libraryPreviewMediaId) : null
  const fsDuration = libraryPreviewMedia ? libraryPreviewMedia.duration : totalDuration

  return (
    <div className={styles.preview}>
      <div className={styles.preview__header}>
        <span>{libraryPreviewMediaId ? '正在预览-视频' : previewTextPreset ? '正在预览-文本' : '播放器'}</span>
        <div className={styles.preview__ratio_btns}>
          {(['16:9', '4:3', '9:16'] as AspectRatio[]).map((r) => (
            <button
              key={r}
              className={`${styles.preview__ratio_btn}${aspectRatio === r ? ` ${styles['preview__ratio_btn--active']}` : ''}`}
              onClick={() => setAspectRatio(r)}
            >{r}</button>
          ))}
        </div>
      </div>
      <div ref={stageRef} className={styles.preview__stage}>
        <canvas
          ref={canvasRef}
          className={styles.preview__canvas}
          width={canvasW}
          height={canvasH}
          style={{ cursor: editingTextId ? 'text' : canvasCursor, aspectRatio: `${canvasW} / ${canvasH}` }}
          onPointerDown={handleCanvasPointerDown}
          onPointerMove={handleCanvasPointerMove}
          onPointerUp={handleCanvasPointerUp}
          onDoubleClick={handleCanvasDblClick}
        />

        {editingItem && (
          <input
            ref={editInputRef}
            className={styles.preview__text_input}
            style={{
              left: editOverlay.left, top: editOverlay.top,
              width: editOverlay.width, fontSize: editOverlay.fontSize,
              color: editOverlay.color,
            }}
            value={editingItem.text}
            onChange={(e) => updateTextItem(editingItem.id, { text: e.target.value })}
            onBlur={commitEdit}
            onKeyDown={handleEditKeyDown}
            autoFocus
          />
        )}

        <div className={styles.preview__hidden_videos}>
          {mediaList.filter((m) => m.type === 'video').map((m) => (
            <video key={m.id} src={m.url} ref={(el) => registerLocalVideo(m.id, el)} preload="auto" muted playsInline />
          ))}
        </div>

        {totalDuration === 0 && !libraryPreviewMediaId && (
          <div className={styles.preview__empty}>
            <div className={styles.preview__empty_icon}>▶</div>
            <div>从素材库拖拽视频到时间轴</div>
            <div style={{ fontSize: 12, color: '#2a3a5a', marginTop: 4 }}>或点击左侧"+ 导入"添加素材</div>
          </div>
        )}

        {/* Fullscreen overlay controls */}
        {isFullscreen && (
          <div className={styles.preview__fs_overlay}>
            <button ref={fsPlayBtnRef} className={styles.preview__fs_btn} onClick={handleFsPlay}>▶</button>
            <span ref={fsTimeCurRef} className={styles.preview__fs_time}>00:00:00:00</span>
            <span className={styles.preview__fs_time_sep}>/</span>
            <span className={styles.preview__fs_time}>{formatTC(fsDuration)}</span>
            <div className={styles.preview__fs_progress} onClick={handleFsProgressClick}>
              <div ref={fsProgressFillRef} className={styles.preview__fs_progress_fill} style={{ width: '0%' }} />
            </div>
            <button className={styles.preview__fs_btn} onClick={handleFullscreen} title="退出全屏">⛶</button>
          </div>
        )}
      </div>

      {/* Controls — three-section row, play button centered */}
      {libraryPreviewMedia ? (
        <div className={styles.preview__controls}>
          <div className={styles.preview__controls_left}>
            <span ref={libTimeRef} className={styles.preview__time_start}>00:00:00:00</span>
            <span className={styles.preview__time_end}>{formatTC(libraryPreviewMedia.duration)}</span>
          </div>
          <button className={styles.preview__play_btn} onClick={() => setLibraryPreviewPlaying(!libraryPreviewPlaying)}>
            {libraryPreviewPlaying ? '⏸' : '▶'}
          </button>
          <div className={styles.preview__controls_right}>
            <button className={styles.preview__ctrl_btn} title="原声">原声</button>
            <button className={styles.preview__ctrl_btn} title="全屏" onClick={handleFullscreen}>⛶</button>
          </div>
        </div>
      ) : previewTextPreset ? (
        <div className={styles.preview__controls}>
          <div className={styles.preview__controls_left}>
            <span ref={textTimeRef} className={styles.preview__time_start}>{formatTC(currentTime)}</span>
            <span className={styles.preview__time_end}>{formatTC(totalDuration)}</span>
          </div>
          <button className={styles.preview__play_btn} onClick={togglePlay} disabled={totalDuration === 0}>
            {isPlaying ? '⏸' : '▶'}
          </button>
          <div className={styles.preview__controls_right}>
            <button className={styles.preview__ctrl_btn} title="原声">原声</button>
            <button className={styles.preview__ctrl_btn} title="全屏" onClick={handleFullscreen}>⛶</button>
          </div>
        </div>
      ) : (
        <div className={styles.preview__controls}>
          <div className={styles.preview__controls_left}>
            <span className={styles.preview__time_start}>{formatTC(currentTime)}</span>
            <span className={styles.preview__time_end}>{formatTC(totalDuration)}</span>
          </div>
          <button className={styles.preview__play_btn} onClick={togglePlay} disabled={totalDuration === 0}>
            {isPlaying ? '⏸' : '▶'}
          </button>
          <div className={styles.preview__controls_right}>
            <button className={styles.preview__ctrl_btn} title="原声">原声</button>
            <button className={styles.preview__ctrl_btn} title="全屏" onClick={handleFullscreen}>⛶</button>
          </div>
        </div>
      )}
    </div>
  )
}
