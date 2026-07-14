package cz.fit.cvut.seatlock.service;

import cz.fit.cvut.seatlock.domain.Activity;
import cz.fit.cvut.seatlock.domain.Performer;
import cz.fit.cvut.seatlock.repository.ActivityRepository;
import cz.fit.cvut.seatlock.repository.FavoriteRepository;
import cz.fit.cvut.seatlock.repository.PerformerRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class FavoriteService {

    private final FavoriteRepository favoriteRepository;
    private final ActivityRepository activityRepository;
    private final PerformerRepository performerRepository;

    public List<Activity> getFavoriteActivities(UUID userId) {
        return favoriteRepository.findFavoriteActivitiesByUserId(userId);
    }

    public List<Performer> getFavoritePerformers(UUID userId) {
        return favoriteRepository.findFavoritePerformersByUserId(userId);
    }

    public boolean toggleFavoriteActivity(UUID userId, UUID activityId) {
        activityRepository.findById(activityId)
                .orElseThrow(() -> new RuntimeException("Activity not found"));

        if (favoriteRepository.isActivityFavorited(userId, activityId)) {
            favoriteRepository.removeFavoriteActivity(userId, activityId);
            return false;
        } else {
            favoriteRepository.addFavoriteActivity(userId, activityId);
            return true;
        }
    }

    public boolean toggleFavoritePerformer(UUID userId, UUID performerId) {
        performerRepository.findById(performerId)
                .orElseThrow(() -> new RuntimeException("Performer not found"));

        if (favoriteRepository.isPerformerFavorited(userId, performerId)) {
            favoriteRepository.removeFavoritePerformer(userId, performerId);
            return false;
        } else {
            favoriteRepository.addFavoritePerformer(userId, performerId);
            return true;
        }
    }

    public boolean isActivityFavorited(UUID userId, UUID activityId) {
        return favoriteRepository.isActivityFavorited(userId, activityId);
    }

    public boolean isPerformerFavorited(UUID userId, UUID performerId) {
        return favoriteRepository.isPerformerFavorited(userId, performerId);
    }
}
