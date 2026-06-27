'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { routePaths } from 'app/routePaths'
import PagePlaceholder from 'components/ui/PagePlaceholder'
import { useAuth } from 'features/auth/useAuth'
import { usePurchase } from 'features/purchase/usePurchase'
import { usePageTitle } from 'hooks/usePageTitle'
import {
  EMPTY_PROFILE_DASHBOARD,
  EMPTY_PROFILE_DETAILS,
  getProfileDashboard,
  getProfileDetails,
  updateProfileDetails,
} from 'lib/api/profileApi'
import { cn } from 'utils/cn'

const TABS = ['Overview', 'Orders', 'Edit Profile']

function getDisplayName(user, personalInfo) {
  if (personalInfo?.firstName || personalInfo?.lastName) {
    return [personalInfo.firstName, personalInfo.lastName].filter(Boolean).join(' ')
  }

  if (user?.username && !user.username.includes('@')) {
    return user.username
  }

  if (user?.email) {
    return user.email.split('@')[0]
  }

  return 'Guest'
}

function getInitial(displayName) {
  return (displayName?.[0] ?? '?').toUpperCase()
}

function statusClass(status) {
  const value = (status ?? '').toLowerCase()

  if (value === 'confirmed' || value === 'paid') return 'is-confirmed'
  if (value === 'valid' || value === 'sold') return 'is-valid'
  if (value === 'delivered') return 'is-delivered'
  if (value === 'cancelled' || value === 'canceled') return 'is-cancelled'
  if (value === 'used') return 'is-used'
  if (value === 'pending' || value === 'reserved') return 'is-pending'

  return ''
}

function StatusBadge({ status }) {
  return (
    <span className={cn('profile-status-badge', statusClass(status))}>
      {status}
    </span>
  )
}

function hasDisplayValue(value) {
  if (value === null || value === undefined) {
    return false
  }

  return typeof value === 'string' ? value.trim() !== '' : true
}

