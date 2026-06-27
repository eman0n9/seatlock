package cz.fit.cvut.seatlock.repository;

import static cz.fit.cvut.seatlock.generated.Tables.*;

import cz.fit.cvut.seatlock.domain.Activity;
import cz.fit.cvut.seatlock.domain.Performer;
import lombok.RequiredArgsConstructor;
import org.jooq.DSLContext;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
@RequiredArgsConstructor
public class FavoriteRepository {

    private final DSLContext dsl;

    public List<Activity> findFavoriteActivitiesByUserId(UUID userId) {
        return dsl.select(ACTIVITY.fields())
                .from(USER_FAVORITE_ACTIVITY)
                .join(ACTIVITY).on(USER_FAVORITE_ACTIVITY.ACTIVITY_ID.eq(ACTIVITY.ID))
                .where(USER_FAVORITE_ACTIVITY.USER_ID.eq(userId))
                .fetchInto(Activity.class);
    }

    public List<Performer> findFavoritePerformersByUserId(UUID userId) {
        return dsl.select(PERFORMER.fields())
                .from(USER_FAVORITE_PERFORMER)
                .join(PERFORMER).on(USER_FAVORITE_PERFORMER.PERFORMER_ID.eq(PERFORMER.ID))
                .where(USER_FAVORITE_PERFORMER.USER_ID.eq(userId))
                .fetchInto(Performer.class);
    }

    public boolean isActivityFavorited(UUID userId, UUID activityId) {
        return dsl.fetchExists(
                dsl.selectOne()
                        .from(USER_FAVORITE_ACTIVITY)
                        .where(USER_FAVORITE_ACTIVITY.USER_ID.eq(userId))
                        .and(USER_FAVORITE_ACTIVITY.ACTIVITY_ID.eq(activityId))
        );
    }

    public boolean isPerformerFavorited(UUID userId, UUID performerId) {
        return dsl.fetchExists(
                dsl.selectOne()
                        .from(USER_FAVORITE_PERFORMER)
                        .where(USER_FAVORITE_PERFORMER.USER_ID.eq(userId))
                        .and(USER_FAVORITE_PERFORMER.PERFORMER_ID.eq(performerId))
        );
    }

    public void addFavoriteActivity(UUID userId, UUID activityId) {
        dsl.insertInto(USER_FAVORITE_ACTIVITY)
                .set(USER_FAVORITE_ACTIVITY.USER_ID, userId)
                .set(USER_FAVORITE_ACTIVITY.ACTIVITY_ID, activityId)
                .onConflictDoNothing()
                .execute();
    }

    public void removeFavoriteActivity(UUID userId, UUID activityId) {
        dsl.deleteFrom(USER_FAVORITE_ACTIVITY)
                .where(USER_FAVORITE_ACTIVITY.USER_ID.eq(userId))
                .and(USER_FAVORITE_ACTIVITY.ACTIVITY_ID.eq(activityId))
                .execute();
    }

    public void addFavoritePerformer(UUID userId, UUID performerId) {
        dsl.insertInto(USER_FAVORITE_PERFORMER)
                .set(USER_FAVORITE_PERFORMER.USER_ID, userId)
                .set(USER_FAVORITE_PERFORMER.PERFORMER_ID, performerId)
                .onConflictDoNothing()
                .execute();
    }

    public void removeFavoritePerformer(UUID userId, UUID performerId) {
        dsl.deleteFrom(USER_FAVORITE_PERFORMER)
                .where(USER_FAVORITE_PERFORMER.USER_ID.eq(userId))
                .and(USER_FAVORITE_PERFORMER.PERFORMER_ID.eq(performerId))
                .execute();
    }
}
