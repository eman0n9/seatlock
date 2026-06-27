'use client'

import Link from 'next/link'
import { routePaths } from 'app/routePaths'
import { useAuth } from 'features/auth/useAuth'
import { usePageTitle } from 'hooks/usePageTitle'

function HomePage() {
  usePageTitle('Home')

  const { isAuthenticated, isLoading } = useAuth()

  return (
    <section className="page-stack">
      <section className="page-card page-card--stack">
        <span className="eyebrow">SeatLock</span>
        <h1>Buy and sell tickets with confidence</h1>
        <p className="page-description">
          Browse upcoming events, choose your seats on an interactive map and complete your purchase in minutes.
        </p>

        <div className="page-actions">
          <Link className="button-link" href={routePaths.explore}>
            Browse events
          </Link>
          {!isLoading && !isAuthenticated && (
            <Link className="button-link is-secondary" href={routePaths.login}>
              Sign in
            </Link>
          )}
          {!isLoading && isAuthenticated && (
            <Link className="button-link is-secondary" href={routePaths.profile}>
              My account
            </Link>
          )}
        </div>
      </section>
    </section>
  )
}

export default HomePage
