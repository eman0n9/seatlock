package cz.fit.cvut.seatlock.service;

import cz.fit.cvut.seatlock.domain.Performer;
import cz.fit.cvut.seatlock.es_documents.PerformerSearchRepository;
import cz.fit.cvut.seatlock.repository.ActivityRepository;
import cz.fit.cvut.seatlock.repository.FavoriteRepository;
import cz.fit.cvut.seatlock.repository.PerformerRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.transaction.support.TransactionSynchronizationUtils;

import java.util.Optional;
import java.util.UUID;

import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class PerformerServiceTest {
    @Mock private PerformerRepository performerRepository;
    @Mock private ActivityRepository activityRepository;
    @Mock private FavoriteRepository favoriteRepository;
    @Mock private ApplicationEventPublisher eventPublisher;
    @Mock private PerformerSearchRepository performerSearchRepository;

    @InjectMocks
    private PerformerService performerService;

    @Test
    void deleteCleansRelationsAtomicallyAndIndexesOnlyAfterCommit() {
        UUID performerId = UUID.randomUUID();
        Performer performer = new Performer();
        performer.setId(performerId);
        when(performerRepository.findById(performerId)).thenReturn(Optional.of(performer));

        TransactionSynchronizationManager.initSynchronization();
        try {
            performerService.deletePerformer(performerId);

            verify(favoriteRepository).removeAllForPerformer(performerId);
            verify(activityRepository).deletePerformerFromActivities(performerId);
            verify(performerRepository).delete(performer);
            verify(performerSearchRepository, never()).deleteById(performerId.toString());

            TransactionSynchronizationUtils.triggerAfterCommit();
            verify(performerSearchRepository).deleteById(performerId.toString());
        } finally {
            TransactionSynchronizationManager.clearSynchronization();
        }
    }
}
