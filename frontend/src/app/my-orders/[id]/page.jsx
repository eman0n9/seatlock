import OrderDetailsPage from 'views/OrderDetailsPage'

export default async function Page({ params }) {
  const { id } = await params

  return <OrderDetailsPage orderId={id} />
}
