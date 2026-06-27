const EPET_ARENA = {
  address: 'Milady Horakove 1066',
  city: 'Prague',
  id: 'hall-epet-arena',
  name: 'epet ARENA',
}

const FORUM_KARLIN = {
  address: 'Pernerova 51',
  city: 'Prague',
  id: 'hall-forum-karlin',
  name: 'Forum Karlin',
}

const SPARTA_ACTIVITY = {
  date: '2026-04-05',
  hall: EPET_ARENA,
  id: 'sparta-karvina',
  name: 'Sparta Praha vs MFK Karvina',
  startTime: '18:30',
}

const DITA_ACTIVITY = {
  date: '2026-04-06',
  hall: FORUM_KARLIN,
  id: 'dita-von-teese',
  name: 'Dita Von Teese',
  startTime: '20:00',
}

const STANDARD_SPARTA_OFFER = {
  activity: SPARTA_ACTIVITY,
  id: 'offer-101',
  price: 55,
  type: 'STANDARD',
}

const VIP_DITA_OFFER = {
  activity: DITA_ACTIVITY,
  id: 'offer-102',
  price: 85,
  type: 'VIP',
}

export const mockOrders = [
  {
    createdAt: '2026-04-01T10:30:00',
    id: 'order-101',
    status: 'PAID',
    tickets: [
      {
        id: 'ticket-201',
        offer: STANDARD_SPARTA_OFFER,
        order: {
          createdAt: '2026-04-01T10:30:00',
          id: 'order-101',
          status: 'PAID',
          totalPrice: 55,
          user: {
            email: 'buyer@example.com',
            id: 'user-buyer',
            role: 'USER',
            username: 'buyer',
          },
        },
        seat: {
          hall: EPET_ARENA,
          id: 'seat-hall-epet-arena-2-9',
          rowNumber: 2,
          seatNumber: 9,
        },
        status: 'SOLD',
      },
    ],
    totalPrice: 55,
    user: {
      email: 'buyer@example.com',
      id: 'user-buyer',
      role: 'USER',
      username: 'buyer',
    },
  },
  {
    createdAt: '2026-04-02T12:15:00',
    id: 'order-102',
    status: 'PAID',
    tickets: [
      {
        id: 'ticket-202',
        offer: VIP_DITA_OFFER,
        order: {
          createdAt: '2026-04-02T12:15:00',
          id: 'order-102',
          status: 'PAID',
          totalPrice: 85,
          user: {
            email: 'buyer@example.com',
            id: 'user-buyer',
            role: 'USER',
            username: 'buyer',
          },
        },
        seat: {
          hall: FORUM_KARLIN,
          id: 'seat-hall-forum-karlin-7-14',
          rowNumber: 7,
          seatNumber: 14,
        },
        status: 'SOLD',
      },
    ],
    totalPrice: 85,
    user: {
      email: 'buyer@example.com',
      id: 'user-buyer',
      role: 'USER',
      username: 'buyer',
    },
  },
]

export const mockTickets = [
  {
    id: 'ticket-201',
    offer: STANDARD_SPARTA_OFFER,
    order: {
      createdAt: '2026-04-01T10:30:00',
      id: 'order-101',
      status: 'PAID',
      totalPrice: 55,
      user: {
        email: 'buyer@example.com',
        id: 'user-buyer',
        role: 'USER',
        username: 'buyer',
      },
    },
    seat: {
      hall: EPET_ARENA,
      id: 'seat-hall-epet-arena-2-9',
      rowNumber: 2,
      seatNumber: 9,
    },
    status: 'SOLD',
  },
  {
    id: 'ticket-202',
    offer: VIP_DITA_OFFER,
    order: {
      createdAt: '2026-04-02T12:15:00',
      id: 'order-102',
      status: 'PAID',
      totalPrice: 85,
      user: {
        email: 'buyer@example.com',
        id: 'user-buyer',
        role: 'USER',
        username: 'buyer',
      },
    },
    seat: {
      hall: FORUM_KARLIN,
      id: 'seat-hall-forum-karlin-7-14',
      rowNumber: 7,
      seatNumber: 14,
    },
    status: 'SOLD',
  },
]
