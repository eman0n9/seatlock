import { EventWebSocketProvider } from 'features/purchase/EventWebSocketProvider'

export default async function EventLayout({ children, params }) {
  const { id } = await params

  return (
    <EventWebSocketProvider eventId={id}>
      {children}
    </EventWebSocketProvider>
  )
}
