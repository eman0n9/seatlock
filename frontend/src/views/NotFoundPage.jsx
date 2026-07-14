'use client'

import PagePlaceholder from 'components/ui/PagePlaceholder'
import { routePaths } from 'app/routePaths'
import { usePageTitle } from 'hooks/usePageTitle'

function NotFoundPage() {
  usePageTitle('Page not found')

  return (
    <PagePlaceholder
      eyebrow="404"
      title="Page not found"
      description="The page you requested could not be found. Return to the homepage or browse available events."
      actions={[
        { label: 'Go to buy page', to: routePaths.home },
        { label: 'Open explore', to: routePaths.explore, variant: 'secondary' },
      ]}
    />
  )
}

export default NotFoundPage
