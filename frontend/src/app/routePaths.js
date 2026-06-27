export const routePaths = {
  home: '/',
  login: '/login',
  explore: '/explore',
  favorites: '/favorites',
  profile: '/profile',
  event: '/event',
  seatMap: '/seat-map',
  basket: '/basket',
  purchase: '/purchase',
  sell: '/sell',
  orders: '/my-orders',
  adminHalls: '/admin/halls',
  adminHallNew: '/admin/halls/new',
  adminOrganizers: '/admin/organizers',
  organizerActivities: '/organizer/activities',
  organizerActivityNew: '/organizer/activities/new',
  notFound: '/404',
}

function appendPathSegment(path, segment) {
  if (!segment) {
    return path
  }

  return `${path}/${encodeURIComponent(segment)}`
}

function appendEventQuery(path, eventId) {
  if (!eventId) {
    return path
  }

  return `${path}?event=${encodeURIComponent(eventId)}`
}

function appendEventChildRoute(eventId, childPath) {
  if (!eventId) {
    return childPath
  }

  return `${routePaths.event}/${encodeURIComponent(eventId)}${childPath}`
}

export function getSeatMapRoute(eventId) {
  return eventId ? appendEventChildRoute(eventId, '/seatmap') : routePaths.seatMap
}

export function getBasketRoute(eventId) {
  return eventId ? appendEventChildRoute(eventId, '/cart') : routePaths.basket
}

export function getPurchaseRoute(eventId) {
  return eventId ? appendEventChildRoute(eventId, '/purchase') : routePaths.purchase
}

export function getOrderDetailsRoute(orderId) {
  return appendPathSegment(routePaths.orders, orderId)
}

export function getHallZonesRoute(hallId) {
  return appendPathSegment(appendPathSegment(routePaths.adminHalls, hallId), 'zones')
}
