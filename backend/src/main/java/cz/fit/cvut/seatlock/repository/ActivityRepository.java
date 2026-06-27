package cz.fit.cvut.seatlock.repository;

import cz.fit.cvut.seatlock.domain.Activity;
import static cz.fit.cvut.seatlock.generated.Tables.*;

import cz.fit.cvut.seatlock.domain.Performer;
import lombok.RequiredArgsConstructor;
import org.jooq.Condition;
import org.jooq.DSLContext;
import org.jooq.impl.DSL;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
@RequiredArgsConstructor
public class ActivityRepository {

    private final DSLContext dsl;

    public List<Activity> findAll() {
        return dsl.selectFrom(ACTIVITY)
                .fetchInto(Activity.class);
    }

    public List<Activity> findAll(int page, int size) {
        return dsl.selectFrom(ACTIVITY)
                .orderBy(ACTIVITY.DATE.asc(), ACTIVITY.START_TIME.asc())
                .limit(size)
                .offset((long) page * size)
                .fetchInto(Activity.class);
    }

    public long count() {
        return dsl.fetchCount(ACTIVITY);
    }

    public Optional<Activity> findById(UUID id) {
        return dsl.selectFrom(ACTIVITY)
                .where(ACTIVITY.ID.eq(id))
                .fetchOptionalInto(Activity.class);
    }

    public Optional<Activity> findByName(String name) {
        return dsl.selectFrom(ACTIVITY)
                .where(ACTIVITY.NAME.eq(name))
                .fetchOptionalInto(Activity.class);
    }

    public Activity save(Activity activity) {
        var record = dsl.newRecord(ACTIVITY, activity);

        if (activity.getCategory() != null) {
            record.setActivityCategoryId(activity.getCategory().getId());
        }
        if (activity.getHall() != null) {
            record.setHallId(activity.getHall().getId());
        }

        if (record.getId() == null) {
            record.setId(UUID.randomUUID());
            record.insert();
        } else {
            record.update();
        }
        return record.into(Activity.class);
    }

    public void savePerformers(UUID activityId, List<Performer> performers) {
        var batch = performers.stream()
                .map(performer -> dsl.insertInto(ACTIVITY_PERFORMER)
                        .set(ACTIVITY_PERFORMER.ACTIVITY_ID, activityId)
                        .set(ACTIVITY_PERFORMER.PERFORMER_ID, performer.getId()))
                .toList();
        dsl.batch(batch).execute();
    }

    public void deletePerformers(UUID activityId) {
        dsl.deleteFrom(ACTIVITY_PERFORMER)
                .where(ACTIVITY_PERFORMER.ACTIVITY_ID.eq(activityId))
                .execute();
    }

    public void deletePerformerFromActivities(UUID performerId) {
        dsl.deleteFrom(ACTIVITY_PERFORMER)
                .where(ACTIVITY_PERFORMER.PERFORMER_ID.eq(performerId))
                .execute();
    }

    public void delete(Activity activity) {
        dsl.deleteFrom(ACTIVITY)
                .where(ACTIVITY.ID.eq(activity.getId()))
                .execute();
    }

    public boolean availableTimeForActivity(UUID hallId, LocalDate date, LocalTime start, LocalTime end, UUID excludeId) {
        var condition = ACTIVITY.HALL_ID.eq(hallId)
                .and(ACTIVITY.DATE.eq(date))
                .and(ACTIVITY.START_TIME.lt(end))
                .and(ACTIVITY.END_TIME.gt(start));

        if (excludeId != null) {
            condition = condition.and(ACTIVITY.ID.ne(excludeId));
        }

        return !dsl.fetchExists(dsl.selectOne().from(ACTIVITY).where(condition));
    }

    public List<UUID> findPerformerIdsByActivityId(UUID activityId) {
        return dsl.select(ACTIVITY_PERFORMER.PERFORMER_ID)
                .from(ACTIVITY_PERFORMER)
                .where(ACTIVITY_PERFORMER.ACTIVITY_ID.eq(activityId))
                .fetchInto(UUID.class);
    }

    public List<Activity> findWithFilters(List<UUID> ids, LocalDate date, LocalDate dateFrom, LocalDate dateTo, LocalTime startTime, String category, String city){
        Condition condition = DSL.trueCondition();

        if(ids != null){
            condition = condition.and(ACTIVITY.ID.in(ids));
        }
        if(date != null){
            condition = condition.and(ACTIVITY.DATE.eq(date));
        }
        if(dateFrom != null){
            condition = condition.and(ACTIVITY.DATE.greaterOrEqual(dateFrom));
        }
        if(dateTo != null){
            condition = condition.and(ACTIVITY.DATE.lessOrEqual(dateTo));
        }
        if(startTime != null){
            condition = condition.and(ACTIVITY.START_TIME.greaterOrEqual(startTime));
        }
        if(category != null){
            condition = condition.and(ACTIVITY_CATEGORY.NAME.eq(category));
        }
        if(city != null){
            condition = condition.and(HALL.CITY.eq(city));
        }

        return dsl.select(ACTIVITY.fields())
                .from(ACTIVITY)
                .join(HALL).on(ACTIVITY.HALL_ID.eq(HALL.ID))
                .join(ACTIVITY_CATEGORY).on(ACTIVITY.ACTIVITY_CATEGORY_ID.eq(ACTIVITY_CATEGORY.ID))
                .where(condition)
                .fetchInto(Activity.class);
    }

    public List<String> findDistinctCities() {
        return dsl.selectDistinct(HALL.CITY)
                .from(HALL)
                .join(ACTIVITY).on(ACTIVITY.HALL_ID.eq(HALL.ID))
                .where(HALL.CITY.isNotNull())
                .orderBy(HALL.CITY.asc())
                .fetchInto(String.class);
    }
}
