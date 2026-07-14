'use client'

import Link from 'next/link'
import {
  marketFooterCompanyLinks,
  getMarketFooterSupportLinks,
  marketFooterLegal,
  marketFooterLocale,
} from 'constants/siteContent'
import AppIcon from 'components/ui/AppIcon'
import { useAuth } from 'features/auth/useAuth'

function SiteFooter() {
  const { isAuthenticated } = useAuth()
  const supportLinks = getMarketFooterSupportLinks(isAuthenticated)

  return (
    <footer className="site-footer">
      <div className="site-footer__inner">
        <div className="market-footer">
          <section className="market-footer__column">
            <h2 className="market-footer__heading">Our Company</h2>

            <div className="market-footer__links">
              {marketFooterCompanyLinks.map((link) => (
                <Link
                  key={link.label}
                  href={link.href}
                  className="market-footer__link"
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </section>

          <section className="market-footer__column">
            <h2 className="market-footer__heading">Have Questions?</h2>

            <div className="market-footer__links">
              {supportLinks.map((link) => (
                <Link
                  key={link.label}
                  href={link.href}
                  className="market-footer__link"
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </section>

          <section className="market-footer__locale">
            <h2 className="market-footer__heading">{marketFooterLocale.title}</h2>

            <div className="market-footer__locale-card">
              <span className="market-footer__flag" aria-hidden="true" />
              <span>{marketFooterLocale.country}</span>
            </div>

            <div className="market-footer__locale-card market-footer__locale-card--stacked">
              <span className="market-footer__locale-row">
                <AppIcon name="language" className="market-footer__locale-icon" />
                <span>{marketFooterLocale.language}</span>
              </span>

              <span className="market-footer__locale-divider" aria-hidden="true" />

              <span className="market-footer__currency">{marketFooterLocale.currency}</span>
            </div>
          </section>
        </div>

        <div className="market-footer__bottom">
          <div className="market-footer__bottom-line">
            <span className="market-footer__copy">{marketFooterLegal.copyright}</span>
            <span className="market-footer__legal-prefix">{marketFooterLegal.disclaimer}</span>
          </div>
        </div>
      </div>
    </footer>
  )
}

export default SiteFooter
