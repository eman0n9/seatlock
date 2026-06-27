import { getMyOffers } from 'lib/api/offerApi'
import { getMyOrders } from 'lib/api/ticketApi'
import { readPersonalInfo, savePersonalInfo } from 'lib/api/mock/profileStorage'
import { fetchGraphQL } from 'lib/api/graphqlClient'
import { CURRENT_USER_QUERY, GET_ORDERS_QUERY, GET_CART_QUERY, EXPLORE_ACTIVITY_BY_ID_QUERY } from 'lib/api/graphql/queries'
import { UPDATE_USER_MUTATION } from 'lib/api/graphql/mutations'
import { mapOrderToViewModel } from 'lib/api/mappers/ticketMapper'
import { isProfileMockEnabled } from 'lib/api/runtime'

export const PROFILE_UPDATED_EVENT = 'seatlock:profile-updated'
export const EMPTY_PROFILE_DETAILS = {
  firstName: '',
  lastName: '',
  email: '',
  newPassword: '',
}

export const EMPTY_PROFILE_DASHBOARD = {
  offers: [],
  orders: [],
  pastOrders: [],
  upcomingOrders: [],
  stats: [
    { label: 'Orders', value: 0 },
    { label: 'Upcoming', value: 0 },
    { label: 'Listings', value: 0 },
  ],
}

const MONTH_INDEX_MAP = {
  apr: 3,
  aug: 7,
  dec: 11,
  feb: 1,
  jan: 0,
  jul: 6,
  jun: 5,
  mar: 2,
  may: 4,
  nov: 10,
  oct: 9,
  sep: 8,
}

function normalizeProfileDetails(details = {}) {
  return {
    firstName: details.firstName ?? EMPTY_PROFILE_DETAILS.firstName,
    lastName: details.lastName ?? EMPTY_PROFILE_DETAILS.lastName,
    email: details.email ?? EMPTY_PROFILE_DETAILS.email,
    newPassword: '',
  }
}

function normalizeCalendarDate(value) {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate())
}

function parseOrderEventDate(value) {
  if (!value || value === 'Date TBA' || value === 'Date unavailable') {
    return null
  }

  const directDate = new Date(value)
  if (!Number.isNaN(directDate.getTime())) {
    return normalizeCalendarDate(directDate)
  }

  const normalizedValue = value.toString().replace(',', ' ').trim()
  const parts = normalizedValue.split(/\s+/)
  const currentYear = new Date().getFullYear()

  if (parts.length >= 3) {
    const day = Number.parseInt(parts[1], 10)
    const month = MONTH_INDEX_MAP[parts[2]?.slice(0, 3).toLowerCase()]

    if (Number.isFinite(day) && month !== undefined) {
      return new Date(currentYear, month, day)
    }
  }

  if (parts.length >= 2) {
    const day = Number.parseInt(parts[0], 10)
    const month = MONTH_INDEX_MAP[parts[1]?.slice(0, 3).toLowerCase()]

    if (Number.isFinite(day) && month !== undefined) {
      return new Date(currentYear, month, day)
    }
  }

  return null
}

function compareByCreatedAtDesc(left, right) {
  const leftTime = new Date(left?.createdAt ?? 0).getTime()
  const rightTime = new Date(right?.createdAt ?? 0).getTime()
  return rightTime - leftTime
}

function compareUpcomingOrders(left, right) {
  const leftDate = parseOrderEventDate(left?.eventDate)
  const rightDate = parseOrderEventDate(right?.eventDate)

  if (!leftDate && !rightDate) {
    return compareByCreatedAtDesc(left, right)
  }

  if (!leftDate) {
    return 1
  }

  if (!rightDate) {
    return -1
  }

  const diff = leftDate.getTime() - rightDate.getTime()
  return diff || compareByCreatedAtDesc(left, right)
}

function comparePastOrders(left, right) {
  const leftDate = parseOrderEventDate(left?.eventDate)
  const rightDate = parseOrderEventDate(right?.eventDate)

  if (!leftDate && !rightDate) {
    return compareByCreatedAtDesc(left, right)
  }

  if (!leftDate) {
    return 1
  }

  if (!rightDate) {
    return -1
  }

  const diff = rightDate.getTime() - leftDate.getTime()
  return diff || compareByCreatedAtDesc(left, right)
}

function splitOrdersByEventDate(orders) {
  const today = normalizeCalendarDate(new Date())
  const upcomingOrders = []
  const pastOrders = []

  for (const order of orders) {
    const eventDate = parseOrderEventDate(order?.eventDate)

    if (!eventDate || eventDate.getTime() >= today.getTime()) {
      upcomingOrders.push(order)
    } else {
      pastOrders.push(order)
    }
  }

  return {
    pastOrders: pastOrders.sort(comparePastOrders),
    upcomingOrders: upcomingOrders.sort(compareUpcomingOrders),
  }
}

