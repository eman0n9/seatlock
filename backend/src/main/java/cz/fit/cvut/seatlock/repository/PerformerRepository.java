package cz.fit.cvut.seatlock.repository;

import cz.fit.cvut.seatlock.domain.Performer;
import static cz.fit.cvut.seatlock.generated.Tables.*;
import lombok.RequiredArgsConstructor;
import org.jooq.DSLContext;
import org.springframework.stereotype.Repository;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

@Repository
@RequiredArgsConstructor
public class PerformerRepository {

    private final DSLContext dsl;

    public List<Performer> findAll() {
        return dsl.selectFrom(PERFORMER)
                .fetchInto(Performer.class);
    }

    public List<Performer> findAll(int page, int size) {
        return dsl.selectFrom(PERFORMER)
                .orderBy(PERFORMER.NAME.asc())
                .limit(size)
                .offset((long) page * size)
                .fetchInto(Performer.class);
    }

    public long count() {
        return dsl.fetchCount(PERFORMER);
    }

    public Optional<Performer> findById(UUID id) {
        return dsl.selectFrom(PERFORMER)
                .where(PERFORMER.ID.eq(id))
                .fetchOptionalInto(Performer.class);
    }

    public Optional<Performer> findByName(String name) {
        return dsl.selectFrom(PERFORMER)
                .where(PERFORMER.NAME.eq(name))
                .fetchOptionalInto(Performer.class);
    }

    public List<Performer> findAllByIds(List<UUID> ids) {
        return dsl.selectFrom(PERFORMER)
                .where(PERFORMER.ID.in(ids))
                .fetchInto(Performer.class);
    }

    public Performer save(Performer performer) {
        var record = dsl.newRecord(PERFORMER, performer);
        if (performer.getId() == null) {
            record.setId(UUID.randomUUID());
            record.insert();
        } else {
            record.update();
        }
        return record.into(Performer.class);
    }

    public Map<UUID, List<Performer>> findAllByActivityIds(List<UUID> activityIds) {
        var records = dsl.select()
                .from(PERFORMER)
                .join(ACTIVITY_PERFORMER).on(ACTIVITY_PERFORMER.PERFORMER_ID.eq(PERFORMER.ID))
                .where(ACTIVITY_PERFORMER.ACTIVITY_ID.in(activityIds))
                .fetch();

        Map<UUID, List<Performer>> result = new HashMap<>();
        for (var record : records) {
            UUID activityId = record.get(ACTIVITY_PERFORMER.ACTIVITY_ID);
            Performer performer = record.into(PERFORMER).into(Performer.class);
            result.computeIfAbsent(activityId, k -> new ArrayList<>()).add(performer);
        }
        return result;
    }

    public void delete(Performer performer) {
        dsl.deleteFrom(PERFORMER)
                .where(PERFORMER.ID.eq(performer.getId()))
                .execute();
    }
}
