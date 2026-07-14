import { Suspense } from 'react'
import PurchasePage from 'views/PurchasePage'

export default async function Page({ params }) {
  const { id } = await params

  return (
    <Suspense fallback={null}>
      <PurchasePage eventId={id} />
    </Suspense>
  )
}
