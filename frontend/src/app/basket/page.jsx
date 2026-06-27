import { Suspense } from 'react'
import BasketPage from 'views/BasketPage'

export default function Page() {
  return (
    <Suspense fallback={null}>
      <BasketPage />
    </Suspense>
  )
}
