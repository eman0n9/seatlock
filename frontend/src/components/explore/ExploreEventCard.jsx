'use client'

import Link from 'next/link'

const artStyles = {
  'rose-stage':
    'linear-gradient(135deg, rgba(235,133,126,0.95), rgba(81,46,38,0.8)), radial-gradient(circle at 80% 18%, rgba(255,255,255,0.28), transparent 22%)',
  'violet-stage':
    'linear-gradient(135deg, rgba(33,40,96,0.96), rgba(189,71,129,0.78)), radial-gradient(circle at 68% 12%, rgba(255,209,138,0.35), transparent 18%)',
  'blue-night':
    'linear-gradient(135deg, rgba(25,45,90,0.95), rgba(38,122,196,0.82)), radial-gradient(circle at 65% 24%, rgba(122,234,255,0.28), transparent 18%)',
  'amber-stage':
    'linear-gradient(135deg, rgba(77,49,33,0.95), rgba(203,110,46,0.84)), radial-gradient(circle at 78% 24%, rgba(255,240,165,0.26), transparent 18%)',
  'dark-stage':
    'linear-gradient(135deg, rgba(13,14,19,0.96), rgba(118,34,23,0.78)), radial-gradient(circle at 22% 14%, rgba(255,106,89,0.28), transparent 16%)',
  'electric-blue':
    'linear-gradient(135deg, rgba(16,44,81,0.94), rgba(63,110,212,0.8)), radial-gradient(circle at 78% 22%, rgba(174,212,255,0.3), transparent 17%)',
  'festival-lights':
    'linear-gradient(135deg, rgba(59,47,24,0.9), rgba(198,73,116,0.76)), radial-gradient(circle at 32% 20%, rgba(255,232,128,0.35), transparent 18%)',
  'indigo-spot':
    'linear-gradient(135deg, rgba(40,52,112,0.95), rgba(105,122,205,0.8)), radial-gradient(circle at 65% 14%, rgba(255,255,255,0.26), transparent 18%)',
  'crimson-portrait':
    'linear-gradient(135deg, rgba(28,18,22,0.96), rgba(144,52,60,0.8)), radial-gradient(circle at 75% 20%, rgba(255,202,155,0.22), transparent 20%)',
  'monochrome-portrait':
    'linear-gradient(135deg, rgba(42,42,46,0.92), rgba(129,130,139,0.82)), radial-gradient(circle at 72% 20%, rgba(238,239,241,0.22), transparent 18%)',
  'dark-vocal':
    'linear-gradient(135deg, rgba(15,17,26,0.96), rgba(6,90,107,0.76)), radial-gradient(circle at 70% 18%, rgba(255,118,118,0.24), transparent 18%)',
  'charcoal-stage':
    'linear-gradient(135deg, rgba(26,28,36,0.96), rgba(107,110,119,0.76)), radial-gradient(circle at 72% 16%, rgba(245,245,245,0.22), transparent 18%)',
  'football-red':
    'linear-gradient(135deg, rgba(7,60,124,0.94), rgba(240,138,33,0.78)), radial-gradient(circle at 58% 28%, rgba(255,255,255,0.2), transparent 15%)',
  'football-green':
    'linear-gradient(135deg, rgba(10,103,58,0.92), rgba(72,145,61,0.78)), radial-gradient(circle at 62% 22%, rgba(246,247,180,0.22), transparent 18%)',
  'crowd-gold':
    'linear-gradient(135deg, rgba(66,80,104,0.92), rgba(181,165,88,0.82)), radial-gradient(circle at 80% 22%, rgba(255,226,116,0.3), transparent 16%)',
  'crowd-blue':
    'linear-gradient(135deg, rgba(32,63,100,0.92), rgba(72,144,199,0.8)), radial-gradient(circle at 24% 20%, rgba(255,246,166,0.24), transparent 16%)',
  'theater-spot':
    'linear-gradient(135deg, rgba(20,22,25,0.95), rgba(93,95,100,0.78)), radial-gradient(circle at 52% 18%, rgba(255,255,255,0.26), transparent 18%)',
  'theater-lineup':
    'linear-gradient(135deg, rgba(28,34,70,0.95), rgba(28,20,41,0.8)), radial-gradient(circle at 22% 22%, rgba(255,208,138,0.22), transparent 18%)',
  'purple-curtain':
    'linear-gradient(135deg, rgba(42,30,111,0.95), rgba(87,72,191,0.78)), radial-gradient(circle at 56% 18%, rgba(255,255,255,0.18), transparent 18%)',
  'portrait-warm':
    'linear-gradient(135deg, rgba(67,54,39,0.92), rgba(173,144,111,0.8)), radial-gradient(circle at 76% 18%, rgba(251,236,220,0.24), transparent 18%)',
  'festival-crowd':
    'linear-gradient(135deg, rgba(30,40,77,0.92), rgba(181,100,52,0.8)), radial-gradient(circle at 28% 20%, rgba(255,246,124,0.28), transparent 18%)',
}

function ExploreEventCard({
  event,
  isFavorite = false,
  onFavoriteToggle,
  onPurchaseSelect,
  purchaseHref = '',
}) {
  return (
    <article className="explore-event-card">
      <div
        className="explore-event-card__image"
        style={{ backgroundImage: artStyles[event.art] }}
      >
        <div className="explore-event-card__lights" aria-hidden="true" />

        <button
          type="button"
          className={`explore-event-card__favorite${isFavorite ? ' is-active' : ''}`}
          aria-label={`${isFavorite ? 'Remove' : 'Save'} ${event.title} ${isFavorite ? 'from' : 'to'} favorites`}
          aria-pressed={isFavorite}
          onClick={onFavoriteToggle}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="m12 20-1.3-1.1C5.6 14.4 2 11.1 2 7.1 2 4.4 4.1 2.3 6.8 2.3c1.7 0 3.2.8 4.2 2.1 1-1.3 2.5-2.1 4.2-2.1C17.9 2.3 20 4.4 20 7.1c0 4-3.6 7.3-8.7 11.8L12 20Z" />
          </svg>
        </button>
      </div>

      <div className="explore-event-card__body">
        <h3 className="explore-event-card__title">{event.title}</h3>
        <p className="explore-event-card__meta">
          {event.dateLabel} - {event.timeLabel}
        </p>
        <p className="explore-event-card__venue">{event.venue}</p>

        {purchaseHref ? (
          <div className="explore-event-card__actions">
            <Link
              className="explore-event-card__cta"
              href={purchaseHref}
              onClick={() => onPurchaseSelect?.(event)}
            >
              Choose seats
            </Link>
          </div>
        ) : null}
      </div>
    </article>
  )
}

export default ExploreEventCard
