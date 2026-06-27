import { siteBranding } from 'constants/branding'

function SiteLogo() {
  return <img className="site-logo" src={siteBranding.logo} alt={siteBranding.alt} />
}

export default SiteLogo
