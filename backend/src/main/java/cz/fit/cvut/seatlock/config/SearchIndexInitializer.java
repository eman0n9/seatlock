package cz.fit.cvut.seatlock.config;

import cz.fit.cvut.seatlock.domain.Activity;
import cz.fit.cvut.seatlock.domain.Performer;
import cz.fit.cvut.seatlock.es_documents.ActivityDocument;
import cz.fit.cvut.seatlock.es_documents.ActivitySearchRepository;
import cz.fit.cvut.seatlock.es_documents.PerformerDocument;
import cz.fit.cvut.seatlock.es_documents.PerformerSearchRepository;
import cz.fit.cvut.seatlock.repository.ActivityRepository;
import cz.fit.cvut.seatlock.repository.PerformerRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@Component
@Order(1)
@RequiredArgsConstructor
@Slf4j
public class SearchIndexInitializer implements ApplicationRunner {

    private final ActivityRepository activityRepository;
    private final PerformerRepository performerRepository;
    private final ActivitySearchRepository activitySearchRepository;
    private final PerformerSearchRepository performerSearchRepository;

    @Override
    public void run(ApplicationArguments args) {
        try {
            List<Activity> activities = activityRepository.findAll();
            List<UUID> activityIds = activities.stream().map(Activity::getId).toList();
            Map<UUID, List<Performer>> performersByActivity = activityIds.isEmpty()
                    ? Map.of()
                    : performerRepository.findAllByActivityIds(activityIds);

            if (!activities.isEmpty()) {
                activitySearchRepository.saveAll(activities.stream()
                        .map(activity -> new ActivityDocument(
                                activity.getId().toString(),
                                activity.getName(),
                                activity.getDescription(),
                                performersByActivity.getOrDefault(activity.getId(), List.of()).stream()
                                        .map(Performer::getName)
                                        .toList()
                        ))
                        .toList());
            }

            List<Performer> performers = performerRepository.findAll();
            if (!performers.isEmpty()) {
                performerSearchRepository.saveAll(performers.stream()
                        .map(performer -> new PerformerDocument(
                                performer.getId().toString(),
                                performer.getName()
                        ))
                        .toList());
            }

            log.info("Search index synchronized: {} activities, {} performers",
                    activities.size(), performers.size());
        } catch (RuntimeException ex) {
            log.error("Search index could not be synchronized from the database", ex);
        }
    }
}
