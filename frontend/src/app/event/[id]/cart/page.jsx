import BasketPage from 'views/BasketPage'

export default async function Page({ params }) {
  const { id } = await params

  return <BasketPage eventId={id} />
}
