export const CURRENT_USER_QUERY = `
  query CurrentUser {
    me {
      name
      surname
      email
      role
    }
  }
`

export const GET_FAVORITE_ACTIVITIES_QUERY = `
  query GetFavoriteActivities {
    getFavoriteActivities {
      id
      name
    }
  }
`

export const GET_FAVORITE_PERFORMERS_QUERY = `
  query GetFavoritePerformers {
    getFavoritePerformers {
      id
      name
    }
  }
`

export const GET_ALL_HALLS_QUERY = `
  query GetAllHalls {
    getAllHalls {
      id
      name
      address
      city
    }
  }
`

export const GET_HALL_SEAT_MAP_QUERY = `
  query GetHallSeatMap($id: ID!) {
    getHallSeatMap(id: $id) {
      rows {
        number
        seats {
          id
          seatNumber
          rowNumber
        }
      }
    }
  }
`

export const SHOW_ALL_CATEGORIES_QUERY = `
  query ShowAllCategories {
    showAllCategories {
      id
      name
    }
  }
`

export const GET_ALL_PERFORMERS_QUERY = `
  query GetAllPerformers($page: Int!, $size: Int!) {
    getAllPerformers(page: $page, size: $size) {
      totalElements
      totalPages
      pageNumber
      content {
        id
        name
        description
      }
    }
  }
`

export const EXPLORE_ACTIVITIES_QUERY = `
  query ExploreActivities($page: Int!, $size: Int!) {
    getAllActivities(page: $page, size: $size) {
      content {
        id
        name
        description
        date
        startTime
        endTime
        category {
          name
        }
        hall {
          id
          name
          address
          city
        }
      }
    }
  }
`

export const SEARCH_ACTIVITIES_QUERY = `
  query SearchActivities($input: SearchInput!) {
    searchActivities(input: $input) {
      id
      name
      description
      date
      startTime
      endTime
      category {
        name
      }
      hall {
        id
        name
        address
        city
      }
    }
  }
`

export const EXPLORE_ACTIVITY_BY_ID_QUERY = `
  query ExploreActivityById($id: ID!) {
    getActivityById(id: $id) {
      id
      name
      description
      date
      startTime
      endTime
      category {
        name
      }
      hall {
        id
        name
        address
        city
      }
    }
  }
`

export const SEAT_MAP_QUERY = `
  query GetSeatMap($id: ID!) {
    getSeatMap(id: $id) {
      rows {
        number
        tickets {
          id
          seat
          row
          type
        }
      }
      priceZones {
        type
        price
      }
    }
  }
`

export const GET_ORDERS_QUERY = `
  query GetOrders {
    getOrders {
      id
      totalPrice
      status
      createdAt
      tickets {
        id
        seatNumber
        rowNumber
      }
    }
  }
`

export const GET_ORDER_BY_ID_QUERY = `
  query GetOrderById($id: ID!) {
    getOrderById(id: $id) {
      id
      totalPrice
      status
      createdAt
      tickets {
        id
        seatNumber
        rowNumber
      }
    }
  }
`

export const GET_CART_QUERY = `
  query GetCart {
    getCart {
      seatId
      activityId
      userId
      createdAt
    }
  }
`
