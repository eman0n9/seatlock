'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from 'features/auth/useAuth'
import { calculatePricing } from 'features/purchase/purchaseUtils'
import { clearSeatReservations, toggleSeatReservation } from 'lib/api/purchaseApi'
import { isPurchaseMockEnabled } from 'lib/api/runtime'

const PurchaseContext = createContext(null)
const STORAGE_MODE = isPurchaseMockEnabled() ? 'mock' : 'real'

// { currentEventId: string|null, items: { [eventId]: { event, seats, holdExpiresAt } } }
const initialState = {
  currentEventId: null,
  items: {},
}

function buildStorageKey(scope) {
  return `seatlock.purchase.${STORAGE_MODE}.session.${encodeURIComponent(scope)}.v3`
}

function readStoredState(storageKey) {
  if (typeof window === 'undefined') {
    return initialState
  }

  try {
    const value = window.sessionStorage.getItem(storageKey)

    if (!value) {
      return initialState
    }

    const parsed = JSON.parse(value)
    const items = {}

    if (parsed?.items && typeof parsed.items === 'object') {
      for (const [eventId, item] of Object.entries(parsed.items)) {
        if (item?.event?.id && Array.isArray(item.seats)) {
          items[eventId] = {
            event: item.event,
            seats: item.seats,
            holdExpiresAt: typeof item.holdExpiresAt === 'number' ? item.holdExpiresAt : null,
          }
        }
      }
    }

    return {
      currentEventId: parsed?.currentEventId ?? null,
      items,
    }
  } catch {
    return initialState
  }
}

function normalizeEvent(event) {
  if (!event) {
    return null
  }

  return {
    id: event.id,
    title: event.title ?? 'Selected event',
    dateLabel: event.dateLabel ?? 'Date TBA',
    timeLabel: event.timeLabel ?? 'Time TBA',
    venue: event.venue ?? 'Venue TBA',
    category: event.category ?? 'all',
    subcategory: event.subcategory ?? '',
    priceTier: event.priceTier ?? '$$',
    art: event.art ?? 'rose-stage',
  }
}

function normalizeSeat(seat) {
  if (!seat) {
    return null
  }

  return {
    id: seat.id,
    label: seat.label,
    price: seat.price,
    rowLabel: seat.rowLabel,
    rowNumber: seat.rowNumber,
    seatNumber: seat.seatNumber,
    sectionLabel: seat.sectionLabel,
  }
}

