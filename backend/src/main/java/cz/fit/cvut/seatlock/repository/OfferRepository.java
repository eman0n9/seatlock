package cz.fit.cvut.seatlock.repository;

import cz.fit.cvut.seatlock.domain.Offer;
import cz.fit.cvut.seatlock.domain.Seat;
import static cz.fit.cvut.seatlock.generated.Tables.*;
import lombok.RequiredArgsConstructor;
import org.jooq.DSLContext;
import org.jooq.Query;
import org.jooq.impl.DSL;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Collectors;

@Repository
@RequiredArgsConstructor
public class OfferRepository {

    private final DSLContext dsl;

    public List<Offer> findAll() {
        return dsl.selectFrom(OFFER)
                .fetchInto(Offer.class);
    }

    public Optional<Offer> findById(UUID id) {
        return dsl.selectFrom(OFFER)
                .where(OFFER.ID.eq(id))
                .fetchOptionalInto(Offer.class);
    }

    public Offer save(Offer offer) {
        var record = dsl.newRecord(OFFER, offer);
        if (offer.getType() != null) {
            record.setType(offer.getType().name());
        }
        if (offer.getActivity() != null) {
            record.setActivityId(offer.getActivity().getId());
        }
        if (offer.getId() == null) {
            record.setId(UUID.randomUUID());
            record.insert();
        } else {
            record.update();
        }
        
        saveOfferSeats(record.getId(), offer.getSeats());
        
        return record.into(Offer.class);
    }

    private void saveOfferSeats(UUID offerId, List<Seat> seats) {
        if (seats == null || seats.isEmpty()) return;
        
        dsl.deleteFrom(DSL.table("offer_seat"))
                .where(DSL.field("offer_id").eq(offerId))
                .execute();
        
        List<Query> batch = seats.stream()
                .map(seat -> dsl.insertInto(DSL.table("offer_seat"), DSL.field("offer_id"), DSL.field("seat_id"))
                        .values(offerId, seat.getId()))
                .collect(Collectors.toList());
        
        dsl.batch(batch).execute();
    }

    public List<Offer> findByActivityId(UUID activityId) {
        List<Offer> offers = dsl.selectFrom(OFFER)
                .where(OFFER.ACTIVITY_ID.eq(activityId))
                .fetchInto(Offer.class);
        
        for (Offer offer : offers) {
            List<Seat> seats = dsl.select(SEAT.fields())
                    .from(SEAT)
                    .join(DSL.table("offer_seat")).on(SEAT.ID.eq(DSL.field("offer_seat.seat_id", UUID.class)))
                    .where(DSL.field("offer_seat.offer_id").eq(offer.getId()))
                    .fetchInto(Seat.class);
            offer.setSeats(seats);
        }
        
        return offers;
    }

    public void delete(Offer offer) {
        dsl.deleteFrom(OFFER)
                .where(OFFER.ID.eq(offer.getId()))
                .execute();
    }
}