function formatCountdown(expiresAt) {
  if (!expiresAt) return null

  const ms = expiresAt - Date.now()
  if (ms <= 0) return 'Expired'

  const totalSeconds = Math.floor(ms / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60

  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

function OrderCard({ order }) {
  const totalLabel = order.totalPriceLabel ?? order.totalLabel
  const status = order.statusLabel ?? order.status
  const [countdown, setCountdown] = useState(() => (order.isPending ? formatCountdown(order.expiresAt) : null))

  useEffect(() => {
    if (!order.isPending || !order.expiresAt) {
      return undefined
    }

    const interval = setInterval(() => {
      setCountdown(formatCountdown(order.expiresAt))
    }, 1000)

    return () => clearInterval(interval)
  }, [order.expiresAt, order.isPending])

  return (
    <div className="profile-order-card">
      <div className="profile-order-card__info">
        <p className="profile-order-card__title">{order.eventTitle}</p>
        <p className="profile-order-card__meta">
          {[order.eventDate, order.venue].filter(Boolean).join(' - ')}
          {order.isPending && countdown ? ` - Expires in ${countdown}` : ''}
        </p>
        {order.isPending && order.ticketCount > 0 ? (
          <p className="profile-order-card__meta">
            {order.ticketCount} seat{order.ticketCount !== 1 ? 's' : ''} reserved
          </p>
        ) : null}
      </div>
      <div className="profile-order-card__right">
        {hasDisplayValue(totalLabel) ? (
          <span className="profile-order-card__total">{totalLabel}</span>
        ) : null}
        <StatusBadge status={status} />
      </div>
    </div>
  )
}

function OrdersSection({
  emptyMessage,
  errorMessage,
  isLoading,
  isWide = false,
  orders,
  showOpenOrdersCta = false,
  title,
}) {
  return (
    <section className={cn('sync-card', isWide && 'sync-card--wide')}>
      <div className="sync-card__label">Orders</div>
      <h2 className="sync-card__title">{title}</h2>

      <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {isLoading ? (
          <p className="sync-card__text">Loading...</p>
        ) : errorMessage ? (
          <p className="sync-card__text">{errorMessage}</p>
        ) : orders.length ? (
          orders.map((order) => <OrderCard key={order.id} order={order} />)
        ) : (
          <p className="profile-list-empty">{emptyMessage}</p>
        )}
      </div>

      {showOpenOrdersCta ? (
        <div className="page-actions" style={{ marginTop: 16 }}>
          <Link className="button-link is-secondary" href={routePaths.orders}>
            Open My Orders
          </Link>
        </div>
      ) : null}
    </section>
  )
}

function EditProfileTab({ onSave, profile }) {
  const [form, setForm] = useState(EMPTY_PROFILE_DETAILS)
  const [savedFlag, setSavedFlag] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const savedTimer = useRef(null)

  useEffect(() => {
    setForm(profile)
  }, [profile])

  useEffect(() => () => clearTimeout(savedTimer.current), [])

  const handleChange = (field) => (event) => {
    setForm((current) => ({ ...current, [field]: event.target.value }))
  }

  const handleSubmit = async (event) => {
    event.preventDefault()

    try {
      setSubmitError('')
      const nextProfile = await onSave(form)
      setForm(nextProfile)
      setSavedFlag(true)
      clearTimeout(savedTimer.current)
      savedTimer.current = setTimeout(() => setSavedFlag(false), 2500)
    } catch (error) {
      setSavedFlag(false)
      setSubmitError(error.message ?? 'Unable to save profile changes.')
    }
  }

  return (
    <section className="sync-card">
      <div className="sync-card__label">Account</div>
      <h2 className="sync-card__title">Edit profile</h2>

      <form className="profile-edit-form" onSubmit={handleSubmit}>
        <div className="profile-edit-form__grid">
          <div className="profile-edit-field">
            <label htmlFor="profile-firstName">First name</label>
            <input
              id="profile-firstName"
              className="auth-panel__input"
              type="text"
              value={form.firstName}
              onChange={handleChange('firstName')}
            />
          </div>

          <div className="profile-edit-field">
            <label htmlFor="profile-lastName">Last name</label>
            <input
              id="profile-lastName"
              className="auth-panel__input"
              type="text"
              value={form.lastName}
              onChange={handleChange('lastName')}
            />
          </div>

          <div className="profile-edit-field">
            <label htmlFor="profile-email">Email</label>
            <input
              id="profile-email"
              className="auth-panel__input"
              type="email"
              value={form.email}
              onChange={handleChange('email')}
            />
          </div>

          <div className="profile-edit-field">
            <label htmlFor="profile-newPassword">New password</label>
            <input
              id="profile-newPassword"
              className="auth-panel__input"
              type="password"
              placeholder="Leave blank to keep current"
              value={form.newPassword}
              onChange={handleChange('newPassword')}
              autoComplete="new-password"
            />
          </div>
        </div>

        <div className="page-actions">
          <button className="button-link" type="submit">Save changes</button>
          {savedFlag ? <span className="profile-edit-form__saved">Saved</span> : null}
        </div>
        {submitError ? <p className="sync-card__text">{submitError}</p> : null}
      </form>
    </section>
  )
}

function ProfilePage() {
  usePageTitle('Profile')

  const { isAuthenticated, isLoading, logout, user } = useAuth()
  const { clearPurchase } = usePurchase()
  const [activeTab, setActiveTab] = useState('Overview')
  const [dashboard, setDashboard] = useState(EMPTY_PROFILE_DASHBOARD)
  const [isDashboardLoading, setIsDashboardLoading] = useState(true)
  const [dashboardError, setDashboardError] = useState('')
  const [personalInfo, setPersonalInfo] = useState(EMPTY_PROFILE_DETAILS)
  const [profileError, setProfileError] = useState('')
  const [signOutError, setSignOutError] = useState('')
  const [isSigningOut, setIsSigningOut] = useState(false)

  useEffect(() => {
    if (!isAuthenticated) {
      setPersonalInfo(EMPTY_PROFILE_DETAILS)
      setProfileError('')
      return undefined
    }

    let isMounted = true

    const loadProfileDetails = async () => {
      try {
        const nextProfile = await getProfileDetails()

        if (isMounted) {
          setProfileError('')
          setPersonalInfo(nextProfile)
        }
      } catch (error) {
        if (isMounted) {
          setProfileError(error.message ?? 'Unable to load profile details.')
          setPersonalInfo(EMPTY_PROFILE_DETAILS)
        }
      }
    }

    loadProfileDetails()

    return () => {
      isMounted = false
    }
  }, [isAuthenticated])

  useEffect(() => {
    if (!isAuthenticated) {
      setDashboard(EMPTY_PROFILE_DASHBOARD)
      setDashboardError('')
      setIsDashboardLoading(false)
      return undefined
    }

    let isMounted = true

    const loadDashboard = async () => {
      try {
        setIsDashboardLoading(true)
        setDashboardError('')
        const nextDashboard = await getProfileDashboard()

        if (isMounted) {
          setDashboard(nextDashboard)
        }
      } catch (error) {
        if (isMounted) {
          setDashboardError(error.message ?? 'Unable to load profile data.')
          setDashboard(EMPTY_PROFILE_DASHBOARD)
        }
      } finally {
        if (isMounted) {
          setIsDashboardLoading(false)
        }
      }
    }

    loadDashboard()

    return () => {
      isMounted = false
    }
  }, [isAuthenticated])

  if (isLoading) {
    return (
      <section className="page-stack">
        <section className="page-card page-card--stack">
          <span className="eyebrow">Profile</span>
          <h1>Loading account</h1>
          <p className="page-description">Preparing your profile and recent purchase activity.</p>
        </section>
      </section>
    )
  }

  if (!isAuthenticated) {
    return (
      <PagePlaceholder
        eyebrow="Profile"
        title="Sign in to open your account"
        description="Your profile dashboard is ready, but it needs an authenticated session to show account and purchase data."
        actions={[
          { label: 'Open sign in', to: `${routePaths.login}?redirect=${encodeURIComponent(routePaths.profile)}` },
          { label: 'Browse events', to: routePaths.explore, variant: 'secondary' },
        ]}
      />
    )
  }

  const displayName = getDisplayName(user, personalInfo)
  const backendStatusError = [profileError, dashboardError].filter(Boolean).join(' ')
  const upcomingOrders = dashboard.upcomingOrders ?? []
  const pastOrders = dashboard.pastOrders ?? []
  const overviewUpcomingOrders = upcomingOrders.slice(0, 3)
  const overviewPastOrders = pastOrders.slice(0, 3)

  const handleProfileSave = async (nextProfile) => {
    const savedProfile = await updateProfileDetails(nextProfile)
    setPersonalInfo(savedProfile)
    setProfileError('')
    return savedProfile
  }

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

  return (
    <section className="profile-page page-stack">
      <section className="page-card">
        <div className="profile-header">
          <div className="profile-avatar" aria-hidden="true">{getInitial(displayName)}</div>
          <div className="profile-header__info">
            <h1 className="profile-header__name">{displayName}</h1>
            <p className="profile-header__email">{user?.email ?? ''}</p>
          </div>
        </div>

        {!isDashboardLoading && !dashboardError ? (
          <div className="profile-stats-row" style={{ marginTop: 20 }}>
            {dashboard.stats.map((stat) => (
              <div key={stat.label} className="profile-stat-chip">
                <span className="profile-stat-chip__value">{stat.value}</span>
                <span className="profile-stat-chip__label">{stat.label}</span>
              </div>
            ))}
          </div>
        ) : null}

        <div className="page-actions" style={{ marginTop: 20 }}>
          <Link className="button-link is-secondary" href={routePaths.explore}>
            Browse events
          </Link>
          <button
            className="button-link is-secondary"
            type="button"
            disabled={isSigningOut}
            onClick={() => void handleSignOut()}
          >
            {isSigningOut ? 'Signing out...' : 'Sign out'}
          </button>
        </div>
      </section>

      <nav className="profile-tabs" aria-label="Profile sections">
        {TABS.map((tab) => (
          <button
            key={tab}
            type="button"
            className={cn('profile-tab', activeTab === tab && 'is-active')}
            onClick={() => setActiveTab(tab)}
          >
            {tab}
          </button>
        ))}
      </nav>

      {backendStatusError ? (
        <section className="sync-card sync-card--wide">
          <div className="sync-card__label">Profile status</div>
          <h2 className="sync-card__title">Profile backend is not connected</h2>
          <p className="sync-card__text">{backendStatusError}</p>
        </section>
      ) : null}

      {signOutError ? (
        <section className="sync-card sync-card--wide">
          <div className="sync-card__label">Sign out</div>
          <h2 className="sync-card__title">Unable to sign out safely</h2>
          <p className="sync-card__text">{signOutError}</p>
        </section>
      ) : null}

      {activeTab === 'Overview' ? (
        <section className="profile-section">
          <OrdersSection
            emptyMessage="No upcoming orders yet. Start from Explore and choose seats."
            errorMessage="Orders are unavailable until the profile backend is connected."
            isLoading={isDashboardLoading}
            orders={overviewUpcomingOrders}
            showOpenOrdersCta={!isDashboardLoading && upcomingOrders.length > overviewUpcomingOrders.length}
            title="Upcoming orders"
          />

          <OrdersSection
            emptyMessage="No past orders yet."
            errorMessage="Orders are unavailable until the profile backend is connected."
            isLoading={isDashboardLoading}
            orders={overviewPastOrders}
            showOpenOrdersCta={!isDashboardLoading && pastOrders.length > overviewPastOrders.length}
            title="Past orders"
          />
        </section>
      ) : null}

      {activeTab === 'Orders' ? (
        <section className="profile-section">
          <OrdersSection
            emptyMessage="No upcoming orders yet. Start from Explore and choose seats."
            errorMessage="Orders are unavailable until the profile backend is connected."
            isLoading={isDashboardLoading}
            isWide
            orders={upcomingOrders}
            title="Upcoming orders"
          />

          <OrdersSection
            emptyMessage="No past orders yet."
            errorMessage="Orders are unavailable until the profile backend is connected."
            isLoading={isDashboardLoading}
            isWide
            orders={pastOrders}
            title="Past orders"
          />

          <section className="page-actions">
            <Link className="button-link is-secondary" href={routePaths.orders}>
              Open My Orders
            </Link>
          </section>
        </section>
      ) : null}

      {activeTab === 'Edit Profile' ? (
        <section className="profile-section">
          <EditProfileTab onSave={handleProfileSave} profile={personalInfo} />
        </section>
      ) : null}
    </section>
  )
}

export default ProfilePage
