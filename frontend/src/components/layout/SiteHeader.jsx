'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { getExploreSearchRoute, routePaths } from 'app/routePaths'
import SiteLogo from 'components/layout/SiteLogo'
import AppIcon from 'components/ui/AppIcon'
import { marketDisclosureText } from 'constants/siteContent'
import { useAuth } from 'features/auth/useAuth'
import { usePurchase } from 'features/purchase/usePurchase'
import { getBasketRoute } from 'app/routePaths'
import { getProfileDetails, PROFILE_UPDATED_EVENT } from 'lib/api/profileApi'
import { cn } from 'utils/cn'

function isActivePath(pathname, href, exact = false) {
  const normalizedHref = href.split('#')[0]

  if (normalizedHref === routePaths.home) {
    return pathname === routePaths.home
  }

  return exact
    ? pathname === normalizedHref
    : pathname === normalizedHref || pathname.startsWith(`${normalizedHref}/`)
}

function HeaderNavItem({ item, pathname }) {
  const linkClassName = cn(
    'site-nav-link',
    isActivePath(pathname, item.to, item.exact) && 'is-active',
  )

  if (!item.menuItems?.length) {
    return (
      <Link className={linkClassName} href={item.to}>
        {item.label}
      </Link>
    )
  }

  return (
    <div className="site-nav-item site-nav-item--has-menu">
      <Link className={linkClassName} href={item.to}>
        {item.label}
      </Link>

      <div className="site-nav-menu" role="menu" aria-label={`${item.label} menu`}>
        {item.menuItems.map((menuItem) => (
          <Link key={menuItem.label} className="site-nav-menu__link" href={menuItem.to}>
            {menuItem.label}
          </Link>
        ))}
      </div>
    </div>
  )
}

