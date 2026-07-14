'use client'

import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { useAuth } from 'features/auth/useAuth'
import * as favoritesApi from 'lib/api/favoritesApi'

const FavoritesContext = createContext(null)

function toggleIdInList(ids, targetId) {
  return ids.includes(targetId)
    ? ids.filter((id) => id !== targetId)
    : [...ids, targetId]
}

export function FavoritesProvider({ children }) {
  const { isAuthenticated, isLoading: isAuthLoading, user } = useAuth()
  const [favoriteActivityIds, setFavoriteActivityIds] = useState([])
  const [favoritePerformerIds, setFavoritePerformerIds] = useState([])
  const [favoriteActivities, setFavoriteActivities] = useState([])
  const [favoritePerformers, setFavoritePerformers] = useState([])

  useEffect(() => {
    let isMounted = true

    const loadFavorites = async () => {
      if (isAuthLoading) {
        return
      }

      if (!isAuthenticated) {
        if (isMounted) {
          setFavoriteActivityIds([])
          setFavoritePerformerIds([])
          setFavoriteActivities([])
          setFavoritePerformers([])
        }
        return
      }

      try {
        const nextFavoriteState = await favoritesApi.getFavoriteState()

        if (isMounted) {
          setFavoriteActivityIds(nextFavoriteState.favoriteActivityIds)
          setFavoritePerformerIds(nextFavoriteState.favoritePerformerIds)
          setFavoriteActivities(nextFavoriteState.favoriteActivities)
          setFavoritePerformers(nextFavoriteState.favoritePerformers)
        }
      } catch {
        if (isMounted) {
          setFavoriteActivityIds([])
          setFavoritePerformerIds([])
          setFavoriteActivities([])
          setFavoritePerformers([])
        }
      }
    }

    void loadFavorites()

    return () => {
      isMounted = false
    }
  }, [isAuthenticated, isAuthLoading, user?.id])

  const value = useMemo(
    () => ({
      favoriteIds: favoriteActivityIds,
      favoriteActivityIds,
      favoritePerformerIds,
      favoriteActivities,
      favoritePerformers,
      isFavorite: (eventId) => favoriteActivityIds.includes(eventId),
      isFavoriteActivity: (activityId) => favoriteActivityIds.includes(activityId),
      isFavoritePerformer: (performerId) => favoritePerformerIds.includes(performerId),
      toggleFavorite: async (eventId) => {
        if (!isAuthenticated) {
          return false
        }

        const previousFavoriteIds = favoriteActivityIds
        const nextFavoriteIds = toggleIdInList(previousFavoriteIds, eventId)
        setFavoriteActivityIds(nextFavoriteIds)

        try {
          const changed = await favoritesApi.toggleFavoriteActivity(eventId)
          return changed
        } catch (error) {
          setFavoriteActivityIds(previousFavoriteIds)
          throw error
        }
      },
      toggleFavoriteActivity: async (activityId) => {
        if (!isAuthenticated) {
          return false
        }

        const previousFavoriteIds = favoriteActivityIds
        const nextFavoriteIds = toggleIdInList(previousFavoriteIds, activityId)
        setFavoriteActivityIds(nextFavoriteIds)

        try {
          const changed = await favoritesApi.toggleFavoriteActivity(activityId)
          return changed
        } catch (error) {
          setFavoriteActivityIds(previousFavoriteIds)
          throw error
        }
      },
      toggleFavoritePerformer: async (performerId) => {
        if (!isAuthenticated) {
          return false
        }

        const previousFavoriteIds = favoritePerformerIds
        const nextFavoriteIds = toggleIdInList(previousFavoriteIds, performerId)
        setFavoritePerformerIds(nextFavoriteIds)

        try {
          const changed = await favoritesApi.toggleFavoritePerformer(performerId)
          return changed
        } catch (error) {
          setFavoritePerformerIds(previousFavoriteIds)
          throw error
        }
      },
    }),
    [favoriteActivities, favoriteActivityIds, favoritePerformers, favoritePerformerIds, isAuthenticated],
  )

  return <FavoritesContext.Provider value={value}>{children}</FavoritesContext.Provider>
}

export function useFavorites() {
  const context = useContext(FavoritesContext)

  if (!context) {
    throw new Error('useFavorites must be used within FavoritesProvider')
  }

  return context
}
