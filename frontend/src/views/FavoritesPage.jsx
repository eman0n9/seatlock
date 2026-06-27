'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import ExploreEventCard from 'components/explore/ExploreEventCard'
import AppIcon from 'components/ui/AppIcon'
import { getSeatMapRoute, routePaths } from 'app/routePaths'
import { useFavorites } from 'features/favorites/FavoritesProvider'
import { usePurchase } from 'features/purchase/usePurchase'
import { getExploreActivities } from 'lib/api/activityApi'
import { usePageTitle } from 'hooks/usePageTitle'

const FAVORITES_GUEST_PROMO_IMAGE = '/favorites-guitar-man.png'

function FavoritesEmptyRow({ title }) {
  return (
    <div className="favorites-empty-row">
      <div className="favorites-empty-row__icon" aria-hidden="true">
        <AppIcon name="favoriteSymbol" />
      </div>

      <span>{title}</span>
    </div>
  )
}

function FavoritesGuestPromo() {
  return (
    <div className="favorites-guest-promo">
      <div className="favorites-guest-promo__media" aria-hidden="true">
        <img src={FAVORITES_GUEST_PROMO_IMAGE} alt="man playing the guitar" />
        <div className="favorites-guest-promo__fade" />
      </div>

      <div className="favorites-guest-promo__content">
        <div className="favorites-guest-promo__body">
          <h3>Track your saved events here</h3>

          <Link className="favorites-pill-button" href={routePaths.explore}>
            Explore Events
          </Link>
        </div>
      </div>
    </div>
  )
}

function FavoritesPage() {
  usePageTitle('Favourites')

  const { favoriteIds, isFavorite, toggleFavorite } = useFavorites()
  const { beginPurchase } = usePurchase()
  const [events, setEvents] = useState([])
  const [isLoadingEvents, setIsLoadingEvents] = useState(true)
  const [eventsError, setEventsError] = useState('')
  const favoriteEvents = events.filter((event) => favoriteIds.includes(event.id))
  const hasFavorites = favoriteEvents.length > 0

  useEffect(() => {
    let isMounted = true

    const loadActivities = async () => {
      try {
        setIsLoadingEvents(true)
        setEventsError('')
        const nextEvents = await getExploreActivities()
        if (isMounted) {
          setEvents(nextEvents)
        }
      } catch (error) {
        if (isMounted) {
          setEventsError(error.message ?? 'Unable to load favourite events.')
        }
      } finally {
        if (isMounted) {
          setIsLoadingEvents(false)
        }
      }
    }

    loadActivities()

    return () => {
      isMounted = false
    }
  }, [])

  return (
    <section className="favorites-page">
      <div className="favorites-page__inner">
        {!hasFavorites ? (
          <section className="favorites-auth-banner">
            <div className="favorites-auth-banner__icon" aria-hidden="true">
              <AppIcon name="favoriteBookmark" />
            </div>

            <div className="favorites-auth-banner__content">
              <h2>Start saving events to see them here</h2>
              <p>
                Save events while you browse and they will appear in your
                favourites list on this device.
              </p>
            </div>

            <Link
              className="favorites-pill-button favorites-pill-button--wide"
              href={routePaths.explore}
            >
              Explore Events
            </Link>
          </section>
        ) : null}

        <header className="favorites-page__header">
          <h1>My Favourites</h1>
          <p>
            Manage your saved events and performers and get personalized
            recommendations and updates.
          </p>
        </header>

        <section className="favorites-section">
          <h2 className="favorites-section__title">Saved Events</h2>

          {eventsError ? (
            <div className="page-card page-card--stack">
              <h2>Unable to load favourites</h2>
              <p className="page-description">{eventsError}</p>
            </div>
          ) : isLoadingEvents ? (
            <div className="page-card page-card--stack">
              <h2>Loading favourites</h2>
              <p className="page-description">Fetching saved events from the current data source.</p>
            </div>
          ) : favoriteEvents.length ? (
            <div className="favorites-saved-grid">
              {favoriteEvents.map((event) => (
                <ExploreEventCard
                  key={event.id}
                  event={event}
                  isFavorite={isFavorite(event.id)}
                  onFavoriteToggle={() => toggleFavorite(event.id)}
                  onPurchaseSelect={beginPurchase}
                  purchaseHref={getSeatMapRoute(event.id)}
                />
              ))}
            </div>
          ) : (
            <FavoritesGuestPromo />
          )}
        </section>

        <section className="favorites-section favorites-section--divided">
          <h2 className="favorites-section__title">Favourite Performers</h2>
          <FavoritesEmptyRow title="No Favourites Yet" />
        </section>

        <section className="favorites-section favorites-section--divided">
          <h2 className="favorites-section__title">
            Upcoming events from your favourites
          </h2>
          <FavoritesEmptyRow title="No Favourites Yet" />
        </section>
      </div>
    </section>
  )
}

export default FavoritesPage
