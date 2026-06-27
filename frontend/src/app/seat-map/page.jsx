import { Suspense } from 'react'
import SeatMapPage from 'views/SeatMapPage'

export default function Page() {
  return (
    <Suspense fallback={null}>
      <SeatMapPage />
    </Suspense>
  )
}