function SiteHeader({
  items = [],
  onMenuButtonClick,
  showNotifications = false,
  showMenuButton = false,
  variant = 'default',
}) {
  const pathname = usePathname()
  const router = useRouter()
  const [searchValue, setSearchValue] = useState('')
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false)
  const notificationsRef = useRef(null)
  const isMarketVariant = variant === 'market'
  const headerLabel = 'Open site menu'
  const logoTarget = routePaths.home
  const { isAuthenticated, isLoading, logout, user } = useAuth()
  const { clearPurchase, selectedSeatCount, selectedEvent } = usePurchase()
  const [displayName, setDisplayName] = useState('')
  const [isSigningOut, setIsSigningOut] = useState(false)
  const [signOutError, setSignOutError] = useState('')

  useEffect(() => {
    if (!isAuthenticated) {
      setDisplayName('')
      setSignOutError('')
      return undefined
    }

    let isMounted = true

    const refreshProfileName = async () => {
      try {
        const { firstName, lastName } = await getProfileDetails()

        if (isMounted) {
          setDisplayName([firstName, lastName].filter(Boolean).join(' '))
        }
      } catch {
        if (isMounted) {
          setDisplayName('')
        }
      }
    }

    const handleProfileUpdated = () => {
      refreshProfileName()
    }

    refreshProfileName()
    window.addEventListener(PROFILE_UPDATED_EVENT, handleProfileUpdated)

    return () => {
      isMounted = false
      window.removeEventListener(PROFILE_UPDATED_EVENT, handleProfileUpdated)
    }
  }, [isAuthenticated])

  useEffect(() => {
    setIsNotificationsOpen(false)
  }, [variant])

  useEffect(() => {
    if (!isNotificationsOpen) {
      return undefined
    }

    const handlePointerDown = (event) => {
      if (!notificationsRef.current?.contains(event.target)) {
        setIsNotificationsOpen(false)
      }
    }

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setIsNotificationsOpen(false)
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isNotificationsOpen])

  const handleSignOut = async () => {
    if (isSigningOut) {
      return
    }

    setSignOutError('')
    setIsSigningOut(true)

    try {
      await clearPurchase()
      await logout()
    } catch (error) {
      setSignOutError(error.message ?? 'Unable to sign out while seats are still reserved.')
    } finally {
      setIsSigningOut(false)
    }
  }

  const handleSearchSubmit = (event) => {
    event.preventDefault()
    router.push(getExploreSearchRoute(searchValue))
  }

  return (
    <header
      className={cn(
        'site-header',
        isMarketVariant && 'site-header--market',
      )}
    >
      {isMarketVariant ? (
        <div className="site-header__disclosure" role="note" aria-label="Marketplace notice">
          <div className="site-header__disclosure-inner">
            <span className="site-header__disclosure-text">{marketDisclosureText}</span>

            <span
              className="site-header__disclosure-info"
              aria-hidden="true"
            >
              <AppIcon name="info" className="site-header__disclosure-icon" />
            </span>
          </div>
        </div>
      ) : null}

      <div className="site-header__inner">
        <div className="site-header__start">
          <button
            type="button"
            className={cn(
              'mobile-menu-button',
              showMenuButton && 'mobile-menu-button--enabled',
            )}
            aria-label={headerLabel}
            onClick={onMenuButtonClick}
          >
            <span />
            <span />
            <span />
          </button>

          <Link className="site-logo-link" href={logoTarget}>
            <SiteLogo />
          </Link>
        </div>

        {isMarketVariant ? (
          <div className="site-header__search-wrap">
            <form className="site-search" role="search" onSubmit={handleSearchSubmit}>
              <button
                type="submit"
                className="site-search__icon site-search__submit"
                aria-label="Search events"
              >
                <AppIcon name="search" className="site-header__icon" />
              </button>

              <input
                type="text"
                value={searchValue}
                placeholder="Search events, artists, teams and more"
                aria-label="Search events, artists, teams and more"
                maxLength={200}
                onChange={(event) => setSearchValue(event.target.value)}
              />
            </form>
          </div>
        ) : null}

        <nav
          className={cn(
            'site-header__nav',
            isMarketVariant && 'site-header__nav--market',
          )}
          aria-label="Primary navigation"
        >
          {items.map((item) => (
            <HeaderNavItem key={`${item.label}-${item.to}`} item={item} pathname={pathname} />
          ))}
        </nav>

        <div
          className={cn(
            'site-header__actions',
            showNotifications && 'site-header__actions--market',
          )}
        >
          {isMarketVariant && (
            <Link
              className={cn('header-cart', selectedSeatCount === 0 && 'header-cart--empty')}
              href={getBasketRoute(selectedEvent?.id)}
              aria-label={selectedSeatCount > 0
                ? `Basket - ${selectedSeatCount} seat${selectedSeatCount === 1 ? '' : 's'} selected`
                : 'Basket'
              }
            >
              <AppIcon name="cart" className="site-header__icon" />
              {selectedSeatCount > 0 && (
                <span className="header-cart__badge">{selectedSeatCount}</span>
              )}
            </Link>
          )}

          {!isLoading && (
            <div className="header-auth">
              {isAuthenticated ? (
                <>
                  <span className="header-auth__user">
                    {displayName || user?.email?.split('@')[0] || 'Account'}
                  </span>
                  <button
                    type="button"
                    className="header-auth__signout"
                    disabled={isSigningOut}
                    onClick={() => void handleSignOut()}
                  >
                    {isSigningOut ? 'Signing out...' : 'Sign out'}
                  </button>
                </>
              ) : (
                <Link className="header-auth__signin" href={routePaths.login}>
                  Sign in
                </Link>
              )}
              {signOutError ? (
                <span className="header-auth__error" role="alert">{signOutError}</span>
              ) : null}
            </div>
          )}

          {showNotifications ? (
            <div
              ref={notificationsRef}
              className={cn(
                'site-notifications',
                isNotificationsOpen && 'site-notifications--open',
              )}
            >
              <button
                type="button"
                className={cn(
                  'site-icon-button site-icon-button--market',
                  isNotificationsOpen && 'is-active',
                )}
                aria-label="Notifications"
                aria-expanded={isNotificationsOpen}
                aria-haspopup="dialog"
                onClick={() => setIsNotificationsOpen((current) => !current)}
              >
                <AppIcon
                  name="marketBellGlyph"
                  className="site-header__icon site-header__icon--market-action site-header__icon--market-bell"
                />
              </button>

              <div
                className={cn(
                  'site-notifications__panel',
                  isNotificationsOpen && 'is-open',
                )}
                role="dialog"
                aria-label="Notifications"
              >
                <div className="site-notifications__header">Notifications</div>

                <div className="site-notifications__body">
                  <AppIcon
                    name="marketBellGlyph"
                    className="site-notifications__empty-icon"
                  />
                  <p className="site-notifications__empty-text">No notifications</p>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </header>
  )
}

export default SiteHeader
