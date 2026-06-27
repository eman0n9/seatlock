import { formatPrice } from 'features/purchase/purchaseUtils'

function PurchaseSummary({
  event,
  footer = null,
  note = '',
  pricing,
  selectedSeats = [],
  title = 'Order summary',
}) {
  return (
    <section className="sync-card purchase-summary">
      <div className="sync-card__label">Summary</div>
      <h2 className="sync-card__title">{title}</h2>

      {event ? (
        <div className="purchase-summary__event">
          <strong>{event.title}</strong>
          <p>{event.dateLabel} - {event.timeLabel}</p>
          <p>{event.venue}</p>
        </div>
      ) : null}

      <div className="purchase-summary__seats">
        {selectedSeats.length ? (
          selectedSeats.map((seat) => (
            <div key={seat.id} className="purchase-summary__seat">
              <div>
                <strong>{seat.sectionLabel}</strong>
                <p>Row {seat.rowLabel}, Seat {seat.seatNumber}</p>
              </div>
              <span>{formatPrice(seat.price)}</span>
            </div>
          ))
        ) : (
          <p className="purchase-summary__empty">No seats selected yet.</p>
        )}
      </div>

      <dl className="purchase-summary__totals">
        <div>
          <dt>Subtotal</dt>
          <dd>{formatPrice(pricing.subtotal)}</dd>
        </div>
        <div>
          <dt>Service fee</dt>
          <dd>{formatPrice(pricing.serviceFee)}</dd>
        </div>
        <div>
          <dt>Delivery</dt>
          <dd>{formatPrice(pricing.deliveryFee)}</dd>
        </div>
        <div className="is-total">
          <dt>Total</dt>
          <dd>{formatPrice(pricing.total)}</dd>
        </div>
      </dl>

      {note ? <p className="purchase-summary__note">{note}</p> : null}
      {footer ? <div className="purchase-summary__footer">{footer}</div> : null}
    </section>
  )
}

export default PurchaseSummary
