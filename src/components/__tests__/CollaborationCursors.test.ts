// Tests for CollaborationCursors.vue — Feature #16

import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import CollaborationCursors from '../CollaborationCursors.vue'
import type { RemoteCursor } from '../../composables/useCollaborationCursors'

function makeCursor(overrides: Partial<RemoteCursor> = {}): RemoteCursor {
  return {
    userId: 'user-1',
    displayName: 'Alice',
    color: '#6366f1',
    xPct: 50,
    yPct: 50,
    lastSeen: Date.now(),
    ...overrides,
  }
}

describe('CollaborationCursors.vue', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  test('renders no cursors when array is empty', () => {
    const wrapper = mount(CollaborationCursors, {
      props: { cursors: [] },
    })
    // No cursor divs should be present
    const overlay = wrapper.find('[aria-hidden="true"]')
    expect(overlay.exists()).toBe(true)
    // No child divs with absolute positioning (cursor elements)
    const cursors = wrapper.findAll('.absolute')
    expect(cursors.length).toBe(0)
  })

  test('renders correct count when cursors have recent lastSeen', () => {
    const now = Date.now()
    const cursors: RemoteCursor[] = [
      makeCursor({ userId: 'u1', lastSeen: now }),
      makeCursor({ userId: 'u2', displayName: 'Bob', color: '#f59e0b', lastSeen: now }),
      makeCursor({ userId: 'u3', displayName: 'Carol', color: '#10b981', lastSeen: now }),
    ]

    const wrapper = mount(CollaborationCursors, {
      props: { cursors },
    })

    const cursorEls = wrapper.findAll('.absolute')
    expect(cursorEls.length).toBe(3)
  })

  test('skips stale cursors (lastSeen > 5000ms ago)', () => {
    const now = Date.now()
    const cursors: RemoteCursor[] = [
      // Fresh cursor
      makeCursor({ userId: 'u1', lastSeen: now }),
      // Stale cursor — 6 seconds ago
      makeCursor({ userId: 'u2', displayName: 'Bob', lastSeen: now - 6000 }),
      // Borderline stale — exactly 5000ms ago (should be filtered: not < 5000)
      makeCursor({ userId: 'u3', displayName: 'Carol', lastSeen: now - 5000 }),
    ]

    const wrapper = mount(CollaborationCursors, {
      props: { cursors },
    })

    const cursorEls = wrapper.findAll('.absolute')
    // Only the fresh cursor should render
    expect(cursorEls.length).toBe(1)
  })

  test('renders display name in pill badge', () => {
    const cursor = makeCursor({ displayName: 'Alice' })
    const wrapper = mount(CollaborationCursors, {
      props: { cursors: [cursor] },
    })

    expect(wrapper.text()).toContain('Alice')
  })

  test('overlay has pointer-events: none via CSS class', () => {
    const wrapper = mount(CollaborationCursors, {
      props: { cursors: [] },
    })
    // The root div should have pointer-events-none Tailwind class
    const root = wrapper.find('.pointer-events-none')
    expect(root.exists()).toBe(true)
  })

  test('overlay is fixed position', () => {
    const wrapper = mount(CollaborationCursors, {
      props: { cursors: [] },
    })
    const root = wrapper.find('.fixed')
    expect(root.exists()).toBe(true)
  })

  test('cursor element uses transition style for smooth movement', () => {
    const cursor = makeCursor({ xPct: 30, yPct: 40 })
    const wrapper = mount(CollaborationCursors, {
      props: { cursors: [cursor] },
    })

    const cursorEl = wrapper.find('.absolute')
    const style = cursorEl.attributes('style') ?? ''
    expect(style).toContain('left: 30%')
    expect(style).toContain('top: 40%')
    expect(style).toContain('transition')
  })
})
