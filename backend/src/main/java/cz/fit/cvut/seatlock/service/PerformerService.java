package cz.fit.cvut.seatlock.service;

import cz.fit.cvut.seatlock.domain.Performer;
import cz.fit.cvut.seatlock.dto.PerformerDTO;
import cz.fit.cvut.seatlock.dto.PerformerPage;
import cz.fit.cvut.seatlock.es_documents.PerformerDocument;
import cz.fit.cvut.seatlock.es_documents.PerformerSearchRepository;
import cz.fit.cvut.seatlock.events.PerformerEventDTO;
import cz.fit.cvut.seatlock.repository.ActivityRepository;
import cz.fit.cvut.seatlock.repository.FavoriteRepository;
import cz.fit.cvut.seatlock.repository.PerformerRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.util.ArrayList;
import java.util.List;

import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class PerformerService {
    private final PerformerRepository performerRepository;
    private final ActivityRepository activityRepository;
    private final FavoriteRepository favoriteRepository;
    private final ApplicationEventPublisher eventPublisher;
    private final PerformerSearchRepository performerSearchRepository;

    @Transactional
    public Boolean createPerformer(PerformerDTO input) {
        if (input == null || input.name() == null || input.name().isBlank()) {
            throw new IllegalArgumentException("Performer name is required");
        }
        String name = input.name().trim();
        if (performerRepository.findByName(name).isPresent()) {
            throw new IllegalArgumentException("Performer with this name already exists");
        }
        Performer performer = new Performer(name, normalizeOptionalText(input.description()));
        Performer saved = performerRepository.save(performer);

        eventPublisher.publishEvent(new PerformerEventDTO(
                saved.getId(),
                saved.getName()
        ));
        return true;
    }

    @Transactional
    public Boolean updatePerformer(PerformerDTO dto, UUID id) {
        if (dto == null) {
            throw new IllegalArgumentException("Performer input is required");
        }
        Performer performerToUpdate = performerRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Performer not found"));

        if(dto.name() != null){
            if (dto.name().isBlank()) {
                throw new IllegalArgumentException("Performer name is required");
            }
            String name = dto.name().trim();
            performerRepository.findByName(name).ifPresent(found -> {
                if (!found.getId().equals(id)) {
                    throw new IllegalArgumentException("Performer with this name already exists");
                }
            });
            performerToUpdate.setName(name);
        }

        if(dto.description() != null){
            performerToUpdate.setDescription(normalizeOptionalText(dto.description()));
        }

        performerRepository.save(performerToUpdate);

        eventPublisher.publishEvent(new PerformerEventDTO(
                id,
                performerToUpdate.getName()
        ));
        return true;
    }

    @Transactional
    public Boolean deletePerformer(UUID id) {
        Performer performerToDelete = performerRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Performer not found"));
        favoriteRepository.removeAllForPerformer(id);
        activityRepository.deletePerformerFromActivities(id);
        performerRepository.delete(performerToDelete);
        afterCommit(() -> performerSearchRepository.deleteById(id.toString()));
        return true;
    }

    public PerformerPage getAllPerformers(int page, int size) {
        if (page < 0 || size < 1 || size > 100) {
            throw new IllegalArgumentException("page must be non-negative and size must be between 1 and 100");
        }
        long total = performerRepository.count();
        List<Performer> content = performerRepository.findAll(page, size);
        int totalPages = (int) Math.ceil((double) total / size);
        return new PerformerPage(content, total, totalPages, page);
    }

    public Performer getPerformerById(UUID id) {
        return performerRepository.findById(id).orElseThrow(() -> new RuntimeException("Performer not found"));
    }

    public List<Performer> search(String text){
        List<PerformerDocument> docs = performerSearchRepository.findByName(text);

        List<UUID> ids = docs.stream().map(doc -> UUID.fromString(doc.getId())).toList();

        if(ids.isEmpty()) return new ArrayList<>();

        return performerRepository.findAllByIds(ids);
    }

    private String normalizeOptionalText(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    private void afterCommit(Runnable action) {
        if (!TransactionSynchronizationManager.isSynchronizationActive()) {
            runSearchSync(action);
            return;
        }
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override
            public void afterCommit() {
                runSearchSync(action);
            }
        });
    }

    private void runSearchSync(Runnable action) {
        try {
            action.run();
        } catch (RuntimeException ex) {
            log.error("Committed performer change could not be synchronized to the search index", ex);
        }
    }
}
