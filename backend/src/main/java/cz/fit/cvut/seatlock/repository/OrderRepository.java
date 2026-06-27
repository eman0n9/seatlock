package cz.fit.cvut.seatlock.repository;

import cz.fit.cvut.seatlock.domain.Hall;
import cz.fit.cvut.seatlock.domain.Order;
import cz.fit.cvut.seatlock.domain.User;
import cz.fit.cvut.seatlock.dto.OrderActivityDTO;
import cz.fit.cvut.seatlock.dto.OrderDTO;
import cz.fit.cvut.seatlock.dto.OrderTicketDTO;
import static cz.fit.cvut.seatlock.generated.Tables.*;
import lombok.RequiredArgsConstructor;
import org.jooq.DSLContext;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
@RequiredArgsConstructor
public class OrderRepository {

    private final DSLContext dsl;

    public List<Order> findAll() {
        return dsl.selectFrom(APP_ORDER)
                .fetchInto(Order.class);
    }

    public Optional<Order> findById(UUID id) {
        return dsl.selectFrom(APP_ORDER)
                .where(APP_ORDER.ID.eq(id))
                .fetchOptional(r -> {
                    Order o = r.into(Order.class);
                    User user = new User();
                    user.setId(r.get(APP_ORDER.USER_ID));
                    o.setUser(user);
                    return o;
                });
    }

    public Order save(Order order) {
        var record = dsl.newRecord(APP_ORDER, order);
        if (order.getStatus() != null) {
            record.setStatus(order.getStatus().name());
        }
        if (order.getUser() != null) {
            record.setUserId(order.getUser().getId());
        }
        if (order.getId() == null) {
            record.setId(UUID.randomUUID());
            record.insert();
        } else {
            record.update();
        }
        return record.into(Order.class);
    }

    public List<Order> findByUserId(UUID userId) {
        return dsl.selectFrom(APP_ORDER)
                .where(APP_ORDER.USER_ID.eq(userId))
                .orderBy(APP_ORDER.CREATED_AT.desc())
                .fetch(r -> {
                    Order o = r.into(Order.class);
                    User user = new User();
                    user.setId(r.get(APP_ORDER.USER_ID));
                    o.setUser(user);
                    return o;
                });
    }

    public List<Order> findUpcomingByUserId(UUID userId) {
        return dsl.selectDistinct(APP_ORDER.fields())
                .from(APP_ORDER)
                .join(TICKET).on(TICKET.ORDER_ID.eq(APP_ORDER.ID))
                .join(OFFER).on(TICKET.OFFER_ID.eq(OFFER.ID))
                .join(ACTIVITY).on(OFFER.ACTIVITY_ID.eq(ACTIVITY.ID))
                .where(APP_ORDER.USER_ID.eq(userId))
                .and(ACTIVITY.DATE.greaterOrEqual(LocalDate.now()))
                .orderBy(ACTIVITY.DATE.asc(), ACTIVITY.START_TIME.asc())
                .fetch(r -> {
                    Order o = r.into(Order.class);
                    User user = new User();
                    user.setId(r.get(APP_ORDER.USER_ID));
                    o.setUser(user);
                    return o;
                });
    }

    public List<Order> findPastByUserId(UUID userId) {
        return dsl.selectDistinct(APP_ORDER.fields())
                .from(APP_ORDER)
                .join(TICKET).on(TICKET.ORDER_ID.eq(APP_ORDER.ID))
                .join(OFFER).on(TICKET.OFFER_ID.eq(OFFER.ID))
                .join(ACTIVITY).on(OFFER.ACTIVITY_ID.eq(ACTIVITY.ID))
                .where(APP_ORDER.USER_ID.eq(userId))
                .and(ACTIVITY.DATE.lessThan(LocalDate.now()))
                .orderBy(ACTIVITY.DATE.desc(), ACTIVITY.START_TIME.desc())
                .fetch(r -> {
                    Order o = r.into(Order.class);
                    User user = new User();
                    user.setId(r.get(APP_ORDER.USER_ID));
                    o.setUser(user);
                    return o;
                });
    }

    public Optional<OrderDTO> findByIdAsDTO(UUID orderId) {
        var rows = dsl.select(
                        APP_ORDER.ID,
                        APP_ORDER.TOTAL_PRICE,
                        APP_ORDER.STATUS,
                        APP_ORDER.CREATED_AT,
                        TICKET.ID.as("ticket_id"),
                        SEAT.SEAT_NUMBER,
                        SEAT.ROW_NUMBER,
                        ACTIVITY.NAME.as("act_name"),
                        ACTIVITY.DATE.as("act_date"),
                        ACTIVITY.START_TIME,
                        ACTIVITY.END_TIME,
                        ACTIVITY.DESCRIPTION,
                        HALL.ID.as("hall_id"),
                        HALL.NAME.as("hall_name"),
                        HALL.ADDRESS,
                        HALL.CITY
                )
                .from(APP_ORDER)
                .join(TICKET).on(TICKET.ORDER_ID.eq(APP_ORDER.ID))
                .join(SEAT).on(TICKET.SEAT_ID.eq(SEAT.ID))
                .join(OFFER).on(TICKET.OFFER_ID.eq(OFFER.ID))
                .join(ACTIVITY).on(OFFER.ACTIVITY_ID.eq(ACTIVITY.ID))
                .join(HALL).on(ACTIVITY.HALL_ID.eq(HALL.ID))
                .where(APP_ORDER.ID.eq(orderId))
                .fetch();

        if (rows.isEmpty()) return Optional.empty();

        var first = rows.get(0);

        Hall hall = new Hall();
        hall.setId(first.get("hall_id", UUID.class));
        hall.setName(first.get("hall_name", String.class));
        hall.setAddress(first.get(HALL.ADDRESS));
        hall.setCity(first.get(HALL.CITY));

        OrderActivityDTO activity = new OrderActivityDTO(
                first.get("act_name", String.class),
                first.get("act_date", LocalDate.class).toString(),
                first.get(ACTIVITY.START_TIME).toString(),
                first.get(ACTIVITY.END_TIME).toString(),
                first.get(ACTIVITY.DESCRIPTION),
                hall
        );

        List<OrderTicketDTO> tickets = rows.stream()
                .map(r -> new OrderTicketDTO(
                        r.get("ticket_id", UUID.class),
                        r.get(SEAT.SEAT_NUMBER),
                        r.get(SEAT.ROW_NUMBER)
                ))
                .toList();

        return Optional.of(new OrderDTO(
                first.get(APP_ORDER.ID),
                first.get(APP_ORDER.TOTAL_PRICE),
                first.get(APP_ORDER.STATUS),
                first.get(APP_ORDER.CREATED_AT).toString(),
                tickets,
                activity
        ));
    }

    public void delete(Order order) {
        dsl.deleteFrom(APP_ORDER)
                .where(APP_ORDER.ID.eq(order.getId()))
                .execute();
    }
}
