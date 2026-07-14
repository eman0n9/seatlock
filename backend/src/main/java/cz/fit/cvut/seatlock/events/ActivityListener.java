package cz.fit.cvut.seatlock.events;

import cz.fit.cvut.seatlock.es_documents.ActivityDocument;
import cz.fit.cvut.seatlock.es_documents.ActivitySearchRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

@Component
@RequiredArgsConstructor
@Slf4j
public class ActivityListener {
    private final ActivitySearchRepository activitySearchRepository;

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void createDocument(ActivityEventDTO event){
        try {
            ActivityDocument newDocument = new ActivityDocument(event.activityId().toString(), event.name(), event.description(), event.performerNames());
            activitySearchRepository.save(newDocument);
        } catch (RuntimeException ex) {
            log.error("Activity {} was committed, but its search index could not be synchronized", event.activityId(), ex);
        }
    }
}
