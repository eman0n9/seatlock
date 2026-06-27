import { formatCurrency, formatOfferTypeLabel } from 'lib/api/purchaseModel'

function formatLocation(activity) {
  const hallName = activity?.hall?.name ?? ''
  const hallCity = activity?.hall?.city ?? ''

  return [hallName, hallCity].filter(Boolean).join(' - ') || 'Location TBA'
}

export function mapOfferToViewModel(offer) {
  const priceAmount = Number(offer.price)

  return {
    ...offer,
    activityTitle: offer.activityTitle ?? offer.activity?.name ?? 'Untitled listing',
    id: offer.id,
    location: offer.location ?? formatLocation(offer.activity),
    priceAmount: Number.isFinite(priceAmount) ? priceAmount : null,
    priceLabel: offer.priceLabel ?? formatCurrency(priceAmount),
    typeLabel: offer.typeLabel ?? formatOfferTypeLabel(offer.type),
  }
}
