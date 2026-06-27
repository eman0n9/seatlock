'use client'

import { useState } from 'react'
import { useAuth } from 'features/auth/useAuth'
import { getUserRoleLabel } from 'lib/auth/roles'

const initialLoginForm = {
  email: 'user@example.com',
  password: 'password',
}

const initialRegisterForm = {
  email: 'user@example.com',
  password: 'password',
  name: 'Seatlock',
  surname: 'User',
  countryCode: '+420',
  phoneNumber: '777777777',
}

function AuthPanel() {
  const { isAuthenticated, isLoading, login, logout, register, user } = useAuth()
  const [loginForm, setLoginForm] = useState(initialLoginForm)
  const [registerForm, setRegisterForm] = useState(initialRegisterForm)
  const [statusMessage, setStatusMessage] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleLogin = async (event) => {
    event.preventDefault()
    setIsSubmitting(true)
    setStatusMessage('')

    try {
      await login(loginForm)
      setStatusMessage('Signed in through the auth layer.')
    } catch (error) {
      setStatusMessage(error.message ?? 'Unable to sign in.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleRegister = async (event) => {
    event.preventDefault()
    setIsSubmitting(true)
    setStatusMessage('')

    try {
      await register(registerForm)
      setStatusMessage('Registration request completed through the auth layer.')
    } catch (error) {
      setStatusMessage(error.message ?? 'Unable to register.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <section className="sync-grid">
      <section className="sync-card">
        <div className="sync-card__label">Auth</div>
        <h2 className="sync-card__title">Sign In</h2>
        <p className="sync-card__text">
          This form already goes through the shared auth API layer.
        </p>

        <form className="auth-panel__form" onSubmit={handleLogin}>
          <input
            className="auth-panel__input"
            type="email"
            name="email"
            autoComplete="email"
            required
            value={loginForm.email}
            onChange={(event) =>
              setLoginForm((current) => ({ ...current, email: event.target.value }))
            }
            placeholder="Email"
          />
          <input
            className="auth-panel__input"
            type="password"
            name="password"
            autoComplete="current-password"
            required
            value={loginForm.password}
            onChange={(event) =>
              setLoginForm((current) => ({ ...current, password: event.target.value }))
            }
            placeholder="Password"
          />
          <button className="button-link" type="submit" disabled={isSubmitting || isLoading}>
            {isSubmitting ? 'Signing in' : 'Sign In'}
          </button>
        </form>
      </section>

      <section className="sync-card">
        <div className="sync-card__label">Auth</div>
        <h2 className="sync-card__title">Register</h2>
        <p className="sync-card__text">
          Minimal UI for verifying the registration contract from the frontend.
        </p>

        <form className="auth-panel__form" onSubmit={handleRegister}>
          <input
            className="auth-panel__input"
            type="email"
            name="register-email"
            autoComplete="email"
            required
            value={registerForm.email}
            onChange={(event) =>
              setRegisterForm((current) => ({ ...current, email: event.target.value }))
            }
            placeholder="Email"
          />
          <input
            className="auth-panel__input"
            type="password"
            name="register-password"
            autoComplete="new-password"
            required
            value={registerForm.password}
            onChange={(event) =>
              setRegisterForm((current) => ({ ...current, password: event.target.value }))
            }
            placeholder="Password"
          />
          <input
            className="auth-panel__input"
            type="text"
            name="name"
            autoComplete="given-name"
            required
            value={registerForm.name}
            onChange={(event) =>
              setRegisterForm((current) => ({ ...current, name: event.target.value }))
            }
            placeholder="First name"
          />
          <input
            className="auth-panel__input"
            type="text"
            name="surname"
            autoComplete="family-name"
            required
            value={registerForm.surname}
            onChange={(event) =>
              setRegisterForm((current) => ({ ...current, surname: event.target.value }))
            }
            placeholder="Last name"
          />
          <input
            className="auth-panel__input"
            type="text"
            name="country-code"
            autoComplete="tel-country-code"
            required
            value={registerForm.countryCode}
            onChange={(event) =>
              setRegisterForm((current) => ({ ...current, countryCode: event.target.value }))
            }
            placeholder="Country code"
          />
          <input
            className="auth-panel__input"
            type="tel"
            name="phone-number"
            autoComplete="tel-national"
            required
            value={registerForm.phoneNumber}
            onChange={(event) =>
              setRegisterForm((current) => ({ ...current, phoneNumber: event.target.value }))
            }
            placeholder="Phone number"
          />
          <button className="button-link is-secondary" type="submit" disabled={isSubmitting || isLoading}>
            {isSubmitting ? 'Submitting' : 'Register'}
          </button>
        </form>
      </section>

      <section className="sync-card sync-card--wide">
        <div className="sync-card__label">Session</div>
        <h2 className="sync-card__title">
          {isLoading ? 'Loading session' : isAuthenticated ? 'Authenticated' : 'Guest session'}
        </h2>
        <p className="sync-card__text">
          {isAuthenticated
            ? `${user?.email ?? 'Unknown user'} - role ${getUserRoleLabel(user?.role)}`
            : 'No authenticated user is loaded right now.'}
        </p>
        {statusMessage ? <p className="sync-card__query">{statusMessage}</p> : null}
        {isAuthenticated ? (
          <div className="page-actions">
            <button className="button-link is-secondary" type="button" onClick={() => logout()}>
              Sign Out
            </button>
          </div>
        ) : null}
      </section>
    </section>
  )
}

export default AuthPanel