export function PurchaseProvider({ children }) {
  const { user } = useAuth()
  const [state, setState] = useState(initialState)
  const [isReady, setIsReady] = useState(false)
  const [tick, setTick] = useState(0)
  const [isUpdatingSelection, setIsUpdatingSelection] = useState(false)
  const [purchaseError, setPurchaseError] = useState('')
  const intervalRef = useRef(null)
  const stateRef = useRef(initialState)
  const hasHydratedRef = useRef(false)
  const authScope = user?.id ?? user?.email ?? 'guest'
  const storageKey = useMemo(() => buildStorageKey(authScope), [authScope])
  const previousAuthScopeRef = useRef(authScope)
  const hasTrackedHold = useMemo(
    () => Object.values(state.items).some((item) => item.holdExpiresAt !== null),
    [state.items],
  )

  useEffect(() => {
    stateRef.current = state
  }, [state])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    const previousAuthScope = previousAuthScopeRef.current
    previousAuthScopeRef.current = authScope
    setPurchaseError('')

    if (!hasHydratedRef.current) {
      hasHydratedRef.current = true
      setState(readStoredState(storageKey))
      setIsReady(true)
      return
    }

    const hasActiveItems = Object.values(stateRef.current.items).some((item) => item.seats.length > 0)

    if (previousAuthScope === 'guest' && authScope !== 'guest' && hasActiveItems) {
      window.sessionStorage.removeItem(buildStorageKey(previousAuthScope))
      return
    }

    setState(initialState)
  }, [authScope, storageKey])

  useEffect(() => {
    if (!isReady || typeof window === 'undefined') {
      return
    }

    window.sessionStorage.setItem(storageKey, JSON.stringify(state))
  }, [isReady, state, storageKey])

  useEffect(() => {
    if (!isReady || !hasTrackedHold) {
      return
    }

    intervalRef.current = setInterval(() => {
      setTick((currentTick) => currentTick + 1)
    }, 1000)

    return () => {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
  }, [hasTrackedHold, isReady])

  const beginPurchase = useCallback((event) => {
    const nextEvent = normalizeEvent(event)

    if (!nextEvent) {
      return
    }

    setState((current) => {
      const existing = current.items[nextEvent.id]

      return {
        currentEventId: nextEvent.id,
        items: existing
          ? { ...current.items, [nextEvent.id]: { ...existing, event: nextEvent } }
          : { ...current.items, [nextEvent.id]: { event: nextEvent, seats: [], holdExpiresAt: null } },
      }
    })
  }, [])

  const setCurrentEvent = useCallback((eventId) => {
    setState((current) => {
      if (!current.items[eventId]) {
        return current
      }

      return { ...current, currentEventId: eventId }
    })
  }, [])

  const toggleSeatSelection = useCallback(async (seat, eventId) => {
    const nextSeat = normalizeSeat(seat)
    const current = stateRef.current
    const targetId = eventId ?? current.currentEventId

    if (!nextSeat || !targetId) {
      return
    }

    const item = current.items[targetId]

    if (!item) {
      return
    }

    setPurchaseError('')
    setIsUpdatingSelection(true)

    try {
      const nextSelection = await toggleSeatReservation({
        event: item.event,
        currentSeats: item.seats,
        seat: nextSeat,
      })

      setState((latest) => {
        const latestItem = latest.items[targetId]

        if (!latestItem) {
          return latest
        }

        return {
          ...latest,
          items: {
            ...latest.items,
            [targetId]: {
              ...latestItem,
              seats: nextSelection.selectedSeats,
              holdExpiresAt: nextSelection.holdExpiresAt,
            },
          },
        }
      })
    } catch (error) {
      setPurchaseError(error.message ?? 'Unable to update seat selection.')
    } finally {
      setIsUpdatingSelection(false)
    }
  }, [])

  const clearSeats = useCallback(async (eventId) => {
    const current = stateRef.current
    const targetId = eventId ?? current.currentEventId

    if (!targetId || !current.items[targetId]) {
      return
    }

    setPurchaseError('')
    setIsUpdatingSelection(true)

    try {
      const nextSelection = await clearSeatReservations({
        event: current.items[targetId].event,
        currentSeats: current.items[targetId].seats,
      })

      setState((latest) => {
        const latestItem = latest.items[targetId]

        if (!latestItem) {
          return latest
        }

        return {
          ...latest,
          items: {
            ...latest.items,
            [targetId]: {
              ...latestItem,
              seats: nextSelection.selectedSeats,
              holdExpiresAt: nextSelection.holdExpiresAt,
            },
          },
        }
      })
    } catch (error) {
      setPurchaseError(error.message ?? 'Unable to clear seat selection.')
    } finally {
      setIsUpdatingSelection(false)
    }
  }, [])

  const removeEventFromBasket = useCallback((eventId) => {
    setState((current) => {
      const nextItems = { ...current.items }

      delete nextItems[eventId]

      const nextCurrentId = current.currentEventId === eventId
        ? (Object.keys(nextItems)[0] ?? null)
        : current.currentEventId

      return { currentEventId: nextCurrentId, items: nextItems }
    })
  }, [])

  const clearPurchase = useCallback(async () => {
    const currentEntries = Object.entries(stateRef.current.items)
      .filter(([, item]) => item.seats.length > 0)

    setPurchaseError('')

    if (currentEntries.length > 0) {
      setIsUpdatingSelection(true)

      const results = await Promise.allSettled(
        currentEntries.map(([, item]) => clearSeatReservations({
          event: item.event,
          currentSeats: item.seats,
        })),
      )

      const failedResult = results.find((result) => result.status === 'rejected')

      setState((latest) => {
        const nextItems = { ...latest.items }

        results.forEach((result, index) => {
          if (result.status !== 'fulfilled') {
            return
          }

          const [eventId] = currentEntries[index]
          const latestItem = nextItems[eventId]

          if (!latestItem) {
            return
          }

          nextItems[eventId] = {
            ...latestItem,
            seats: result.value.selectedSeats,
            holdExpiresAt: result.value.holdExpiresAt,
          }
        })

        const remainingEntries = Object.entries(nextItems)
          .filter(([, item]) => item.seats.length > 0)

        if (remainingEntries.length === 0) {
          return initialState
        }

        const nextCurrentId = nextItems[latest.currentEventId]?.seats.length
          ? latest.currentEventId
          : remainingEntries[0][0]

        return {
          currentEventId: nextCurrentId,
          items: nextItems,
        }
      })

      setIsUpdatingSelection(false)

      if (failedResult?.status === 'rejected') {
        const error = failedResult.reason instanceof Error
          ? failedResult.reason
          : new Error('Unable to clear reserved seats.')
        setPurchaseError(error.message ?? 'Unable to clear reserved seats.')
        throw error
      }
    } else {
      setState(initialState)
    }
  }, [])

  const clearPurchaseError = useCallback(() => {
    setPurchaseError('')
  }, [])

  const syncCurrentEventSelection = useCallback((eventId, seats, { holdExpiresAt } = {}) => {
    const normalizedSeats = Array.isArray(seats)
      ? seats.map(normalizeSeat).filter(Boolean)
      : []

    setState((current) => {
      const targetId = eventId ?? current.currentEventId
      const currentItem = targetId ? current.items[targetId] : null

      if (!targetId || !currentItem) {
        return current
      }

      return {
        ...current,
        currentEventId: targetId,
        items: {
          ...current.items,
          [targetId]: {
            ...currentItem,
            seats: normalizedSeats,
            holdExpiresAt: normalizedSeats.length ? (holdExpiresAt ?? null) : null,
          },
        },
      }
    })
  }, [])

  void tick
  const currentItem = state.items[state.currentEventId] ?? null
  const selectedEvent = currentItem?.event ?? null
  const selectedSeats = currentItem?.seats ?? []
  const holdExpiresAt = currentItem?.holdExpiresAt ?? null
  const holdTimeLeft = holdExpiresAt
    ? Math.max(0, Math.floor((holdExpiresAt - Date.now()) / 1000))
    : null
  const pricing = calculatePricing(selectedSeats)

  const selectedSeatCount = useMemo(
    () => Object.values(state.items).reduce((sum, item) => sum + item.seats.length, 0),
    [state.items],
  )

  const allItems = useMemo(
    () => Object.values(state.items).filter((item) => item.seats.length > 0),
    [state.items],
  )

  const isSeatSelected = useCallback(
    (seatId) => currentItem?.seats.some((seat) => seat.id === seatId) ?? false,
    [currentItem?.seats],
  )

  const value = useMemo(() => ({
    allItems,
    beginPurchase,
    clearPurchase,
    clearPurchaseError,
    clearSeats,
    holdExpiresAt,
    holdTimeLeft,
    isReady,
    isSeatSelected,
    isUpdatingSelection,
    pricing,
    purchaseError,
    removeEventFromBasket,
    selectedEvent,
    selectedSeatCount,
    selectedSeats,
    setCurrentEvent,
    syncCurrentEventSelection,
    toggleSeatSelection,
  }), [
    allItems,
    beginPurchase,
    clearPurchase,
    clearPurchaseError,
    clearSeats,
    holdExpiresAt,
    holdTimeLeft,
    isReady,
    isSeatSelected,
    isUpdatingSelection,
    pricing,
    purchaseError,
    removeEventFromBasket,
    selectedEvent,
    selectedSeatCount,
    selectedSeats,
    setCurrentEvent,
    syncCurrentEventSelection,
    toggleSeatSelection,
  ])

  return <PurchaseContext.Provider value={value}>{children}</PurchaseContext.Provider>
}

export function usePurchase() {
  const context = useContext(PurchaseContext)

  if (!context) {
    throw new Error('usePurchase must be used within PurchaseProvider')
  }

  return context
}
