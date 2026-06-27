package cz.fit.cvut.seatlock.service;

import cz.fit.cvut.seatlock.domain.*;
import cz.fit.cvut.seatlock.domain.enums.TicketStatus;
import cz.fit.cvut.seatlock.domain.enums.TicketType;
import cz.fit.cvut.seatlock.domain.enums.TicketType;
import cz.fit.cvut.seatlock.dto.*;
import cz.fit.cvut.seatlock.es_documents.ActivityDocument;
import cz.fit.cvut.seatlock.es_documents.ActivitySearchRepository;
import cz.fit.cvut.seatlock.events.ActivityEventDTO;
import cz.fit.cvut.seatlock.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class ActivityService {
    private final ActivityRepository activityRepository;
    private final ActivityCategoryRepository activityCategoryRepository;
    private final HallRepository hallRepository;
    private final PerformerRepository performerRepository;
    private final SeatRepository seatRepository;
    private final TicketRepository ticketRepository;
    private final OfferRepository offerRepository;
    private final ApplicationEventPublisher eventPublisher;
    private final ActivitySearchRepository activitySearchRepository;

    public Boolean createActivity(ActivityDTO dto) {
        if (activityRepository.findByName(dto.name()).isPresent()) {
            throw new RuntimeException("Activity with this name already exists");
        }

        Hall hall = hallRepository.findById(dto.hallId()).orElseThrow(() -> new RuntimeException("Hall not found"));

        ActivityCategory activityCategory = activityCategoryRepository.findById(dto.categoryId()).orElseThrow(() -> new RuntimeException("Activity category not found"));

        if (!activityRepository.availableTimeForActivity(dto.hallId(), dto.date(), dto.startTime(), dto.endTime(), null)) {
            throw new RuntimeException("Hall is not available at this time");
        }

        List<Performer> performers = dto.performer() != null && !dto.performer().isEmpty()
                ? performerRepository.findAllByIds(dto.performer())
                : new ArrayList<>();

        Activity newActivity = new Activity(dto.name(), dto.date(), dto.startTime(), dto.endTime(), dto.description(), activityCategory, hall, performers);
        Activity saved = activityRepository.save(newActivity);

        if (dto.priceZones() != null && !dto.priceZones().isEmpty()) {
            for (PriceZoneDTO zone : dto.priceZones()) {
                Offer offer = new Offer();
                offer.setActivity(saved);
                offer.setPrice(zone.price());
                offer.setType(zone.ticketType());

                if (zone.seatIds() != null && !zone.seatIds().isEmpty()) {
                    List<Seat> zoneSeats = seatRepository.findAllByIds(zone.seatIds());
                    offer.setSeats(zoneSeats);
                }
                offerRepository.save(offer);
            }
        }

        if (!performers.isEmpty()) {
            activityRepository.savePerformers(saved.getId(), performers);
        }

        eventPublisher.publishEvent(new ActivityEventDTO(
                saved.getId(),
                saved.getName(),
                saved.getDescription(),
                performers.stream().map(Performer::getName).toList()
        ));

        return true;
    }

    public ActivityPage getAllActivities(int page, int size) {
        long total = activityRepository.count();
        List<Activity> content = activityRepository.findAll(page, size);
        int totalPages = (int) Math.ceil((double) total / size);
        return new ActivityPage(content, total, totalPages, page);
    }

    public Activity getActivityById(UUID id) {
        return activityRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Activity not found"));
    }

    public Boolean deleteActivity(UUID id) {
        Activity activity = activityRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Activity not found"));
        activityRepository.deletePerformers(id);
        activityRepository.delete(activity);
        activitySearchRepository.deleteById(id.toString());
        return true;
    }

    public Boolean updateActivity(ActivityDTO dto, UUID id) {
        Activity activity = activityRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Activity not found"));

        if (dto.name() != null) {
            activityRepository.findByName(dto.name()).ifPresent(found -> {
                if (!found.getId().equals(id)) {
                    throw new RuntimeException("Activity with this name already exists");
                }
            });
        }

        UUID hallId = dto.hallId() != null ? dto.hallId() : activity.getHallId();
        LocalDate date = dto.date() != null ? dto.date() : activity.getDate();
        LocalTime startTime = dto.startTime() != null ? dto.startTime() : activity.getStartTime();
        LocalTime endTime = dto.endTime() != null ? dto.endTime() : activity.getEndTime();

        if (!activityRepository.availableTimeForActivity(hallId, date, startTime, endTime, id)) {
            throw new RuntimeException("Hall is not available at this time");
        }

        if (dto.name() != null) activity.setName(dto.name());
        if (dto.date() != null) activity.setDate(dto.date());
        if (dto.startTime() != null) activity.setStartTime(dto.startTime());
        if (dto.endTime() != null) activity.setEndTime(dto.endTime());
        if (dto.description() != null) activity.setDescription(dto.description());

        Hall hall = hallRepository.findById(hallId)
                .orElseThrow(() -> new RuntimeException("Hall not found"));
        activity.setHall(hall);

        UUID categoryId = dto.categoryId() != null ? dto.categoryId() : activity.getActivityCategoryId();
        ActivityCategory category = activityCategoryRepository.findById(categoryId)
                .orElseThrow(() -> new RuntimeException("Category not found"));
        activity.setCategory(category);

        List<Performer> performers;
        if (dto.performer() != null) {
            activityRepository.deletePerformers(id);
            performers = dto.performer().isEmpty()
                    ? new ArrayList<>()
                    : performerRepository.findAllByIds(dto.performer());
            if (!performers.isEmpty()) activityRepository.savePerformers(id, performers);
        } else {
            performers = performerRepository.findAllByIds(
                    activityRepository.findPerformerIdsByActivityId(id)
            );
        }

        activityRepository.save(activity);

        eventPublisher.publishEvent(new ActivityEventDTO(
                activity.getId(),
                activity.getName(),
                activity.getDescription(),
                performers.stream().map(Performer::getName).toList()
        ));
        return true;
    }

    public SeatMapResponse getSeatMap(UUID activityId) {
        Activity activity = activityRepository.findById(activityId).orElseThrow(() -> new RuntimeException("Activity not found"));

        List<Seat> seats = seatRepository.findByHallId(activity.getHallId());
        List<Offer> offers = offerRepository.findByActivityId(activityId);

        List<PriceZoneInfo> priceZones = offers.stream()
                .map(o -> new PriceZoneInfo(o.getType(), o.getPrice()))
                .toList();

        Map<UUID, Offer> offerBySeatId = new HashMap<>();
        for (Offer offer : offers) {
            for (Seat s : offer.getSeats()) {
                offerBySeatId.put(s.getId(), offer);
            }
        }

        Map<Integer, List<SeatMapTicket>> ticketsByRow = new LinkedHashMap<>();
        for (Seat seat : seats) {
            Offer offer = offerBySeatId.get(seat.getId());
            TicketType type = offer != null ? offer.getType() : TicketType.STANDARD;

            SeatMapTicket ticket = new SeatMapTicket(seat.getId(), seat.getSeatNumber(), seat.getRowNumber(), type);
            ticketsByRow.computeIfAbsent(seat.getRowNumber(), k -> new ArrayList<>()).add(ticket);
        }

        List<SeatMapRow> rows = ticketsByRow.entrySet().stream()
                .map(entry -> new SeatMapRow(entry.getKey(), entry.getValue()))
                .toList();

        return new SeatMapResponse(rows, priceZones);
    }

    public Boolean setOffers(UUID activityId, SetOffersInput input) {
        Activity activity = activityRepository.findById(activityId)
                .orElseThrow(() -> new RuntimeException("Activity not found"));

        // типы: name -> Offer (пока без seats)
        Map<String, Offer> offerByTypeName = new HashMap<>();
        for (TicketTypeInput t : input.types()) {
            TicketType ticketType = TicketType.valueOf(t.name().toUpperCase());
            Offer offer = new Offer();
            offer.setActivity(activity);
            offer.setType(ticketType);
            offer.setPrice(t.price());
            offerByTypeName.put(t.name().toUpperCase(), offer);
        }

        // загружаем все места зала, группируем по ряду
        List<Seat> allSeats = seatRepository.findByHallId(activity.getHallId());
        Map<Integer, List<Seat>> seatsByRow = new HashMap<>();
        for (Seat seat : allSeats) {
            seatsByRow.computeIfAbsent(seat.getRowNumber(), k -> new ArrayList<>()).add(seat);
        }

        // раскладываем места по офферам
        for (RowOfferInput rowOffer : input.offers()) {
            Offer offer = offerByTypeName.get(rowOffer.typeName().toUpperCase());
            if (offer == null) throw new RuntimeException("Type not found: " + rowOffer.typeName());
            List<Seat> rowSeats = seatsByRow.getOrDefault(rowOffer.row(), List.of());
            offer.getSeats().addAll(rowSeats);
        }

        offerByTypeName.values().forEach(offerRepository::save);
        return true;
    }

    public List<String> getCities() {
        return activityRepository.findDistinctCities();
    }

    public List<Activity> search(SearchInputDTO dto){
        if(dto.text() == null || dto.text().isBlank()){
            return activityRepository.findWithFilters(null, dto.date(), dto.dateFrom(), dto.dateTo(), dto.startTime(), dto.category(), dto.city());
        }
        List<ActivityDocument> docs = activitySearchRepository.searchByTextWithPerformers(dto.text());
        List<UUID> ids = docs.stream().map(doc -> UUID.fromString(doc.getId())).toList();
        if(ids.isEmpty()){
            return new ArrayList<>();
        }else{
            return activityRepository.findWithFilters(ids, dto.date(), dto.dateFrom(), dto.dateTo(), dto.startTime(), dto.category(), dto.city());
        }
    }
}
