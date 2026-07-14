package cz.fit.cvut.seatlock.config;

import cz.fit.cvut.seatlock.domain.Activity;
import cz.fit.cvut.seatlock.domain.Performer;
import cz.fit.cvut.seatlock.es_documents.ActivityDocument;
import cz.fit.cvut.seatlock.es_documents.ActivitySearchRepository;
import cz.fit.cvut.seatlock.es_documents.PerformerDocument;
import cz.fit.cvut.seatlock.es_documents.PerformerSearchRepository;
import cz.fit.cvut.seatlock.repository.ActivityRepository;
import cz.fit.cvut.seatlock.repository.PerformerRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.boot.DefaultApplicationArguments;

import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class SearchIndexInitializerTest {

    @Mock private ActivityRepository activityRepository;
    @Mock private PerformerRepository performerRepository;
    @Mock private ActivitySearchRepository activitySearchRepository;
    @Mock private PerformerSearchRepository performerSearchRepository;

    @InjectMocks
    private SearchIndexInitializer initializer;

    @Test
    @SuppressWarnings("unchecked")
    void rebuildsSearchDocumentsFromDatabaseState() {
        UUID activityId = UUID.randomUUID();
        UUID performerId = UUID.randomUUID();

        Activity activity = new Activity();
        activity.setId(activityId);
        activity.setName("Live Demo");
        activity.setDescription("Demo event");

        Performer performer = new Performer();
        performer.setId(performerId);
        performer.setName("Demo Artist");

        when(activityRepository.findAll()).thenReturn(List.of(activity));
        when(performerRepository.findAllByActivityIds(List.of(activityId)))
                .thenReturn(Map.of(activityId, List.of(performer)));
        when(performerRepository.findAll()).thenReturn(List.of(performer));

        initializer.run(new DefaultApplicationArguments(new String[0]));

        ArgumentCaptor<Iterable<ActivityDocument>> activityDocuments =
                ArgumentCaptor.forClass(Iterable.class);
        ArgumentCaptor<Iterable<PerformerDocument>> performerDocuments =
                ArgumentCaptor.forClass(Iterable.class);
        verify(activitySearchRepository).saveAll(activityDocuments.capture());
        verify(performerSearchRepository).saveAll(performerDocuments.capture());

        ActivityDocument indexedActivity = activityDocuments.getValue().iterator().next();
        PerformerDocument indexedPerformer = performerDocuments.getValue().iterator().next();
        assertEquals(activityId.toString(), indexedActivity.getId());
        assertEquals(List.of("Demo Artist"), indexedActivity.getPerformerNames());
        assertEquals(performerId.toString(), indexedPerformer.getId());
    }
}
