package cz.fit.cvut.seatlock.events;

import cz.fit.cvut.seatlock.es_documents.PerformerDocument;
import cz.fit.cvut.seatlock.es_documents.PerformerSearchRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionalEventListener;

import static org.springframework.transaction.event.TransactionPhase.AFTER_COMMIT;

@Component
@RequiredArgsConstructor
@Slf4j
public class PerformerListener {
    private final PerformerSearchRepository performerSearchRepository;

    @TransactionalEventListener(phase = AFTER_COMMIT)
    public void createDocument(PerformerEventDTO event){
        try {
            PerformerDocument newDocument = new PerformerDocument(event.id().toString(), event.name());
            performerSearchRepository.save(newDocument);
        } catch (RuntimeException ex) {
            log.error("Performer {} was committed, but its search index could not be synchronized", event.id(), ex);
        }
    }

}
