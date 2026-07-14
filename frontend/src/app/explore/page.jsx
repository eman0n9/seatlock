import ExplorePage from 'views/ExplorePage'

export default async function Page({ searchParams }) {
  const params = await searchParams
  const rawSearchText = Array.isArray(params?.q) ? params.q[0] : params?.q
  const searchText = typeof rawSearchText === 'string' ? rawSearchText.trim() : ''

  return <ExplorePage searchText={searchText} />
}
