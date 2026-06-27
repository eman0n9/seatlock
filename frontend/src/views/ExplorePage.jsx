'use client'

import { useEffect, useState } from 'react'
import { getSeatMapRoute } from 'app/routePaths'
import ExploreCategoryTabs from 'components/explore/ExploreCategoryTabs'
import ExploreEventCard from 'components/explore/ExploreEventCard'
import AppIcon from 'components/ui/AppIcon'
import { useFavorites } from 'features/favorites/FavoritesProvider'
import { exploreDateOptions, explorePrimaryCategories } from 'features/explore/config/exploreFilters'
import { usePurchase } from 'features/purchase/usePurchase'
import { useMediaQuery } from 'hooks/useMediaQuery'
import { usePageTitle } from 'hooks/usePageTitle'
import { getExploreActivities } from 'lib/api/activityApi'
import { deriveDateRangeFromPreset } from 'lib/api/mappers/searchInputMapper'
import { cn } from 'utils/cn'

const EXPLORE_YEAR = 2026
const DEFAULT_CALENDAR_MONTH = new Date(EXPLORE_YEAR, 3, 1)
const MONTH_LABEL_FORMATTER = new Intl.DateTimeFormat('en-US', {
  month: 'long',
  year: 'numeric',
})
const FULL_DATE_FORMATTER = new Intl.DateTimeFormat('en-US', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
})
const RANGE_DATE_FORMATTER = new Intl.DateTimeFormat('en-US', {
  day: '2-digit',
  month: 'short',
})
const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTH_INDEX_MAP = {
  Apr: 3,
  Aug: 7,
  Dec: 11,
  Feb: 1,
  Jan: 0,
  Jul: 6,
  Jun: 5,
  Mar: 2,
  May: 4,
  Nov: 10,
  Oct: 9,
  Sep: 8,
}

function formatRangeLabel(start, end) {
  if (!start || !end) {
    return 'All dates'
  }

  return `${RANGE_DATE_FORMATTER.format(start)} - ${RANGE_DATE_FORMATTER.format(end)}`
}

function formatFullDate(value) {
  return value ? FULL_DATE_FORMATTER.format(value) : 'Select date'
}

function startOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

function addMonths(date, amount) {
  return new Date(date.getFullYear(), date.getMonth() + amount, 1)
}

