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
      description="This route does not exist yet. Return to the main marketplace placeholder or jump directly to the explore page."
      actions={[
        { label: 'Go to buy page', to: routePaths.home },
        { label: 'Open explore', to: routePaths.explore, variant: 'secondary' },
      ]}
    />
  )
}

export default NotFoundPage
