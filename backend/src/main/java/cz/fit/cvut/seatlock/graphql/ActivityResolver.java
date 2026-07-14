package cz.fit.cvut.seatlock.graphql;

import cz.fit.cvut.seatlock.domain.Activity;
import cz.fit.cvut.seatlock.domain.ActivityCategory;
import cz.fit.cvut.seatlock.domain.Hall;
import cz.fit.cvut.seatlock.domain.Performer;
import cz.fit.cvut.seatlock.dto.ActivityDTO;
import cz.fit.cvut.seatlock.dto.ActivityPage;
import cz.fit.cvut.seatlock.dto.SearchInputDTO;
import cz.fit.cvut.seatlock.dto.SeatMapResponse;
import cz.fit.cvut.seatlock.dto.SeatMapRow;
import cz.fit.cvut.seatlock.dto.SetOffersInput;
import cz.fit.cvut.seatlock.repository.ActivityCategoryRepository;
import cz.fit.cvut.seatlock.repository.HallRepository;
import cz.fit.cvut.seatlock.repository.PerformerRepository;
import cz.fit.cvut.seatlock.service.ActivityService;
import lombok.RequiredArgsConstructor;
import org.springframework.graphql.data.method.annotation.Argument;
import org.springframework.graphql.data.method.annotation.BatchMapping;
import org.springframework.graphql.data.method.annotation.MutationMapping;
import org.springframework.graphql.data.method.annotation.QueryMapping;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import cz.fit.cvut.seatlock.security.SeatlockUserDetails;
import org.springframework.stereotype.Controller;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

@Controller
@RequiredArgsConstructor
public class ActivityResolver {
    private final ActivityService activityService;
    private final HallRepository hallRepository;
    private final ActivityCategoryRepository activityCategoryRepository;
    private final PerformerRepository performerRepository;

    @PreAuthorize("hasAnyRole('ORGANIZATION', 'ADMIN')")
    @MutationMapping
    public Boolean createActivity(
            @Argument ActivityDTO input,
            @AuthenticationPrincipal SeatlockUserDetails user
    ) {
        return activityService.createActivity(input, user.getId());
    }

    @PreAuthorize("hasAnyRole('ORGANIZATION', 'ADMIN')")
    @MutationMapping
    public Boolean setOffers(
            @Argument UUID activityId,
            @Argument SetOffersInput input,
            @AuthenticationPrincipal SeatlockUserDetails user
    ) {
        return activityService.setOffers(activityId, input, user.getId(), isAdmin(user));
    }

    @PreAuthorize("hasAnyRole('ORGANIZATION', 'ADMIN')")
    @MutationMapping
    public Boolean deleteActivity(
            @Argument UUID id,
            @AuthenticationPrincipal SeatlockUserDetails user
    ) {
        return activityService.deleteActivity(id, user.getId(), isAdmin(user));
    }

    @PreAuthorize("hasAnyRole('ORGANIZATION', 'ADMIN')")
    @MutationMapping
    public Boolean updateActivity(
            @Argument ActivityDTO input,
            @Argument UUID id,
            @AuthenticationPrincipal SeatlockUserDetails user
    ) {
        return activityService.updateActivity(input, id, user.getId(), isAdmin(user));
    }

    @QueryMapping
    public ActivityPage getAllActivities(@Argument int page, @Argument int size) {
        return activityService.getAllActivities(page, size);
    }

    @QueryMapping
    public Activity getActivityById(@Argument UUID id) {
        return activityService.getActivityById(id);
    }

    @QueryMapping
    public List<Activity> searchActivities(@Argument SearchInputDTO input){
        return activityService.search(input);
    }

    @QueryMapping
    public List<String> getCities() {
        return activityService.getCities();
    }

    @QueryMapping
    public SeatMapResponse getSeatMap(@Argument UUID id) {
        return activityService.getSeatMap(id);
    }

    @BatchMapping
    public Map<Activity, Hall> hall(List<Activity> activities) {
        List<UUID> hallIds = activities.stream()
                .map(Activity::getHallId)
                .toList();
        Map<UUID, Hall> hallById = hallRepository.findAllByIds(hallIds).stream()
                .collect(Collectors.toMap(Hall::getId, h -> h));
        return activities.stream()
                .collect(Collectors.toMap(a -> a, a -> hallById.get(a.getHallId())));
    }

    @BatchMapping
    public Map<Activity, ActivityCategory> category(List<Activity> activities) {
        List<UUID> categoryIds = activities.stream()
                .map(Activity::getActivityCategoryId)
                .toList();
        Map<UUID, ActivityCategory> categoryById = activityCategoryRepository.findAllByIds(categoryIds).stream()
                .collect(Collectors.toMap(ActivityCategory::getId, c -> c));
        return activities.stream()
                .collect(Collectors.toMap(a -> a, a -> categoryById.get(a.getActivityCategoryId())));
    }

    @BatchMapping
    public Map<Activity, List<Performer>> performers(List<Activity> activities) {
        List<UUID> activityIds = activities.stream()
                .map(Activity::getId)
                .toList();
        Map<UUID, List<Performer>> performersByActivityId =
                performerRepository.findAllByActivityIds(activityIds);
        return activities.stream()
                .collect(Collectors.toMap(a -> a, a -> performersByActivityId.getOrDefault(a.getId(), new ArrayList<>())));
    }

    private boolean isAdmin(SeatlockUserDetails user) {
        return user.getAuthorities().stream()
                .anyMatch(authority -> "ROLE_ADMIN".equals(authority.getAuthority()));
    }
}
