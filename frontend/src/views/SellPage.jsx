'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { routePaths } from 'app/routePaths'
import RoleAccessGate from 'components/auth/RoleAccessGate'
import { usePageTitle } from 'hooks/usePageTitle'
import { getMyOffers } from 'lib/api/offerApi'
import { ROLE_CODES } from 'lib/auth/roles'

function SellPage() {
  usePageTitle('Sell')

  const [offers, setOffers] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let isMounted = true

    const loadOffers = async () => {
      try {
        setIsLoading(true)
        setError('')
        const nextOffers = await getMyOffers()

        if (isMounted) {
          setOffers(nextOffers)
        }
      } catch (nextError) {
        if (isMounted) {
          setError(nextError.message ?? 'Unable to load selling data.')
        }
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    loadOffers()

    return () => {
      isMounted = false
    }
  }, [])

  return (
    <RoleAccessGate allowedRoles={[ROLE_CODES.ORGANIZATION]} featureName="the selling workspace">
      <section className="page-stack">
        <section className="page-card page-card--stack">
          <span className="eyebrow">Sell page</span>
          <h1>Sell Tickets</h1>
          <p className="page-description">
            Listings keep the backend offer shape intact and add display labels on top for the UI.
          </p>

          <div className="page-actions">
            <Link className="button-link is-secondary" href={routePaths.home}>
              Back to buy page
            </Link>
            <Link className="button-link" href={routePaths.orders}>
              Open My Orders
            </Link>
          </div>
        </section>

        {error ? (
          <section className="sync-card sync-card--wide">
            <div className="sync-card__label">API Status</div>
            <h2 className="sync-card__title">Unable to load listings</h2>
            <p className="sync-card__text">{error}</p>
          </section>
        ) : null}

        <section className="sync-grid">
          <section className="sync-card sync-card--wide">
            <div className="sync-card__label">Listings</div>
            <h2 className="sync-card__title">{isLoading ? 'Loading listings' : `${offers.length} listings ready`}</h2>
            <div className="sync-list">
              {(isLoading ? [] : offers).map((offer) => (
                <div key={offer.id}>
                  <strong>{offer.activityTitle}</strong>
                  <div>{offer.location}</div>
                  <div>{offer.priceLabel} - {offer.typeLabel}</div>
                </div>
              ))}
              {!isLoading && !offers.length ? <div>No listings available yet.</div> : null}
            </div>
          </section>
        </section>
      </section>
    </RoleAccessGate>
  )
}

export default SellPage
