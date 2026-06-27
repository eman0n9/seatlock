package cz.fit.cvut.seatlock.events;

import cz.fit.cvut.seatlock.es_documents.ActivityDocument;
import cz.fit.cvut.seatlock.es_documents.ActivitySearchRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

@Component
@RequiredArgsConstructor
public class ActivityListener {
    private final ActivitySearchRepository activitySearchRepository;

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void createDocument(ActivityEventDTO event){
        ActivityDocument newDocument = new ActivityDocument(event.activityId().toString(), event.name(), event.description(), event.performerNames());
        activitySearchRepository.save(newDocument);
    }
}
