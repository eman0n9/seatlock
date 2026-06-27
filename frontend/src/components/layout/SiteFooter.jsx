import {
  marketFooterCompanyLinks,
  marketFooterLegal,
  marketFooterLocale,
  marketFooterSupportLinks,
} from 'constants/siteContent'
import AppIcon from 'components/ui/AppIcon'

function preventNavigation(event) {
  event.preventDefault()
}

function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="site-footer__inner">
        <div className="market-footer">
          <section className="market-footer__column">
            <h2 className="market-footer__heading">Our Company</h2>

            <div className="market-footer__links">
              {marketFooterCompanyLinks.map((link) => (
                <a
                  key={link.label}
                  href={link.href}
                  className="market-footer__link"
                  onClick={preventNavigation}
                >
                  {link.label}
                </a>
              ))}
            </div>
          </section>

          <section className="market-footer__column">
            <h2 className="market-footer__heading">Have Questions?</h2>

            <div className="market-footer__links">
              {marketFooterSupportLinks.map((link) => (
                <a
                  key={link.label}
                  href={link.href}
                  className="market-footer__link"
                  onClick={preventNavigation}
                >
                  {link.label}
                </a>
              ))}
            </div>
          </section>

          <section className="market-footer__locale">
            <h2 className="market-footer__heading">{marketFooterLocale.title}</h2>

            <button type="button" className="market-footer__locale-card">
              <span className="market-footer__flag" aria-hidden="true" />
              <span>{marketFooterLocale.country}</span>
            </button>

            <button
              type="button"
              className="market-footer__locale-card market-footer__locale-card--stacked"
            >
              <span className="market-footer__locale-row">
                <AppIcon name="language" className="market-footer__locale-icon" />
                <span>{marketFooterLocale.language}</span>
              </span>

              <span className="market-footer__locale-divider" aria-hidden="true" />

              <span className="market-footer__currency">{marketFooterLocale.currency}</span>
            </button>
          </section>
        </div>

        <div className="market-footer__bottom">
          <div className="market-footer__bottom-line">
            <span className="market-footer__copy">{marketFooterLegal.copyright}</span>
            <a
              href={marketFooterLegal.companyDetails.href}
              className="market-footer__legal-link"
              onClick={preventNavigation}
            >
              {marketFooterLegal.companyDetails.label}
            </a>
          </div>

          <div className="market-footer__bottom-line market-footer__bottom-line--legal">
            <span className="market-footer__legal-prefix">
              {marketFooterLegal.acceptancePrefix}
            </span>

            {marketFooterLegal.policyLinks.map((link, index) => (
              <span key={link.label} className="market-footer__legal-fragment">
                <a
                  href={link.href}
                  className="market-footer__legal-link"
                  onClick={preventNavigation}
                >
                  {link.label}
                </a>

                {index < marketFooterLegal.policyLinks.length - 1 ? (
                  <span className="market-footer__legal-separator">and</span>
                ) : null}
              </span>
            ))}

            <button type="button" className="market-footer__privacy-choice">
              {marketFooterLegal.privacyChoices.label}
            </button>
          </div>
        </div>
      </div>
    </footer>
  )
}

export default SiteFooter
