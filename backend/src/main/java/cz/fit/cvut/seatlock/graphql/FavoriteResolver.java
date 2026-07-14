package cz.fit.cvut.seatlock.graphql;

import cz.fit.cvut.seatlock.domain.Activity;
import cz.fit.cvut.seatlock.domain.Performer;
import cz.fit.cvut.seatlock.security.SeatlockUserDetails;
import cz.fit.cvut.seatlock.service.FavoriteService;
import lombok.RequiredArgsConstructor;
import org.springframework.graphql.data.method.annotation.Argument;
import org.springframework.graphql.data.method.annotation.MutationMapping;
import org.springframework.graphql.data.method.annotation.QueryMapping;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Controller;

import java.util.List;
import java.util.UUID;

@Controller
@RequiredArgsConstructor
public class FavoriteResolver {

    private final FavoriteService favoriteService;

    private UUID getCurrentUserId() {
        var principal = SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        if (principal instanceof SeatlockUserDetails details) {
            return details.getId();
        }
        throw new RuntimeException("User not authenticated");
    }

    @QueryMapping
    @PreAuthorize("isAuthenticated()")
    public List<Activity> getFavoriteActivities() {
        return favoriteService.getFavoriteActivities(getCurrentUserId());
    }

    @QueryMapping
    @PreAuthorize("isAuthenticated()")
    public List<Performer> getFavoritePerformers() {
        return favoriteService.getFavoritePerformers(getCurrentUserId());
    }

    @MutationMapping
    @PreAuthorize("isAuthenticated()")
    public boolean toggleFavoriteActivity(@Argument UUID activityId) {
        return favoriteService.toggleFavoriteActivity(getCurrentUserId(), activityId);
    }

    @MutationMapping
    @PreAuthorize("isAuthenticated()")
    public boolean toggleFavoritePerformer(@Argument UUID performerId) {
        return favoriteService.toggleFavoritePerformer(getCurrentUserId(), performerId);
    }
}
