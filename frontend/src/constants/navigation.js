import { routePaths } from 'app/routePaths'

const baseNavigationItems = [
  {
    label: 'Explore',
    to: routePaths.explore,
    exact: true,
  },
  {
    label: 'Favourites',
    to: routePaths.favorites,
  },
  {
    label: 'My Orders',
    to: routePaths.orders,
  },
  {
    label: 'Profile',
    to: routePaths.profile,
  },
]

export function getNavigationItems() {
  return baseNavigationItems
}
