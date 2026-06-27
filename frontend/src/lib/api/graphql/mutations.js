export const CREATE_ACTIVITY_MUTATION = `
  mutation CreateActivity($input: ActivityInput!) {
    createActivity(input: $input)
  }
`

export const UPDATE_ACTIVITY_MUTATION = `
  mutation UpdateActivity($id: ID!, $input: ActivityUpdateInput!) {
    updateActivity(id: $id, input: $input)
  }
`

export const DELETE_ACTIVITY_MUTATION = `
  mutation DeleteActivity($id: ID!) {
    deleteActivity(id: $id)
  }
`

export const CREATE_PERFORMER_MUTATION = `
  mutation CreatePerformer($input: PerformerInput!) {
    createPerformer(input: $input)
  }
`

export const UPDATE_PERFORMER_MUTATION = `
  mutation UpdatePerformer($id: ID!, $input: PerformerUpdateInput!) {
    updatePerformer(id: $id, input: $input)
  }
`

export const DELETE_PERFORMER_MUTATION = `
  mutation DeletePerformer($id: ID!) {
    deletePerformer(id: $id)
  }
`

export const CREATE_HALL_MUTATION = `
  mutation CreateHall($input: HallInput!) {
    createHall(input: $input) {
      id
      name
      address
      city
    }
  }
`

export const UPDATE_HALL_MUTATION = `
  mutation UpdateHall($id: ID!, $input: HallUpdateInput!) {
    updateHall(id: $id, input: $input)
  }
`

export const DELETE_HALL_MUTATION = `
  mutation DeleteHall($id: ID!) {
    deleteHall(id: $id)
  }
`

export const DELETE_CATEGORY_MUTATION = `
  mutation DeleteCategory($id: ID!) {
    deleteCategory(id: $id)
  }
`

export const CHANGE_CATEGORY_MUTATION = `
  mutation ChangeCategory($id: ID!, $name: String!) {
    changeCategory(id: $id, name: $name)
  }
`

export const ADD_CATEGORY_MUTATION = `
  mutation AddCategory($name: String!) {
    addCategory(name: $name)
  }
`

export const UPDATE_USER_MUTATION = `
  mutation UpdateUser($input: UserUpdate) {
    updateUser(input: $input)
  }
`

export const TOGGLE_FAVORITE_ACTIVITY_MUTATION = `
  mutation ToggleFavoriteActivity($activityId: ID!) {
    toggleFavoriteActivity(activityId: $activityId)
  }
`

export const TOGGLE_FAVORITE_PERFORMER_MUTATION = `
  mutation ToggleFavoritePerformer($performerId: ID!) {
    toggleFavoritePerformer(performerId: $performerId)
  }
`

export const RESERVE_SEATS_MUTATION = `
  mutation ReserveSeats($activityId: ID!, $seatIds: [ID!]!) {
    reserveSeats(activityId: $activityId, seatIds: $seatIds)
  }
`

export const CANCEL_RESERVATION_MUTATION = `
  mutation CancelReservation($activityId: ID!, $seatId: ID!) {
    cancelReservation(activityId: $activityId, seatId: $seatId)
  }
`

export const CHECKOUT_MUTATION = `
  mutation Checkout($activityId: ID!, $seatIds: [ID!]!) {
    checkout(activityId: $activityId, seatIds: $seatIds) {
      activityId
      purchasedSeatIds
    }
  }
`
