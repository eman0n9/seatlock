package cz.fit.cvut.seatlock.service;

import cz.fit.cvut.seatlock.domain.ActivityCategory;
import cz.fit.cvut.seatlock.repository.ActivityCategoryRepository;
import cz.fit.cvut.seatlock.repository.ActivityRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class ActivityCategoryService {
    private final ActivityCategoryRepository activityCategoryRepository;
    private final ActivityRepository activityRepository;

    public List<ActivityCategory> showAllCategories() {
        return activityCategoryRepository.findAll();
    }

    public Boolean deleteCategory(UUID id) {
        var category = activityCategoryRepository.findById(id).orElseThrow();
        activityCategoryRepository.delete(category);
        return true;
    }

    public Boolean changeCategory(UUID id, String name) {
        var category = activityCategoryRepository.findById(id).orElseThrow();
        category.setName(name);
        activityCategoryRepository.save(category);
        return true;
    }

    public Boolean addCategory(String name) {
        activityCategoryRepository.findByName(name).ifPresent(activityCategory -> {
            throw new RuntimeException();
        });
        ActivityCategory category = new ActivityCategory(name);
        activityCategoryRepository.save(category);
        return true;
    }
}