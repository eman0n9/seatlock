export const backendOverview = {
  apiBaseUrl: 'http://localhost:8080',
  graphqlEndpoint: '/graphql',
  authMode: 'cookie-based GraphQL requests with credentials included',
}

export const exploreBackendSources = [
  {
    title: 'Activities',
    source: 'getAllActivities',
    description:
      'Best current source for the explore feed because the backend already exposes activity cards through GraphQL.',
    fields: ['id', 'name', 'date', 'startTime', 'endTime', 'description'],
  },
  {
    title: 'Categories',
    source: 'showAllCategories',
    description:
      'Ready to support top-level explore filters and grouping.',
    fields: ['name'],
  },
  {
    title: 'Performers',
    source: 'getAllPerformers',
    description:
      'Can be used for search suggestions, performer pills, or secondary filtering.',
    fields: ['id', 'name', 'description'],
  },
  {
    title: 'Halls',
    source: 'getAllHalls',
    description:
      'Available now for venue names and location-based explore sections.',
    fields: ['id', 'name', 'address'],
  },
]

export const favoritesBackendStatus = {
  supported: true,
  reason:
    'Favorites are available through GraphQL queries and mutations with cookie-based authentication.',
  frontendPlan:
    'Persist activity and performer favorite IDs from GraphQL and use optimistic UI in views.',
}
