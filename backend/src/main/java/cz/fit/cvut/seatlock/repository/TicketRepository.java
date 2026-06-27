package cz.fit.cvut.seatlock.repository;

import cz.fit.cvut.seatlock.domain.Ticket;
import cz.fit.cvut.seatlock.domain.enums.TicketStatus;
import static cz.fit.cvut.seatlock.generated.Tables.*;
import lombok.RequiredArgsConstructor;
import org.jooq.DSLContext;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

@Repository
@RequiredArgsConstructor
public class TicketRepository {

    private final DSLContext dsl;

    public List<Ticket> findAll() {
        return dsl.selectFrom(TICKET)
                .fetchInto(Ticket.class);
    }

    public Optional<Ticket> findById(UUID id) {
        return dsl.selectFrom(TICKET)
                .where(TICKET.ID.eq(id))
                .fetchOptionalInto(Ticket.class);
    }

    public Ticket save(Ticket ticket) {
        var record = dsl.newRecord(TICKET, ticket);
        if (ticket.getStatus() != null) {
            record.setStatus(ticket.getStatus().name());
        }
        if (ticket.getOrder() != null) {
            record.setOrderId(ticket.getOrder().getId());
        }
        if (ticket.getSeat() != null) {
            record.setSeatId(ticket.getSeat().getId());
        }
        if (ticket.getOffer() != null) {
            record.setOfferId(ticket.getOffer().getId());
        }
        if (ticket.getId() == null) {
            record.setId(UUID.randomUUID());
            record.insert();
        } else {
            record.update();
        }
        return record.into(Ticket.class);
    }

    public Map<UUID, TicketStatus> findStatusesByActivityId(UUID activityId) {
        return dsl.select(TICKET.SEAT_ID, TICKET.STATUS)
                .from(TICKET)
                .join(OFFER).on(TICKET.OFFER_ID.eq(OFFER.ID))
                .where(OFFER.ACTIVITY_ID.eq(activityId))
                .fetchMap(TICKET.SEAT_ID, r -> TicketStatus.valueOf(r.get(TICKET.STATUS)));
    }

    public List<UUID> findPurchasedSeatIdsByActivityId(UUID activityId) {
        return dsl.select(TICKET.SEAT_ID)
                .from(TICKET)
                .join(OFFER).on(TICKET.OFFER_ID.eq(OFFER.ID))
                .where(OFFER.ACTIVITY_ID.eq(activityId))
                .and(TICKET.STATUS.eq(TicketStatus.SOLD.name()))
                .fetch(TICKET.SEAT_ID);
    }

    public List<Ticket> findByOrderId(UUID orderId) {
        return dsl.selectFrom(TICKET)
                .where(TICKET.ORDER_ID.eq(orderId))
                .fetch(r -> {
                    Ticket t = r.into(Ticket.class);
                    cz.fit.cvut.seatlock.domain.Seat seat = new cz.fit.cvut.seatlock.domain.Seat();
                    seat.setId(r.get(TICKET.SEAT_ID));
                    t.setSeat(seat);
                    return t;
                });
    }

    public void delete(Ticket ticket) {
        dsl.deleteFrom(TICKET)
                .where(TICKET.ID.eq(ticket.getId()))
                .execute();
    }
}
