import { routePaths } from 'app/routePaths'
import {
  canApproveOrganizers,
  canManageActivities,
  canManageHalls,
  canOpenSellWorkspace,
} from 'lib/auth/roles'

const sellMenuItems = [
  { label: 'Sell Tickets', to: routePaths.sell },
]

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

function getManagementNavigationItem(userRole) {
  const managementMenuItems = []

  if (canManageHalls(userRole)) {
    managementMenuItems.push(
      { label: 'Add Hall', to: routePaths.adminHallNew },
    )
  }

  if (canApproveOrganizers(userRole)) {
    managementMenuItems.push(
      { label: 'Organizer Approvals', to: routePaths.adminOrganizers },
    )
  }

  if (canManageActivities(userRole)) {
    managementMenuItems.push({ label: 'Create Activity', to: routePaths.organizerActivityNew })
  }

  if (!managementMenuItems.length) {
    return null
  }

  const defaultTarget = canManageHalls(userRole)
    ? routePaths.adminHallNew
    : routePaths.organizerActivityNew

  return {
    label: 'Manage',
    to: defaultTarget,
    menuItems: managementMenuItems,
  }
}

export function getNavigationItems(userRole) {
  const managementNavigationItem = getManagementNavigationItem(userRole)
  const sellerNavigationItem = canOpenSellWorkspace(userRole)
    ? {
        label: 'Sell',
        to: routePaths.sell,
        menuItems: sellMenuItems,
      }
    : null

  return [
    baseNavigationItems[0],
    ...(sellerNavigationItem ? [sellerNavigationItem] : []),
    ...(managementNavigationItem ? [managementNavigationItem] : []),
    ...baseNavigationItems.slice(1),
  ]
}
