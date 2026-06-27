import { Suspense } from 'react'
import PurchasePage from 'views/PurchasePage'

export default function Page() {
  return (
    <Suspense fallback={null}>
      <PurchasePage />
    </Suspense>
  )
}
