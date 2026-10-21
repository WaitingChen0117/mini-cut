import { describe, it, expect, beforeEach } from 'vitest'
import { useEditorStore } from '../store/editorStore'
import type { MediaItem, TrackItem } from '../types/editor'

const media: MediaItem = {
  id: 'm1',
  name: 'test.mp4',
  type: 'video',
  url: 'blob:test',
  duration: 10,
}

const track: TrackItem = {
  id: 't1',
  mediaId: 'm1',
  trackIndex: 0,
  startTime: 0,
  endTime: 10,
  clipStart: 0,
  clipEnd: 10,
}

beforeEach(() => {
  useEditorStore.setState({
    mediaList: [],
    tracks: [],
    textItems: [],
    currentTime: 0,
    totalDuration: 0,
    isPlaying: false,
    selectedItemId: null,
    selectedTextId: null,
  })
})

describe('editorStore - media', () => {
  it('adds and removes media', () => {
    useEditorStore.getState().addMedia(media)
    expect(useEditorStore.getState().mediaList).toHaveLength(1)
    useEditorStore.getState().removeMedia('m1')
    expect(useEditorStore.getState().mediaList).toHaveLength(0)
  })

  it('removing media also removes linked tracks', () => {
    useEditorStore.getState().addMedia(media)
    useEditorStore.getState().addTrackItem(track)
    useEditorStore.getState().removeMedia('m1')
    expect(useEditorStore.getState().tracks).toHaveLength(0)
  })
})

describe('editorStore - tracks', () => {
  it('addTrackItem updates totalDuration', () => {
    useEditorStore.getState().addTrackItem(track)
    expect(useEditorStore.getState().totalDuration).toBe(10)
  })

  it('updateTrackItem changes endTime and recalculates duration', () => {
    useEditorStore.getState().addTrackItem(track)
    useEditorStore.getState().updateTrackItem('t1', { endTime: 15 })
    expect(useEditorStore.getState().totalDuration).toBe(15)
  })

  it('removeTrackItem recalculates duration to 0', () => {
    useEditorStore.getState().addTrackItem(track)
    useEditorStore.getState().removeTrackItem('t1')
    expect(useEditorStore.getState().totalDuration).toBe(0)
  })
})

describe('editorStore - text items', () => {
  it('adds and removes text items', () => {
    useEditorStore.getState().addTextItem({
      id: 'tx1', text: 'Hello', startTime: 0, endTime: 3,
      x: 0.1, y: 0.8, fontSize: 36, color: '#fff', fontWeight: 'bold', scale: 1, rotation: 0, trackIndex: 0,
    })
    expect(useEditorStore.getState().textItems).toHaveLength(1)
    useEditorStore.getState().removeTextItem('tx1')
    expect(useEditorStore.getState().textItems).toHaveLength(0)
  })

  it('updateTextItem patches fields', () => {
    useEditorStore.getState().addTextItem({
      id: 'tx1', text: 'Hello', startTime: 0, endTime: 3,
      x: 0.1, y: 0.8, fontSize: 36, color: '#fff', fontWeight: 'bold', scale: 1, rotation: 0, trackIndex: 0,
    })
    useEditorStore.getState().updateTextItem('tx1', { text: 'World', fontSize: 48 })
    const item = useEditorStore.getState().textItems[0]
    expect(item.text).toBe('World')
    expect(item.fontSize).toBe(48)
  })
})

describe('editorStore - playback state', () => {
  it('setCurrentTime', () => {
    useEditorStore.getState().setCurrentTime(5.5)
    expect(useEditorStore.getState().currentTime).toBe(5.5)
  })

  it('setIsPlaying', () => {
    useEditorStore.getState().setIsPlaying(true)
    expect(useEditorStore.getState().isPlaying).toBe(true)
  })

  it('setSelectedItemId clears selectedTextId', () => {
    useEditorStore.setState({ selectedTextId: 'tx1' })
    useEditorStore.getState().setSelectedItemId('t1')
    expect(useEditorStore.getState().selectedItemId).toBe('t1')
    expect(useEditorStore.getState().selectedTextId).toBeNull()
  })
})
