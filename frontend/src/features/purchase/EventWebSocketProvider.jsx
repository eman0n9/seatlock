'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import { useAuth } from 'features/auth/useAuth'
import {
  buildConnectionScopeKey,
  createClientMessage,
  enqueueServerMessage,
  getScopedMessageQueue,
  normalizeServerMessage,
  pruneServerMessages,
} from 'features/purchase/socketPayloads'
import { getWebSocketToken } from 'lib/api/authApi'
import { isPurchaseMockEnabled, WS_URL } from 'lib/api/runtime'

const EventWebSocketContext = createContext(null)
const RECONNECT_DELAY_MS = 2000

function buildWebSocketUrl(eventId, token) {
  const url = new URL(`${WS_URL.replace(/\/$/, '')}/ws`)
  url.searchParams.set('eventId', eventId)
  url.searchParams.set('token', token)
  return url.toString()
}

export function EventWebSocketProvider({ children, eventId }) {
  const { isAuthenticated, isLoading: isAuthLoading } = useAuth()
  const pathname = usePathname()
  const connectionScopeKey = buildConnectionScopeKey(eventId, pathname)
  const socketRef = useRef(null)
  const reconnectTimerRef = useRef(null)
  const manuallyClosedRef = useRef(false)
  const isResyncingRef = useRef(false)
  const messageIdRef = useRef(0)
  const messageQueueRef = useRef({ messages: [], scopeKey: null })
  const isReadyRef = useRef(false)
  const [connectionError, setConnectionError] = useState('')
  const [connectionState, setConnectionState] = useState('idle')
  const [messageQueueState, setMessageQueueState] = useState({
    messages: [],
    scopeKey: null,
  })
  const messageQueue = getScopedMessageQueue(messageQueueState, connectionScopeKey)
  const isMockMode = isPurchaseMockEnabled()

  useEffect(() => {
    if (isMockMode || isAuthLoading || !eventId) {
      return undefined
    }

    if (!isAuthenticated) {
      setConnectionState('closed')
      setConnectionError('Sign in to reserve seats.')
      return undefined
    }

    let isActive = true
    let tokenAbortController = null
    manuallyClosedRef.current = false
    isResyncingRef.current = false
    isReadyRef.current = false
    messageQueueRef.current = { messages: [], scopeKey: connectionScopeKey }
    setMessageQueueState({ messages: [], scopeKey: connectionScopeKey })

    const scheduleReconnect = () => {
      if (!isActive || manuallyClosedRef.current || reconnectTimerRef.current) {
        return
      }

      reconnectTimerRef.current = window.setTimeout(() => {
        reconnectTimerRef.current = null
        void connect()
      }, RECONNECT_DELAY_MS)
    }

    const connect = async () => {
      if (!isActive || manuallyClosedRef.current) {
        return
      }

      setConnectionState('connecting')
      tokenAbortController = new AbortController()

      try {
        const token = await getWebSocketToken({ signal: tokenAbortController.signal })

        if (!isActive || manuallyClosedRef.current) {
          return
        }

        const socket = new WebSocket(buildWebSocketUrl(eventId, token))
        socketRef.current = socket
        isResyncingRef.current = false

        socket.onopen = () => {
          if (!isActive || socketRef.current !== socket || isResyncingRef.current) {
            return
          }

          setConnectionError('')
        }

        socket.onmessage = (messageEvent) => {
          if (!isActive || socketRef.current !== socket || isResyncingRef.current) {
            return
          }

          try {
            const message = normalizeServerMessage(JSON.parse(messageEvent.data))

            if (!message) {
              return
            }

            messageIdRef.current += 1
            const messageId = messageIdRef.current
            const currentMessages = messageQueueRef.current.scopeKey === connectionScopeKey
              ? messageQueueRef.current.messages
              : []
            const queued = enqueueServerMessage(currentMessages, message, messageId)

            if (queued.requiresResync) {
              isResyncingRef.current = true
              isReadyRef.current = false
              messageQueueRef.current = { messages: [], scopeKey: connectionScopeKey }
              setMessageQueueState(() => ({ messages: [], scopeKey: connectionScopeKey }))
              setConnectionError('Realtime updates fell behind. Resynchronizing seat availability.')
              setConnectionState('connecting')
              socket.close(4001, 'message-backlog-overflow')
              return
            }

            messageQueueRef.current = {
              messages: queued.messages,
              scopeKey: connectionScopeKey,
            }
            setMessageQueueState((current) => {
              const messages = current.scopeKey === connectionScopeKey
                ? current.messages
                : []

              return {
                messages: enqueueServerMessage(messages, message, messageId).messages,
                scopeKey: connectionScopeKey,
              }
            })

            if (message.type === 'snapshot') {
              isReadyRef.current = true
              setConnectionState('open')
            }

            if (message.type === 'error') {
              setConnectionError(message.payload.message ?? 'Realtime seat service returned an error.')
            }
          } catch {
            setConnectionError('Realtime seat service returned an invalid message.')
          }
        }

        socket.onerror = () => {
          if (isActive && socketRef.current === socket) {
            setConnectionError('Unable to connect to realtime seat availability.')
          }
        }

        socket.onclose = () => {
          if (socketRef.current !== socket) {
            return
          }

          socketRef.current = null
          isReadyRef.current = false

          if (!isActive || manuallyClosedRef.current) {
            return
          }

          setConnectionState('closed')
          scheduleReconnect()
        }
      } catch (error) {
        if (!isActive || tokenAbortController?.signal.aborted) {
          return
        }

        setConnectionError(error.message ?? 'Unable to authorize realtime seat availability.')
        setConnectionState('closed')
        scheduleReconnect()
      }
    }

    void connect()

    return () => {
      isActive = false
      manuallyClosedRef.current = true
      tokenAbortController?.abort()
      window.clearTimeout(reconnectTimerRef.current)
      reconnectTimerRef.current = null

      const socket = socketRef.current
      socketRef.current = null
      isReadyRef.current = false
      socket?.close(1000, 'event-flow-closed')
    }
  }, [connectionScopeKey, eventId, isAuthenticated, isAuthLoading, isMockMode, pathname])

  const sendMessage = useCallback((type, payload) => {
    const socket = socketRef.current

    if (!socket || socket.readyState !== WebSocket.OPEN || !isReadyRef.current) {
      setConnectionError('Realtime seat availability is reconnecting. Try again in a moment.')
      return false
    }

    try {
      socket.send(JSON.stringify(createClientMessage(type, payload)))
      return true
    } catch (error) {
      setConnectionError(error.message ?? 'Unable to send the seat update.')
      return false
    }
  }, [])

  const acknowledgeMessages = useCallback((lastHandledId) => {
    if (!Number.isSafeInteger(lastHandledId) || lastHandledId <= 0) {
      return
    }

    if (messageQueueRef.current.scopeKey === connectionScopeKey) {
      messageQueueRef.current = {
        messages: pruneServerMessages(messageQueueRef.current.messages, lastHandledId),
        scopeKey: connectionScopeKey,
      }
    }

    setMessageQueueState((current) => (
      current.scopeKey === connectionScopeKey
        ? {
            messages: pruneServerMessages(current.messages, lastHandledId),
            scopeKey: connectionScopeKey,
          }
        : current
    ))
  }, [connectionScopeKey])

  const closeConnection = useCallback((code = 1000, reason = 'client-closed') => {
    manuallyClosedRef.current = true
    window.clearTimeout(reconnectTimerRef.current)
    reconnectTimerRef.current = null

    const socket = socketRef.current
    socketRef.current = null
    isReadyRef.current = false
    socket?.close(code, reason)
    setConnectionState('closed')
  }, [])

  const value = useMemo(() => ({
    acknowledgeMessages,
    closeConnection,
    connectionError,
    connectionState,
    eventId,
    messageQueue,
    sendMessage,
  }), [
    acknowledgeMessages,
    closeConnection,
    connectionError,
    connectionState,
    eventId,
    messageQueue,
    sendMessage,
  ])

  if (isMockMode) {
    return children
  }

  return (
    <EventWebSocketContext.Provider value={value}>
      {children}
    </EventWebSocketContext.Provider>
  )
}

export function useOptionalEventWebSocket() {
  return useContext(EventWebSocketContext)
}
