export const EXPLORE_ACTIVITIES_QUERY = `
  query ExploreActivities {
    getAllActivities {
      id
      name
      date
      startTime
      endTime
      description
    }
  }
`

export const EXPLORE_CATEGORIES_QUERY = `
  query ExploreCategories {
    showAllCategories {
      name
    }
  }
`

export const EXPLORE_PERFORMERS_QUERY = `
  query ExplorePerformers {
    getAllPerformers {
      id
      name
      description
    }
  }
`

export const EXPLORE_HALLS_QUERY = `
  query ExploreHalls {
    getAllHalls {
      id
      name
      address
    }
  }
`