function buildProfileDashboard({ offers, orders }) {
  const { upcomingOrders, pastOrders } = splitOrdersByEventDate(orders)

  return {
    offers,
    orders: [...upcomingOrders, ...pastOrders],
    pastOrders,
    upcomingOrders,
    stats: [
      { label: 'Orders', value: orders.length },
      { label: 'Upcoming', value: upcomingOrders.length },
      { label: 'Listings', value: offers.length },
    ],
  }
}

function notifyProfileUpdated(details) {
  if (typeof window === 'undefined') {
    return
  }

  window.dispatchEvent(
    new CustomEvent(PROFILE_UPDATED_EVENT, {
      detail: details,
    }),
  )
}

async function getMockProfileDetails() {
  return normalizeProfileDetails(readPersonalInfo())
}

async function updateMockProfileDetails(details) {
  const nextDetails = normalizeProfileDetails(details)
  savePersonalInfo(nextDetails)
  notifyProfileUpdated(nextDetails)
  return nextDetails
}

async function getRealProfileDetails() {
  const data = await fetchGraphQL(CURRENT_USER_QUERY)
  const user = data?.me ?? {}

  return normalizeProfileDetails({
    firstName: user.name ?? '',
    lastName: user.surname ?? '',
    email: user.email ?? '',
  })
}

async function updateRealProfileDetails(details) {
  await fetchGraphQL(UPDATE_USER_MUTATION, {
    variables: {
      input: {
        name: details.firstName || undefined,
        surname: details.lastName || undefined,
        email: details.email || undefined,
        password: details.newPassword || undefined,
      },
    },
  })

  return normalizeProfileDetails(details)
}

async function getMockProfileDashboard() {
  const [orders, offers] = await Promise.all([
    getMyOrders(),
    getMyOffers(),
  ])

  return buildProfileDashboard({ offers, orders })
}

async function getRealProfileDashboard() {
  const [ordersData, cartData] = await Promise.all([
    fetchGraphQL(GET_ORDERS_QUERY),
    fetchGraphQL(GET_CART_QUERY).catch(() => null),
  ])

  const rawOrders = ordersData?.getOrders ?? []
  const orders = rawOrders.map(mapOrderToViewModel)
  const cartItems = cartData?.getCart ?? []
  let pendingOrders = []

  if (cartItems.length > 0) {
    const byActivity = {}

    for (const item of cartItems) {
      if (!byActivity[item.activityId]) {
        byActivity[item.activityId] = []
      }

      byActivity[item.activityId].push(item)
    }

    const activityIds = Object.keys(byActivity)
    const activityResults = await Promise.all(
      activityIds.map((id) =>
        fetchGraphQL(EXPLORE_ACTIVITY_BY_ID_QUERY, { variables: { id } })
          .then((data) => data?.getActivityById ?? null)
          .catch(() => null),
      ),
    )
    const activityById = Object.fromEntries(activityIds.map((id, index) => [id, activityResults[index]]))

    pendingOrders = activityIds.map((activityId) => {
      const seats = byActivity[activityId]
      const activity = activityById[activityId]
      const createdAt = seats.reduce((min, seat) => (seat.createdAt < min ? seat.createdAt : min), seats[0].createdAt)
      const expiresAt = new Date(createdAt).getTime() + 10 * 60 * 1000

      return {
        createdAt,
        eventDate: activity?.date ?? null,
        eventTitle: activity?.name ?? 'Reserved event',
        expiresAt,
        id: `pending-${activityId}`,
        isPending: true,
        status: 'RESERVED',
        statusLabel: 'Pending',
        ticketCount: seats.length,
        totalPriceLabel: null,
        venue: activity?.hall
          ? [activity.hall.name, activity.hall.city].filter(Boolean).join(' - ')
          : null,
      }
    })
  }

  return buildProfileDashboard({ offers: [], orders: [...pendingOrders, ...orders] })
}

export async function getProfileDetails() {
  return isProfileMockEnabled()
    ? getMockProfileDetails()
    : getRealProfileDetails()
}

export async function updateProfileDetails(details) {
  return isProfileMockEnabled()
    ? updateMockProfileDetails(details)
    : updateRealProfileDetails(details)
}

export async function patchProfileDetails(patch) {
  const current = await getProfileDetails()

  return updateProfileDetails({
    ...current,
    ...patch,
  })
}

export async function getProfileDashboard() {
  return isProfileMockEnabled()
    ? getMockProfileDashboard()
    : getRealProfileDashboard()
}
