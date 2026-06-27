'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { routePaths } from 'app/routePaths'
import { useAuth } from 'features/auth/useAuth'
import { patchProfileDetails } from 'lib/api/profileApi'
import { isProfileMockEnabled } from 'lib/api/runtime'
import { usePageTitle } from 'hooks/usePageTitle'
import { cn } from 'utils/cn'

const initialLoginForm = {
  email: '',
  password: '',
}

const initialRegisterForm = {
  email: '',
  password: '',
  name: '',
  surname: '',
  countryCode: '+420',
  phoneNumber: '',
}

function LoginPage() {
  usePageTitle('Sign in')

  const router = useRouter()
  const searchParams = useSearchParams()
  const { isAuthenticated, isLoading, login, register } = useAuth()

  const [tab, setTab] = useState('signin')
  const [loginForm, setLoginForm] = useState(initialLoginForm)
  const [registerForm, setRegisterForm] = useState(initialRegisterForm)
  const [error, setError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const redirectTo = searchParams.get('redirect') || routePaths.explore

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      router.replace(redirectTo)
    }
  }, [isAuthenticated, isLoading, redirectTo, router])

  const handleLoginChange = (field) => (e) => {
    setLoginForm((c) => ({ ...c, [field]: e.target.value }))
  }

  const handleRegisterChange = (field) => (e) => {
    setRegisterForm((c) => ({ ...c, [field]: e.target.value }))
  }

  const switchTab = (next) => {
    setTab(next)
    setError('')
    setSuccessMessage('')
  }

  const handleLogin = async (e) => {
    e.preventDefault()
    setIsSubmitting(true)
    setError('')
    setSuccessMessage('')

    try {
      await login(loginForm)
      router.push(redirectTo)
    } catch (err) {
      setError(err.message ?? 'Unable to sign in. Check your credentials and try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleRegister = async (e) => {
    e.preventDefault()
    setIsSubmitting(true)
    setError('')
    setSuccessMessage('')

    try {
      await register(registerForm)
      if (isProfileMockEnabled()) {
        await patchProfileDetails({
          firstName: registerForm.name,
          lastName: registerForm.surname,
        })
      }
      setRegisterForm(initialRegisterForm)
      setLoginForm((f) => ({ ...f, email: registerForm.email }))
      setTab('signin')
      setSuccessMessage('Account created successfully. Sign in below.')
    } catch (err) {
      setError(err.message ?? 'Unable to create account. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isLoading) {
    return (
      <div className="login-page">
        <div className="login-card">
          <p className="login-card__loading">Loading&hellip;</p>
        </div>
      </div>
    )
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-card__header">
          <h1 className="login-card__title">
            {tab === 'signin' ? 'Welcome back' : 'Create account'}
          </h1>
          <p className="login-card__subtitle">
            {tab === 'signin'
              ? 'Sign in to your SeatLock account'
              : 'Register to start buying tickets'}
          </p>
        </div>

        <div className="login-tabs">
          <button
            type="button"
            className={cn('login-tab', tab === 'signin' && 'is-active')}
            onClick={() => switchTab('signin')}
          >
            Sign in
          </button>
          <button
            type="button"
            className={cn('login-tab', tab === 'register' && 'is-active')}
            onClick={() => switchTab('register')}
          >
            Create account
          </button>
        </div>

        {successMessage && (
          <div className="login-feedback login-feedback--success">{successMessage}</div>
        )}

        {error && (
          <div className="login-feedback login-feedback--error">{error}</div>
        )}

        {tab === 'signin' && (
          <form className="login-form" onSubmit={handleLogin}>
            <div className="login-field">
              <label htmlFor="login-email">Email</label>
              <input
                id="login-email"
                className="auth-panel__input"
                type="email"
                name="email"
                autoComplete="email"
                required
                value={loginForm.email}
                onChange={handleLoginChange('email')}
              />
            </div>

            <div className="login-field">
              <label htmlFor="login-password">Password</label>
              <input
                id="login-password"
                className="auth-panel__input"
                type="password"
                name="password"
                autoComplete="current-password"
                required
                value={loginForm.password}
                onChange={handleLoginChange('password')}
              />
            </div>

            <button className="button-link login-submit" type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Signing in\u2026' : 'Sign in'}
            </button>
          </form>
        )}

        {tab === 'register' && (
          <form className="login-form" onSubmit={handleRegister}>
            <div className="login-form__grid">
              <div className="login-field">
                <label htmlFor="reg-name">First name</label>
                <input
                  id="reg-name"
                  className="auth-panel__input"
                  type="text"
                  name="name"
                  autoComplete="given-name"
                  required
                  value={registerForm.name}
                  onChange={handleRegisterChange('name')}
                />
              </div>

              <div className="login-field">
                <label htmlFor="reg-surname">Last name</label>
                <input
                  id="reg-surname"
                  className="auth-panel__input"
                  type="text"
                  name="surname"
                  autoComplete="family-name"
                  required
                  value={registerForm.surname}
                  onChange={handleRegisterChange('surname')}
                />
              </div>
            </div>

            <div className="login-field">
              <label htmlFor="reg-email">Email</label>
              <input
                id="reg-email"
                className="auth-panel__input"
                type="email"
                name="email"
                autoComplete="email"
                required
                value={registerForm.email}
                onChange={handleRegisterChange('email')}
              />
            </div>

            <div className="login-field">
              <label htmlFor="reg-password">Password</label>
              <input
                id="reg-password"
                className="auth-panel__input"
                type="password"
                name="password"
                autoComplete="new-password"
                required
                value={registerForm.password}
                onChange={handleRegisterChange('password')}
              />
            </div>

            <div className="login-form__grid login-form__grid--phone">
              <div className="login-field">
                <label htmlFor="reg-countrycode">Country code</label>
                <input
                  id="reg-countrycode"
                  className="auth-panel__input"
                  type="text"
                  name="countryCode"
                  autoComplete="tel-country-code"
                  required
                  value={registerForm.countryCode}
                  onChange={handleRegisterChange('countryCode')}
                />
              </div>

              <div className="login-field">
                <label htmlFor="reg-phone">Phone number</label>
                <input
                  id="reg-phone"
                  className="auth-panel__input"
                  type="tel"
                  name="phoneNumber"
                  autoComplete="tel-national"
                  required
                  value={registerForm.phoneNumber}
                  onChange={handleRegisterChange('phoneNumber')}
                />
              </div>
            </div>

            <button className="button-link login-submit" type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Creating account\u2026' : 'Create account'}
            </button>
          </form>
        )}

        <div className="login-card__footer">
          <Link className="login-card__explore-link" href={routePaths.explore}>
            Browse events without an account
          </Link>
        </div>
      </div>
    </div>
  )
}

export default LoginPage
