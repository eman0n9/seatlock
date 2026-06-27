package cz.fit.cvut.seatlock.repository;

import cz.fit.cvut.seatlock.domain.Seat;
import static cz.fit.cvut.seatlock.generated.Tables.*;
import lombok.RequiredArgsConstructor;
import org.jooq.DSLContext;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
@RequiredArgsConstructor
public class SeatRepository {

    private final DSLContext dsl;

    public List<Seat> findAll() {
        return dsl.selectFrom(SEAT)
                .fetchInto(Seat.class);
    }

    public Optional<Seat> findById(UUID id) {
        return dsl.selectFrom(SEAT)
                .where(SEAT.ID.eq(id))
                .fetchOptionalInto(Seat.class);
    }

    public Seat save(Seat seat) {
        var record = dsl.newRecord(SEAT, seat);
        if (seat.getHall() != null) {
            record.setHallId(seat.getHall().getId());
        }
        if (seat.getId() == null) {
            record.setId(UUID.randomUUID());
            record.insert();
        } else {
            record.update();
        }
        return record.into(Seat.class);
    }

    public List<Seat> findByHallId(UUID hallId) {
        return dsl.selectFrom(SEAT)
                .where(SEAT.HALL_ID.eq(hallId))
                .orderBy(SEAT.ROW_NUMBER, SEAT.SEAT_NUMBER)
                .fetchInto(Seat.class);
    }

    public List<Seat> findAllByIds(List<UUID> ids) {
        return dsl.selectFrom(SEAT)
                .where(SEAT.ID.in(ids))
                .fetchInto(Seat.class);
    }

    public void deleteByHallId(UUID hallId){
        dsl.deleteFrom(SEAT)
                .where(SEAT.HALL_ID.eq(hallId))
                .execute();
    }

    public void saveAll(List<Seat> seats) {
        var records = seats.stream().map(seat -> {
            var record = dsl.newRecord(SEAT, seat);
            if (seat.getHall() != null) {
                record.setHallId(seat.getHall().getId());
            }
            if (seat.getId() == null) {
                record.setId(UUID.randomUUID());
            }
            return record;
        }).toList();

        dsl.batchInsert(records).execute();
    }

    public void delete(Seat seat) {
        dsl.deleteFrom(SEAT)
                .where(SEAT.ID.eq(seat.getId()))
                .execute();
    }
}
