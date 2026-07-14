'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { routePaths } from 'app/routePaths'
import SiteFooter from 'components/layout/SiteFooter'
import SiteHeader from 'components/layout/SiteHeader'
import SiteMobileNav from 'components/layout/SiteMobileNav'
import { getNavigationItems } from 'constants/navigation'
import { cn } from 'utils/cn'

const LEGACY_ORDER_PATHS = ['/my-tickets']

const MARKET_PATH_PREFIXES = [
  routePaths.explore,
  routePaths.favorites,
  routePaths.profile,
  routePaths.event,
  routePaths.seatMap,
  routePaths.basket,
  routePaths.purchase,
  routePaths.orders,
  routePaths.adminHalls,
  routePaths.adminOrganizers,
  routePaths.organizerActivities,
  ...LEGACY_ORDER_PATHS,
]

function isMarketRoute(pathname) {
  return MARKET_PATH_PREFIXES.some((path) =>
    pathname === path || pathname.startsWith(`${path}/`),
  )
}

function MainLayout({ children }) {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const pathname = usePathname()
  const isMarketPage = isMarketRoute(pathname)
  const shouldShowNotifications = isMarketPage || pathname === routePaths.home || pathname === routePaths.login
  const headerVariant = isMarketPage ? 'market' : 'default'
  const headerNavigationItems = getNavigationItems()

  useEffect(() => {
    setIsMenuOpen(false)
  }, [pathname])

  return (
    <div className="app-shell">
      <SiteHeader
        items={headerNavigationItems}
        variant={headerVariant}
        showNotifications={shouldShowNotifications}
        showMenuButton={true}
        onMenuButtonClick={() => setIsMenuOpen(true)}
      />

      <main className="layout-main">
        <div className={cn('page-content', isMarketPage && 'page-content--market')}>
          {children}
        </div>
      </main>

      <SiteFooter />
      {isMenuOpen ? (
        <div
          className="mobile-drawer"
          role="presentation"
          onClick={() => setIsMenuOpen(false)}
        >
          <button
            type="button"
            className="mobile-drawer__close"
            aria-label="Close menu"
            onClick={() => setIsMenuOpen(false)}
          >
            x
          </button>

          <div
            className="mobile-drawer__panel"
            role="dialog"
            aria-modal="true"
            aria-label="Site menu"
            onClick={(event) => event.stopPropagation()}
          >
            <SiteMobileNav
              items={headerNavigationItems}
              onItemClick={() => setIsMenuOpen(false)}
            />
          </div>
        </div>
      ) : null}
    </div>
  )
}

export default MainLayout
