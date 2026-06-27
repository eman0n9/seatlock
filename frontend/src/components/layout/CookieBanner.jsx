'use client'

import { useEffect, useState } from 'react'

const COOKIE_BANNER_STORAGE_KEY = 'react_app.cookie_banner_hidden'

function readCookieBannerVisibility() {
  if (typeof window === 'undefined') {
    return true
  }

  try {
    return window.localStorage.getItem(COOKIE_BANNER_STORAGE_KEY) !== 'true'
  } catch {
    return true
  }
}

function CookieBanner() {
  const [isVisible, setIsVisible] = useState(true)

  useEffect(() => {
    setIsVisible(readCookieBannerVisibility())
  }, [])

  if (!isVisible) {
    return null
  }

  const dismiss = () => {
    setIsVisible(false)

    try {
      window.localStorage.setItem(COOKIE_BANNER_STORAGE_KEY, 'true')
    } catch {
      // Ignore storage failures and still dismiss the banner locally.
    }
  }

  return (
    <div className="cookie-banner" data-testid="cookie-compliance-banner">
      <div className="cookie-banner__inner">
        <p className="cookie-banner__text">
          By clicking "Allow All", you agree to the use of cookies to improve the
          site's functionality and marketing relevancy. Otherwise, we will only
          use strictly necessary cookies. See our{' '}
          <a href="/help/cookies" className="cookie-banner__link">
            Cookies Policy
          </a>{' '}
          for details.
        </p>

        <div className="cookie-banner__actions">
          <button
            type="button"
            className="cookie-banner__button cookie-banner__button--primary"
            onClick={dismiss}
          >
            Allow All
          </button>

          <button
            type="button"
            className="cookie-banner__button cookie-banner__button--secondary"
            onClick={dismiss}
          >
            Manage Preferences
          </button>
        </div>
      </div>
    </div>
  )
}

export default CookieBanner
