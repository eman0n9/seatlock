import { Suspense } from 'react'
import SeatMapPage from 'views/SeatMapPage'

export default async function Page({ params }) {
  const { id } = await params

  return (
    <Suspense fallback={null}>
      <SeatMapPage eventId={id} />
    </Suspense>
  )
}
