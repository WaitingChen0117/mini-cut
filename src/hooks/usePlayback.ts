import { useEffect, useRef, useCallback } from 'react'
import { useEditorStore } from '@/store/editorStore'
import type { TrackItem } from '@/types/editor'

export function usePlayback() {
  const isPlaying = useEditorStore((s) => s.isPlaying)
  const totalDuration = useEditorStore((s) => s.totalDuration)
  const setCurrentTime = useEditorStore((s) => s.setCurrentTime)
  const setIsPlaying = useEditorStore((s) => s.setIsPlaying)

  const videoRefs = useRef<Map<string, HTMLVideoElement>>(new Map())
  const rafRef = useRef<number | null>(null)

  // 不放入依赖数组，通过 ref 访问最新的 tracks
  const tracksRef = useRef<TrackItem[]>([])
  const tracks = useEditorStore((s) => s.tracks)
  useEffect(() => {
    tracksRef.current = tracks
  }, [tracks])

  // 当前正在播放的视频信息
  const playInfoRef = useRef<{
    video: HTMLVideoElement
    trackStartTime: number
    clipStart: number
    clipEnd: number
  } | null>(null)

  const playStartTimeRef = useRef<number>(0)

  const registerVideo = useCallback((mediaId: string, el: HTMLVideoElement | null) => {
    if (el) videoRefs.current.set(mediaId, el)
    else videoRefs.current.delete(mediaId)
  }, [])

  // 稳定的 tick：从 video.currentTime 反向推算 store 时间，不依赖 store currentTime
  const tick = useCallback(() => {
    const info = playInfoRef.current
    if (!info) return

    const { video, trackStartTime, clipStart, clipEnd } = info

    if (video.paused || video.ended || video.currentTime >= clipEnd) {
      video.pause()
      playInfoRef.current = null

      // Clip finished — check if another clip starts at this store time
      const storeTime = trackStartTime + (clipEnd - clipStart)
      const nextTrack = tracksRef.current.find(
        (t) => storeTime >= t.startTime && storeTime < t.endTime,
      )

      if (nextTrack) {
        const nextVideo = videoRefs.current.get(nextTrack.mediaId)
        if (nextVideo) {
          setCurrentTime(storeTime)
          playInfoRef.current = {
            video: nextVideo,
            trackStartTime: nextTrack.startTime,
            clipStart: nextTrack.clipStart,
            clipEnd: nextTrack.clipEnd,
          }
          nextVideo.currentTime = nextTrack.clipStart + (storeTime - nextTrack.startTime)
          nextVideo.play()
            .then(() => { rafRef.current = requestAnimationFrame(tick) })
            .catch(() => { playInfoRef.current = null; setIsPlaying(false) })
          return
        }
      }

      // No next clip — stop at end, keep playhead there
      setIsPlaying(false)
      setCurrentTime(useEditorStore.getState().totalDuration)
      return
    }

    setCurrentTime(trackStartTime + (video.currentTime - clipStart))
    rafRef.current = requestAnimationFrame(tick)
  }, [setCurrentTime, setIsPlaying])

  useEffect(() => {
    if (isPlaying) {
      const currentTime = useEditorStore.getState().currentTime
      playStartTimeRef.current = currentTime  // save position before playback
      const activeTrack = tracksRef.current.find(
        (t) => currentTime >= t.startTime && currentTime < t.endTime,
      )

      if (!activeTrack) {
        setIsPlaying(false)
        return
      }

      const video = videoRefs.current.get(activeTrack.mediaId)
      if (!video) {
        setIsPlaying(false)
        return
      }

      playInfoRef.current = {
        video,
        trackStartTime: activeTrack.startTime,
        clipStart: activeTrack.clipStart,
        clipEnd: activeTrack.clipEnd,
      }

      // 只 seek 一次，之后让浏览器自己播放，不再每帧 seek
      video.currentTime = activeTrack.clipStart + (currentTime - activeTrack.startTime)
      video.play()
        .then(() => {
          rafRef.current = requestAnimationFrame(tick)
        })
        .catch(() => {
          playInfoRef.current = null
          setIsPlaying(false)
        })
    } else {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current)
        rafRef.current = null
      }
      playInfoRef.current = null
      videoRefs.current.forEach((v) => {
        if (!v.paused) v.pause()
      })
    }

    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current)
        rafRef.current = null
      }
    }
  }, [isPlaying, tick, setIsPlaying])

  const togglePlay = useCallback(() => {
    if (totalDuration === 0) return
    if (!isPlaying) {
      const currentTime = useEditorStore.getState().currentTime
      if (currentTime >= totalDuration) {
        setCurrentTime(0)
      }
    }
    setIsPlaying(!isPlaying)
  }, [isPlaying, totalDuration, setIsPlaying, setCurrentTime])

  const seek = useCallback(
    (time: number) => {
      setCurrentTime(time)
      tracksRef.current.forEach((track) => {
        if (time >= track.startTime && time < track.endTime) {
          const video = videoRefs.current.get(track.mediaId)
          if (video) video.currentTime = track.clipStart + (time - track.startTime)
        }
      })
    },
    [setCurrentTime],
  )

  return { togglePlay, seek, registerVideo }
}
