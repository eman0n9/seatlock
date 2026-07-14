export const SEAT_LIVE_STATES = Object.freeze({
  FREE: 'free',
  MY_RESERVED: 'my-reserved',
  OTHER_RESERVED: 'other-reserved',
  PURCHASED: 'purchased',
})

function getSeatId(seat) {
  return typeof seat === 'string' ? seat : seat?.seatId ?? seat?.id
}

function applyState(stateBySeatId, seats, state) {
  seats.forEach((seat) => {
    const seatId = getSeatId(seat)
    if (seatId) stateBySeatId[seatId] = state
  })
}

export function createSeatLiveState({
  seats = [],
  myReserved = [],
  otherReserved = [],
  purchased = [],
} = {}) {
  const stateBySeatId = {}

  applyState(stateBySeatId, seats, SEAT_LIVE_STATES.FREE)
  applyState(stateBySeatId, myReserved, SEAT_LIVE_STATES.MY_RESERVED)
  applyState(stateBySeatId, otherReserved, SEAT_LIVE_STATES.OTHER_RESERVED)
  applyState(stateBySeatId, purchased, SEAT_LIVE_STATES.PURCHASED)

  return stateBySeatId
}
