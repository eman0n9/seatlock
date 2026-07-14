package cz.fit.cvut.seatlock.repository;

import cz.fit.cvut.seatlock.domain.ActivityCategory;
import static cz.fit.cvut.seatlock.generated.Tables.*;
import lombok.RequiredArgsConstructor;
import org.jooq.DSLContext;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
@RequiredArgsConstructor
public class ActivityCategoryRepository {

    private final DSLContext dsl;

    public List<ActivityCategory> findAll() {
        return dsl.selectFrom(ACTIVITY_CATEGORY)
                .fetchInto(ActivityCategory.class);
    }

    public Optional<ActivityCategory> findById(UUID id) {
        return dsl.selectFrom(ACTIVITY_CATEGORY)
                .where(ACTIVITY_CATEGORY.ID.eq(id))
                .fetchOptionalInto(ActivityCategory.class);
    }

    public Optional<ActivityCategory> findByName(String name) {
        return dsl.selectFrom(ACTIVITY_CATEGORY)
                .where(ACTIVITY_CATEGORY.NAME.eq(name))
                .fetchOptionalInto(ActivityCategory.class);
    }

    public ActivityCategory save(ActivityCategory category) {
        var record = dsl.newRecord(ACTIVITY_CATEGORY, category);
        if (category.getId() == null) {
            record.setId(UUID.randomUUID());
            record.insert();
        } else {
            record.update();
        }
        return record.into(ActivityCategory.class);
    }

    public List<ActivityCategory> findAllByIds(List<UUID> ids) {
        return dsl.selectFrom(ACTIVITY_CATEGORY)
                .where(ACTIVITY_CATEGORY.ID.in(ids))
                .fetchInto(ActivityCategory.class);
    }

    public void delete(ActivityCategory category) {
        dsl.deleteFrom(ACTIVITY_CATEGORY)
                .where(ACTIVITY_CATEGORY.ID.eq(category.getId()))
                .execute();
    }
}
