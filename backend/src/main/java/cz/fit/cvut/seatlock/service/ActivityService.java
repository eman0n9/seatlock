package cz.fit.cvut.seatlock.service;

import cz.fit.cvut.seatlock.domain.Activity;
import cz.fit.cvut.seatlock.domain.ActivityCategory;
import cz.fit.cvut.seatlock.domain.Hall;
import cz.fit.cvut.seatlock.domain.Offer;
import cz.fit.cvut.seatlock.domain.Performer;
import cz.fit.cvut.seatlock.domain.Seat;
import cz.fit.cvut.seatlock.domain.enums.TicketType;
import cz.fit.cvut.seatlock.dto.ActivityDTO;
import cz.fit.cvut.seatlock.dto.ActivityPage;
import cz.fit.cvut.seatlock.dto.PriceZoneDTO;
import cz.fit.cvut.seatlock.dto.PriceZoneInfo;
import cz.fit.cvut.seatlock.dto.RowOfferInput;
import cz.fit.cvut.seatlock.dto.SearchInputDTO;
import cz.fit.cvut.seatlock.dto.SeatMapResponse;
import cz.fit.cvut.seatlock.dto.SeatMapRow;
import cz.fit.cvut.seatlock.dto.SeatMapTicket;
import cz.fit.cvut.seatlock.dto.SetOffersInput;
import cz.fit.cvut.seatlock.dto.TicketTypeInput;
import cz.fit.cvut.seatlock.es_documents.ActivityDocument;
import cz.fit.cvut.seatlock.es_documents.ActivitySearchRepository;
import cz.fit.cvut.seatlock.events.ActivityEventDTO;
import cz.fit.cvut.seatlock.repository.ActivityCategoryRepository;
import cz.fit.cvut.seatlock.repository.ActivityRepository;
import cz.fit.cvut.seatlock.repository.FavoriteRepository;
import cz.fit.cvut.seatlock.repository.HallRepository;
import cz.fit.cvut.seatlock.repository.OfferRepository;
import cz.fit.cvut.seatlock.repository.PerformerRepository;
import cz.fit.cvut.seatlock.repository.SeatRepository;
import cz.fit.cvut.seatlock.repository.TicketRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.jooq.exception.IntegrityConstraintViolationException;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class ActivityService {
    private final ActivityRepository activityRepository;
    private final ActivityCategoryRepository activityCategoryRepository;
    private final HallRepository hallRepository;
    private final PerformerRepository performerRepository;
    private final SeatRepository seatRepository;
    private final TicketRepository ticketRepository;
    private final OfferRepository offerRepository;
    private final FavoriteRepository favoriteRepository;
    private final ApplicationEventPublisher eventPublisher;
    private final ActivitySearchRepository activitySearchRepository;

    @Transactional
    public Boolean createActivity(ActivityDTO dto, UUID ownerId) {
        validateCreateInput(dto);
        String name = dto.name().trim();
        if (activityRepository.findByName(name).isPresent()) {
            throw new IllegalArgumentException("Activity with this name already exists");
        }

        Hall hall = hallRepository.findById(dto.hallId())
                .orElseThrow(() -> new IllegalArgumentException("Hall not found"));
        ActivityCategory category = activityCategoryRepository.findById(dto.categoryId())
                .orElseThrow(() -> new IllegalArgumentException("Activity category not found"));
        if (!activityRepository.availableTimeForActivity(
                dto.hallId(), dto.date(), dto.startTime(), dto.endTime(), null)) {
            throw new IllegalArgumentException("Hall is not available at this time");
        }

        List<Performer> performers = loadPerformers(dto.performer());
        Activity activity = new Activity(
                name,
                dto.date(),
                dto.startTime(),
                dto.endTime(),
                normalizeOptionalText(dto.description()),
                category,
                hall,
                performers
        );
        activity.setOwnerId(ownerId);
        Activity saved = saveWithScheduleConflictMapping(activity);

        saveInitialOffers(saved, dto.priceZones());
        if (!performers.isEmpty()) {
            activityRepository.savePerformers(saved.getId(), performers);
        }
        publishActivity(saved, performers);
        return true;
    }

    public ActivityPage getAllActivities(int page, int size) {
        validatePage(page, size);
        long total = activityRepository.count();
        List<Activity> content = activityRepository.findAll(page, size);
        int totalPages = (int) Math.ceil((double) total / size);
        return new ActivityPage(content, total, totalPages, page);
    }

    public Activity getActivityById(UUID id) {
        return activityRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Activity not found"));
    }

    @Transactional
    public Boolean deleteActivity(UUID id, UUID userId, boolean admin) {
        Activity activity = activityRepository.findByIdForUpdate(id)
                .orElseThrow(() -> new IllegalArgumentException("Activity not found"));
        ensureCanManage(activity, userId, admin);
        if (ticketRepository.existsSoldByActivityId(id)) {
            throw new IllegalArgumentException("An activity with sold tickets cannot be deleted");
        }

        favoriteRepository.removeAllForActivity(id);
        offerRepository.deleteByActivityId(id);
        activityRepository.deletePerformers(id);
        activityRepository.delete(activity);
        afterCommit(() -> activitySearchRepository.deleteById(id.toString()));
        return true;
    }

    @Transactional
    public Boolean updateActivity(ActivityDTO dto, UUID id, UUID userId, boolean admin) {
        if (dto == null) {
            throw new IllegalArgumentException("Activity input is required");
        }
        Activity activity = activityRepository.findByIdForUpdate(id)
                .orElseThrow(() -> new IllegalArgumentException("Activity not found"));
        ensureCanManage(activity, userId, admin);

        if (dto.name() != null) {
            String name = requireMeaningful(dto.name(), "Activity name");
            activityRepository.findByName(name).ifPresent(found -> {
                if (!found.getId().equals(id)) {
                    throw new IllegalArgumentException("Activity with this name already exists");
                }
            });
        }

        UUID hallId = dto.hallId() != null ? dto.hallId() : activity.getHallId();
        LocalDate date = dto.date() != null ? dto.date() : activity.getDate();
        LocalTime startTime = dto.startTime() != null ? dto.startTime() : activity.getStartTime();
        LocalTime endTime = dto.endTime() != null ? dto.endTime() : activity.getEndTime();
        validateTimeRange(startTime, endTime);

        if (!hallId.equals(activity.getHallId())
                && (offerRepository.existsByActivityId(id) || ticketRepository.existsSoldByActivityId(id))) {
            throw new IllegalArgumentException("The hall cannot be changed after offers have been configured");
        }
        if (!activityRepository.availableTimeForActivity(hallId, date, startTime, endTime, id)) {
            throw new IllegalArgumentException("Hall is not available at this time");
        }

        Hall hall = hallRepository.findById(hallId)
                .orElseThrow(() -> new IllegalArgumentException("Hall not found"));
        UUID categoryId = dto.categoryId() != null ? dto.categoryId() : activity.getActivityCategoryId();
        ActivityCategory category = activityCategoryRepository.findById(categoryId)
                .orElseThrow(() -> new IllegalArgumentException("Category not found"));

        if (dto.name() != null) activity.setName(dto.name().trim());
        if (dto.date() != null) activity.setDate(dto.date());
        if (dto.startTime() != null) activity.setStartTime(dto.startTime());
        if (dto.endTime() != null) activity.setEndTime(dto.endTime());
        if (dto.description() != null) activity.setDescription(normalizeOptionalText(dto.description()));
        activity.setHall(hall);
        activity.setCategory(category);

        List<Performer> performers;
        if (dto.performer() != null) {
            performers = loadPerformers(dto.performer());
            activityRepository.deletePerformers(id);
            if (!performers.isEmpty()) {
                activityRepository.savePerformers(id, performers);
            }
        } else {
            performers = performerRepository.findAllByIds(
                    activityRepository.findPerformerIdsByActivityId(id)
            );
        }

        Activity saved = saveWithScheduleConflictMapping(activity);
        publishActivity(saved, performers);
        return true;
    }

    public SeatMapResponse getSeatMap(UUID activityId) {
        Activity activity = activityRepository.findById(activityId)
                .orElseThrow(() -> new IllegalArgumentException("Activity not found"));
        List<Seat> seats = seatRepository.findByHallId(activity.getHallId());
        List<Offer> offers = offerRepository.findByActivityId(activityId);
        List<PriceZoneInfo> priceZones = offers.stream()
                .map(offer -> new PriceZoneInfo(offer.getType(), offer.getPrice()))
                .toList();

        Map<UUID, Offer> offerBySeatId = new HashMap<>();
        for (Offer offer : offers) {
            for (Seat seat : offer.getSeats()) {
                offerBySeatId.put(seat.getId(), offer);
            }
        }

        Map<Integer, List<SeatMapTicket>> ticketsByRow = new LinkedHashMap<>();
        for (Seat seat : seats) {
            Offer offer = offerBySeatId.get(seat.getId());
            TicketType type = offer != null ? offer.getType() : TicketType.STANDARD;
            SeatMapTicket ticket = new SeatMapTicket(
                    seat.getId(), seat.getSeatNumber(), seat.getRowNumber(), type
            );
            ticketsByRow.computeIfAbsent(seat.getRowNumber(), ignored -> new ArrayList<>()).add(ticket);
        }
        List<SeatMapRow> rows = ticketsByRow.entrySet().stream()
                .map(entry -> new SeatMapRow(entry.getKey(), entry.getValue()))
                .toList();
        return new SeatMapResponse(rows, priceZones);
    }

    @Transactional
    public Boolean setOffers(UUID activityId, SetOffersInput input, UUID userId, boolean admin) {
        Activity activity = activityRepository.findByIdForUpdate(activityId)
                .orElseThrow(() -> new IllegalArgumentException("Activity not found"));
        ensureCanManage(activity, userId, admin);
        if (ticketRepository.existsSoldByActivityId(activityId)) {
            throw new IllegalArgumentException("Offers cannot be changed after tickets have been sold");
        }
        if (input == null || input.types() == null || input.types().isEmpty()) {
            throw new IllegalArgumentException("At least one ticket type is required");
        }
        if (input.offers() == null || input.offers().isEmpty()) {
            throw new IllegalArgumentException("At least one row offer is required");
        }

        Map<TicketType, Offer> offerByType = new LinkedHashMap<>();
        for (TicketTypeInput typeInput : input.types()) {
            TicketType ticketType = parseTicketType(typeInput == null ? null : typeInput.name());
            validatePrice(typeInput.price());
            if (offerByType.containsKey(ticketType)) {
                throw new IllegalArgumentException("Duplicate ticket type: " + ticketType.name());
            }
            Offer offer = new Offer();
            offer.setActivity(activity);
            offer.setType(ticketType);
            offer.setPrice(typeInput.price());
            offerByType.put(ticketType, offer);
        }

        List<Seat> allSeats = seatRepository.findByHallId(activity.getHallId());
        Map<Integer, List<Seat>> seatsByRow = new HashMap<>();
        for (Seat seat : allSeats) {
            seatsByRow.computeIfAbsent(seat.getRowNumber(), ignored -> new ArrayList<>()).add(seat);
        }

        Set<Integer> assignedRows = new HashSet<>();
        for (RowOfferInput rowOffer : input.offers()) {
            if (rowOffer == null || rowOffer.row() == null) {
                throw new IllegalArgumentException("Row number is required");
            }
            if (!assignedRows.add(rowOffer.row())) {
                throw new IllegalArgumentException("Duplicate row: " + rowOffer.row());
            }
            List<Seat> rowSeats = seatsByRow.get(rowOffer.row());
            if (rowSeats == null || rowSeats.isEmpty()) {
                throw new IllegalArgumentException("Row not found in the activity hall: " + rowOffer.row());
            }
            TicketType ticketType = parseTicketType(rowOffer.typeName());
            Offer offer = offerByType.get(ticketType);
            if (offer == null) {
                throw new IllegalArgumentException("Ticket type is not configured: " + ticketType.name());
            }
            offer.getSeats().addAll(rowSeats);
        }
        if (assignedRows.size() != seatsByRow.size()) {
            throw new IllegalArgumentException("Every row in the activity hall must have an offer");
        }
        for (Map.Entry<TicketType, Offer> entry : offerByType.entrySet()) {
            if (entry.getValue().getSeats().isEmpty()) {
                throw new IllegalArgumentException(
                        "Ticket type is not assigned to any row: " + entry.getKey().name()
                );
            }
        }

        offerRepository.deleteByActivityId(activityId);
        offerByType.values().forEach(offerRepository::save);
        return true;
    }

    public List<String> getCities() {
        return activityRepository.findDistinctCities();
    }

    public List<Activity> search(SearchInputDTO dto) {
        if (dto.text() == null || dto.text().isBlank()) {
            return activityRepository.findWithFilters(
                    null, dto.date(), dto.dateFrom(), dto.dateTo(), dto.startTime(), dto.category(), dto.city()
            );
        }
        List<ActivityDocument> documents = activitySearchRepository.searchByTextWithPerformers(dto.text());
        List<UUID> ids = documents.stream().map(document -> UUID.fromString(document.getId())).toList();
        if (ids.isEmpty()) {
            return new ArrayList<>();
        }
        return activityRepository.findWithFilters(
                ids, dto.date(), dto.dateFrom(), dto.dateTo(), dto.startTime(), dto.category(), dto.city()
        );
    }

    private void validateCreateInput(ActivityDTO dto) {
        if (dto == null) {
            throw new IllegalArgumentException("Activity input is required");
        }
        requireMeaningful(dto.name(), "Activity name");
        if (dto.date() == null || dto.hallId() == null || dto.categoryId() == null) {
            throw new IllegalArgumentException("Date, hall and category are required");
        }
        validateTimeRange(dto.startTime(), dto.endTime());
        if (dto.priceZones() == null || dto.priceZones().isEmpty()) {
            throw new IllegalArgumentException("At least one price zone is required");
        }
    }

    private void validateTimeRange(LocalTime startTime, LocalTime endTime) {
        if (startTime == null || endTime == null) {
            throw new IllegalArgumentException("Start and end time are required");
        }
        if (!endTime.isAfter(startTime)) {
            throw new IllegalArgumentException("End time must be after start time");
        }
    }

    private String requireMeaningful(String value, String fieldName) {
        if (value == null || value.isBlank()) {
            throw new IllegalArgumentException(fieldName + " is required");
        }
        return value.trim();
    }

    private String normalizeOptionalText(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    private List<Performer> loadPerformers(List<UUID> performerIds) {
        if (performerIds == null || performerIds.isEmpty()) {
            return new ArrayList<>();
        }
        if (performerIds.stream().anyMatch(Objects::isNull)) {
            throw new IllegalArgumentException("Performer IDs must not be null");
        }
        List<UUID> distinctIds = performerIds.stream().distinct().toList();
        if (distinctIds.size() != performerIds.size()) {
            throw new IllegalArgumentException("Duplicate performer IDs are not allowed");
        }
        List<Performer> performers = performerRepository.findAllByIds(distinctIds);
        if (performers.size() != distinctIds.size()) {
            throw new IllegalArgumentException("One or more performers were not found");
        }
        return performers;
    }

    private void saveInitialOffers(Activity activity, List<PriceZoneDTO> priceZones) {
        Set<TicketType> types = new HashSet<>();
        Set<UUID> assignedSeatIds = new HashSet<>();
        Map<PriceZoneDTO, List<Seat>> seatsByZone = new LinkedHashMap<>();
        List<Seat> hallSeats = seatRepository.findByHallId(activity.getHallId());

        for (PriceZoneDTO zone : priceZones) {
            if (zone == null || zone.ticketType() == null) {
                throw new IllegalArgumentException("Ticket type is required for every price zone");
            }
            if (!types.add(zone.ticketType())) {
                throw new IllegalArgumentException("Duplicate ticket type: " + zone.ticketType().name());
            }
            validatePrice(zone.price());
            if (zone.seatIds() == null || zone.seatIds().isEmpty()
                    || zone.seatIds().stream().anyMatch(Objects::isNull)) {
                throw new IllegalArgumentException("Every price zone must contain seats");
            }
            List<UUID> distinctSeatIds = zone.seatIds().stream().distinct().toList();
            if (distinctSeatIds.size() != zone.seatIds().size()) {
                throw new IllegalArgumentException("Duplicate seat IDs are not allowed");
            }
            for (UUID seatId : distinctSeatIds) {
                if (!assignedSeatIds.add(seatId)) {
                    throw new IllegalArgumentException("A seat can belong to only one price zone");
                }
            }
            List<Seat> seats = seatRepository.findAllByIdsAndHallId(
                    distinctSeatIds, activity.getHallId()
            );
            if (seats.size() != distinctSeatIds.size()) {
                throw new IllegalArgumentException("One or more seats were not found in the activity hall");
            }
            seatsByZone.put(zone, seats);
        }

        if (assignedSeatIds.size() != hallSeats.size()) {
            throw new IllegalArgumentException(
                    "Every seat in the activity hall must belong to exactly one price zone"
            );
        }

        for (Map.Entry<PriceZoneDTO, List<Seat>> entry : seatsByZone.entrySet()) {
            Offer offer = new Offer();
            offer.setActivity(activity);
            offer.setPrice(entry.getKey().price());
            offer.setType(entry.getKey().ticketType());
            offer.setSeats(entry.getValue());
            offerRepository.save(offer);
        }
    }

    private TicketType parseTicketType(String value) {
        String normalized = requireMeaningful(value, "Ticket type").toUpperCase(Locale.ROOT);
        try {
            return TicketType.valueOf(normalized);
        } catch (IllegalArgumentException ex) {
            throw new IllegalArgumentException("Unknown ticket type: " + value);
        }
    }

    private void validatePrice(Double price) {
        if (price == null || !Double.isFinite(price) || price <= 0) {
            throw new IllegalArgumentException("Price must be greater than zero");
        }
    }

    private Activity saveWithScheduleConflictMapping(Activity activity) {
        try {
            return activityRepository.save(activity);
        } catch (DataIntegrityViolationException | IntegrityConstraintViolationException ex) {
            throw new IllegalArgumentException("Hall is not available at this time", ex);
        }
    }

    private void publishActivity(Activity activity, List<Performer> performers) {
        eventPublisher.publishEvent(new ActivityEventDTO(
                activity.getId(),
                activity.getName(),
                activity.getDescription(),
                performers.stream().map(Performer::getName).toList()
        ));
    }

    private void ensureCanManage(Activity activity, UUID userId, boolean admin) {
        if (!admin && !userId.equals(activity.getOwnerId())) {
            throw new AccessDeniedException("Activity does not belong to the current organization");
        }
    }

    private void validatePage(int page, int size) {
        if (page < 0 || size < 1 || size > 100) {
            throw new IllegalArgumentException(
                    "page must be non-negative and size must be between 1 and 100"
            );
        }
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
            log.error("Committed activity change could not be synchronized to the search index", ex);
        }
    }
}