function normalizeDate(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

function isSameDay(left, right) {
  return (
    left?.getFullYear() === right?.getFullYear() &&
    left?.getMonth() === right?.getMonth() &&
    left?.getDate() === right?.getDate()
  )
}

function isWithinRange(date, rangeStart, rangeEnd) {
  if (!rangeStart || !rangeEnd) {
    return false
  }

  const time = date.getTime()
  return time > rangeStart.getTime() && time < rangeEnd.getTime()
}

function getCalendarDays(monthDate) {
  const firstDay = startOfMonth(monthDate)
  const month = firstDay.getMonth()
  const days = []

  for (let index = 0; index < firstDay.getDay(); index += 1) {
    days.push(null)
  }

  for (let day = 1; day <= new Date(firstDay.getFullYear(), month + 1, 0).getDate(); day += 1) {
    days.push(new Date(firstDay.getFullYear(), month, day))
  }

  while (days.length % 7 !== 0) {
    days.push(null)
  }

  return days
}

function parseEventDateLabel(label) {
  const [, dayText, monthText] = label.split(' ')
  const day = Number(dayText)
  const month = MONTH_INDEX_MAP[monthText]

  if (!day || month === undefined) {
    return null
  }

  return new Date(EXPLORE_YEAR, month, day)
}

function getCityOptions(events) {
  const uniqueCities = new Set()

  for (const event of events) {
    const city = event.hall?.city
    if (city) {
      uniqueCities.add(city)
    }
  }

  return Array.from(uniqueCities).sort((left, right) => left.localeCompare(right))
}

function FilterButton({
  icon,
  isAccent = false,
  isOpen = false,
  label,
  onClick,
}) {
  return (
    <button
      type="button"
      className={cn(
        'explore-filter-button',
        isAccent && 'is-accent',
        isOpen && 'is-open',
      )}
      onClick={onClick}
    >
      <AppIcon name={icon} className="explore-icon" />
      <span>{label}</span>
      <AppIcon
        name="chevronDown"
        className={cn('explore-icon explore-icon--chevron', isOpen && 'is-open')}
      />
    </button>
  )
}

function ExplorePage() {
  usePageTitle('Explore')

  const { isFavorite, toggleFavorite } = useFavorites()
  const { beginPurchase } = usePurchase()
  const isMobile = useMediaQuery('(max-width: 760px)')
  const [events, setEvents] = useState([])
  const [isLoadingEvents, setIsLoadingEvents] = useState(true)
  const [eventsError, setEventsError] = useState('')
  const [activeCategory, setActiveCategory] = useState('all')
  const [selectedLocation, setSelectedLocation] = useState('Prague')
  const [selectedDatePreset, setSelectedDatePreset] = useState('All dates')
  const [selectedDateRange, setSelectedDateRange] = useState(null)
  const [locationSearch, setLocationSearch] = useState('')
  const [openFilterState, setOpenFilterState] = useState(null)
  const [isCustomDateOpen, setIsCustomDateOpen] = useState(false)
  const [draftDateRange, setDraftDateRange] = useState({ end: null, start: null })
  const [calendarMonth, setCalendarMonth] = useState(DEFAULT_CALENDAR_MONTH)
  const [visibleCount, setVisibleCount] = useState(12)

  useEffect(() => {
    const abortController = new AbortController()

    const loadActivities = async () => {
      try {
        setIsLoadingEvents(true)
        setEventsError('')
        const nextEvents = await getExploreActivities({
          filters: {
            activeCategory,
            selectedDatePreset,
            selectedDateRange,
          },
          signal: abortController.signal,
        })

        setEvents(nextEvents)
      } catch (error) {
        if (!abortController.signal.aborted) {
          setEventsError(error.message ?? 'Unable to load activities right now.')
        }
      } finally {
        if (!abortController.signal.aborted) {
          setIsLoadingEvents(false)
        }
      }
    }

    loadActivities()

    return () => {
      abortController.abort()
    }
  }, [activeCategory, selectedDatePreset, selectedDateRange])

  const cityOptions = getCityOptions(events)
  const filteredCityOptions = cityOptions.filter((city) =>
    city.toLowerCase().includes(locationSearch.trim().toLowerCase()),
  )
  const derivedDateRange = deriveDateRangeFromPreset(selectedDatePreset, selectedDateRange)

  useEffect(() => {
    if (!cityOptions.length || cityOptions.includes(selectedLocation)) {
      return
    }

    if (cityOptions.includes('Prague')) {
      setSelectedLocation('Prague')
      return
    }

    setSelectedLocation(cityOptions[0])
  }, [cityOptions, selectedLocation])

  useEffect(() => {
    setVisibleCount(isMobile ? 6 : 12)
  }, [activeCategory, isMobile, selectedDatePreset, selectedDateRange, selectedLocation])

  const filteredEvents = events.filter((event) => {
    const matchesCategory =
      activeCategory === 'all' ? true : event.category === activeCategory

    const matchesLocation =
      selectedLocation ? event.hall?.city === selectedLocation : true

    const eventDate = parseEventDateLabel(event.dateLabel)
    const matchesDate =
      !derivedDateRange
        ? true
        : !!eventDate &&
          eventDate >= derivedDateRange.start &&
          eventDate <= derivedDateRange.end

    return matchesCategory && matchesLocation && matchesDate
  })

  const visibleEvents = filteredEvents.slice(0, visibleCount)
  const hasMoreEvents = filteredEvents.length > visibleCount
  const selectedDate = selectedDateRange
    ? formatRangeLabel(selectedDateRange.start, selectedDateRange.end)
    : selectedDatePreset
  const activeFilter = openFilterState?.name ?? null
  const calendarDays = getCalendarDays(calendarMonth)
  const filterHeading = `Explore events in ${selectedLocation}`

  const isFilterOpen = (filterName, anchor) =>
    openFilterState?.name === filterName && openFilterState?.anchor === anchor

  const openFilterPanel = (filterName, anchor) => {
    setOpenFilterState((current) =>
      current?.name === filterName && current?.anchor === anchor
        ? null
        : { anchor, name: filterName },
    )
  }

  const applyLocation = (location) => {
    setSelectedLocation(location)
    setOpenFilterState(null)
    setLocationSearch('')
  }

  const openCustomDatePicker = () => {
    setOpenFilterState(null)
    setDraftDateRange(
      selectedDateRange
        ? {
            end: selectedDateRange.end,
            start: selectedDateRange.start,
          }
        : { end: null, start: null },
    )
    setCalendarMonth(startOfMonth(selectedDateRange?.start ?? DEFAULT_CALENDAR_MONTH))
    setIsCustomDateOpen(true)
  }

  const handleDateSelect = (option) => {
    if (option === 'Custom Dates') {
      openCustomDatePicker()
      return
    }

    setSelectedDatePreset(option)
    setSelectedDateRange(null)
    setOpenFilterState(null)
  }

  const handleCalendarDaySelect = (value) => {
    const nextDate = normalizeDate(value)

    if (!draftDateRange.start || draftDateRange.end) {
      setDraftDateRange({ end: null, start: nextDate })
      return
    }

    if (nextDate < draftDateRange.start) {
      const nextRange = {
        end: draftDateRange.start,
        start: nextDate,
      }

      setDraftDateRange(nextRange)
      setSelectedDateRange(nextRange)
      setSelectedDatePreset('All dates')
      return
    }

    const nextRange = {
      end: nextDate,
      start: draftDateRange.start,
    }

    setDraftDateRange(nextRange)
    setSelectedDateRange(nextRange)
    setSelectedDatePreset('All dates')
  }

  const clearCustomDateRange = () => {
    setDraftDateRange({ end: null, start: null })
    setSelectedDateRange(null)
    setSelectedDatePreset('All dates')
    setIsCustomDateOpen(false)
  }

  const renderLocationOptions = () => (
    <div className={cn(isMobile ? 'explore-sheet' : 'explore-dropdown')}>
      {isMobile ? <div className="explore-sheet__handle" aria-hidden="true" /> : null}

      <label className="explore-dropdown__search">
        <AppIcon name="search" className="explore-icon" />
        <input
          type="text"
          placeholder="Search city"
          value={locationSearch}
          onChange={(event) => setLocationSearch(event.target.value)}
        />
      </label>

      {filteredCityOptions.length ? (
        filteredCityOptions.map((city) => (
          <button
            key={city}
            type="button"
            className="explore-dropdown__item"
            onClick={() => applyLocation(city)}
          >
            <span>{city}</span>
            {selectedLocation === city ? (
              <AppIcon name="check" className="explore-icon explore-icon--check" />
            ) : null}
          </button>
        ))
      ) : (
        <p className="sync-card__text" style={{ marginTop: 12 }}>
          No cities available for the current catalog.
        </p>
      )}
    </div>
  )

  const renderDateOptions = () => (
    <div className={cn(isMobile ? 'explore-sheet' : 'explore-dropdown')}>
      {isMobile ? <div className="explore-sheet__handle" aria-hidden="true" /> : null}

      <div className={isMobile ? 'explore-sheet__list' : undefined}>
        {exploreDateOptions.map((option) => (
          <button
            key={option}
            type="button"
            className="explore-dropdown__item"
            onClick={() => handleDateSelect(option)}
          >
            <span>{option}</span>
            {(selectedDateRange
              ? option === 'Custom Dates'
              : selectedDatePreset === option) ? (
              <AppIcon name="check" className="explore-icon explore-icon--check" />
            ) : null}
          </button>
        ))}
      </div>
    </div>
  )

  const renderDesktopDropdown = (filterName) => {
    if (isMobile) {
      return null
    }

    return filterName === 'location' ? renderLocationOptions() : renderDateOptions()
  }

  const renderMobileSheet = () => {
    if (!isMobile || !activeFilter) {
      return null
    }

    return activeFilter === 'location' ? renderLocationOptions() : renderDateOptions()
  }

  return (
    <section className="explore-page">
      <div className="explore-topbar">
        <div className="explore-topbar__summary">
          <div className="explore-summary-wrap">
            <button
              type="button"
              className={cn(
                'explore-summary-button',
                isFilterOpen('location', 'top') && 'is-open',
              )}
              onClick={() => openFilterPanel('location', 'top')}
            >
              <AppIcon name="location" className="explore-icon" />
              <span>{selectedLocation}</span>
              <AppIcon
                name="chevronDown"
                className={cn(
                  'explore-icon explore-icon--chevron',
                  isFilterOpen('location', 'top') && 'is-open',
                )}
              />
            </button>

            {isFilterOpen('location', 'top') ? renderDesktopDropdown('location') : null}
          </div>

          <div className="explore-summary-wrap">
            <button
              type="button"
              className={cn(
                'explore-summary-button',
                isFilterOpen('date', 'top') && 'is-open',
              )}
              onClick={() => openFilterPanel('date', 'top')}
            >
              <AppIcon name="calendar" className="explore-icon" />
              <span>{selectedDate}</span>
              <AppIcon
                name="chevronDown"
                className={cn(
                  'explore-icon explore-icon--chevron',
                  isFilterOpen('date', 'top') && 'is-open',
                )}
              />
            </button>

            {isFilterOpen('date', 'top') ? renderDesktopDropdown('date') : null}
          </div>
        </div>
      </div>

      <ExploreCategoryTabs
        activeCategory={activeCategory}
        categories={explorePrimaryCategories}
        onCategoryChange={setActiveCategory}
      />

      <div className="explore-filter-bar">
        <div className="explore-filter-wrap">
          <FilterButton
            icon="location"
            isAccent
            isOpen={isFilterOpen('location', 'bottom')}
            label={selectedLocation}
            onClick={() => openFilterPanel('location', 'bottom')}
          />
          {isFilterOpen('location', 'bottom') ? renderDesktopDropdown('location') : null}
        </div>

        <div className="explore-filter-wrap">
          <FilterButton
            icon="calendar"
            isOpen={isFilterOpen('date', 'bottom')}
            label={selectedDate}
            onClick={() => openFilterPanel('date', 'bottom')}
          />
          {isFilterOpen('date', 'bottom') ? renderDesktopDropdown('date') : null}
        </div>
      </div>

      <section className="explore-results">
        <h1 className="explore-results__title">{filterHeading}</h1>

        {eventsError ? (
          <div className="page-card page-card--stack">
            <h2>Unable to load activities</h2>
            <p className="page-description">{eventsError}</p>
          </div>
        ) : isLoadingEvents ? (
          <div className="page-card page-card--stack">
            <h2>Loading activities</h2>
            <p className="page-description">Preparing event catalog from the current data source.</p>
          </div>
        ) : (
          <div className="explore-event-grid">
            {visibleEvents.map((event) => (
              <ExploreEventCard
                key={event.id}
                event={event}
                isFavorite={isFavorite(event.id)}
                onFavoriteToggle={() => toggleFavorite(event.id)}
                onPurchaseSelect={beginPurchase}
                purchaseHref={getSeatMapRoute(event.id)}
              />
            ))}
          </div>
        )}

        {!eventsError && !isLoadingEvents && hasMoreEvents ? (
          <div className="explore-results__actions">
            <p className="explore-results__caption">{filterHeading}</p>

            <button
              type="button"
              className="explore-show-more"
              onClick={() => setVisibleCount((current) => current + (isMobile ? 4 : 8))}
            >
              Show More
            </button>
          </div>
        ) : null}
      </section>

      {isMobile && activeFilter ? (
        <div
          className="explore-sheet-overlay"
          role="presentation"
          onClick={() => setOpenFilterState(null)}
        >
          <div
            className="explore-sheet-overlay__panel"
            role="dialog"
            aria-modal="true"
            onClick={(event) => event.stopPropagation()}
          >
            {renderMobileSheet()}
          </div>
        </div>
      ) : null}

      {isCustomDateOpen ? (
        <div
          className="explore-calendar-backdrop"
          role="presentation"
          onClick={() => setIsCustomDateOpen(false)}
        >
          <div
            className="explore-calendar-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Select date range"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="explore-calendar-modal__header">
              <h2>Select date range</h2>
              <button
                type="button"
                className="explore-calendar-modal__close"
                onClick={() => setIsCustomDateOpen(false)}
              >
                x
              </button>
            </div>

            <div className="explore-calendar-modal__range">
              <div>
                <span>From</span>
                <strong>{formatFullDate(draftDateRange.start)}</strong>
                <div />
              </div>
              <div>
                <span>To</span>
                <strong>{formatFullDate(draftDateRange.end)}</strong>
                <div />
              </div>
            </div>

            <div className="explore-calendar-modal__month">
              <button
                type="button"
                aria-label="Previous month"
                onClick={() => setCalendarMonth((current) => addMonths(current, -1))}
              >
                &lt;
              </button>
              <strong>{MONTH_LABEL_FORMATTER.format(calendarMonth)}</strong>
              <button
                type="button"
                aria-label="Next month"
                onClick={() => setCalendarMonth((current) => addMonths(current, 1))}
              >
                &gt;
              </button>
            </div>

            <div className="explore-calendar-modal__weekdays">
              {WEEKDAY_LABELS.map((day) => (
                <span key={day}>{day}</span>
              ))}
            </div>

            <div className="explore-calendar-modal__days">
              {calendarDays.map((day, index) => {
                if (!day) {
                  return (
                    <span key={`empty-${index}`} className="explore-calendar-day is-empty" />
                  )
                }

                const isStart = isSameDay(day, draftDateRange.start)
                const isEnd = isSameDay(day, draftDateRange.end)
                const isSingleDay = isStart && isEnd
                const isInRange = isWithinRange(day, draftDateRange.start, draftDateRange.end)

                return (
                  <button
                    key={day.toISOString()}
                    type="button"
                    className={cn(
                      'explore-calendar-day',
                      isInRange && 'is-in-range',
                      isStart && 'is-range-start',
                      isEnd && 'is-range-end',
                      isSingleDay && 'is-single-day',
                    )}
                    onClick={() => handleCalendarDaySelect(day)}
                  >
                    <span>{day.getDate()}</span>
                  </button>
                )
              })}
            </div>

            <button
              type="button"
              className="explore-calendar-modal__clear"
              onClick={clearCustomDateRange}
            >
              Clear
            </button>
          </div>
        </div>
      ) : null}
    </section>
  )
}

export default ExplorePage
