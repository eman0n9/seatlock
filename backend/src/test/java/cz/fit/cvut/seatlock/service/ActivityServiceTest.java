package cz.fit.cvut.seatlock.service;

import cz.fit.cvut.seatlock.domain.Activity;
import cz.fit.cvut.seatlock.domain.ActivityCategory;
import cz.fit.cvut.seatlock.domain.Hall;
import cz.fit.cvut.seatlock.domain.Seat;
import cz.fit.cvut.seatlock.domain.enums.TicketType;
import cz.fit.cvut.seatlock.dto.ActivityDTO;
import cz.fit.cvut.seatlock.dto.PriceZoneDTO;
import cz.fit.cvut.seatlock.dto.RowOfferInput;
import cz.fit.cvut.seatlock.dto.SetOffersInput;
import cz.fit.cvut.seatlock.dto.TicketTypeInput;
import cz.fit.cvut.seatlock.es_documents.ActivitySearchRepository;
import cz.fit.cvut.seatlock.repository.ActivityCategoryRepository;
import cz.fit.cvut.seatlock.repository.ActivityRepository;
import cz.fit.cvut.seatlock.repository.HallRepository;
import cz.fit.cvut.seatlock.repository.FavoriteRepository;
import cz.fit.cvut.seatlock.repository.OfferRepository;
import cz.fit.cvut.seatlock.repository.PerformerRepository;
import cz.fit.cvut.seatlock.repository.SeatRepository;
import cz.fit.cvut.seatlock.repository.TicketRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.security.access.AccessDeniedException;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ActivityServiceTest {

    @Mock private ActivityRepository activityRepository;
    @Mock private ActivityCategoryRepository activityCategoryRepository;
    @Mock private HallRepository hallRepository;
    @Mock private PerformerRepository performerRepository;
    @Mock private SeatRepository seatRepository;
    @Mock private TicketRepository ticketRepository;
    @Mock private OfferRepository offerRepository;
    @Mock private FavoriteRepository favoriteRepository;
    @Mock private ApplicationEventPublisher eventPublisher;
    @Mock private ActivitySearchRepository activitySearchRepository;

    @InjectMocks
    private ActivityService activityService;

    @Test
    void organizationCannotDeleteAnotherOrganizationsActivity() {
        UUID activityId = UUID.randomUUID();
        Activity activity = new Activity();
        activity.setId(activityId);
        activity.setOwnerId(UUID.randomUUID());
        when(activityRepository.findByIdForUpdate(activityId)).thenReturn(Optional.of(activity));

        assertThrows(
                AccessDeniedException.class,
                () -> activityService.deleteActivity(activityId, UUID.randomUUID(), false)
        );

        verify(activityRepository, never()).delete(activity);
    }

    @Test
    void createRejectsInvalidTimeRangeBeforePersistence() {
        ActivityDTO input = new ActivityDTO(
                "Event",
                LocalDate.now().plusDays(1),
                LocalTime.of(20, 0),
                LocalTime.of(19, 0),
                null,
                UUID.randomUUID(),
                UUID.randomUUID(),
                List.of(),
                List.of()
        );

        assertThrows(IllegalArgumentException.class, () -> activityService.createActivity(input, UUID.randomUUID()));
        verify(activityRepository, never()).save(org.mockito.ArgumentMatchers.any());
    }

    @Test
    void setOffersRejectsDuplicateRowsBeforeReplacingExistingOffers() {
        UUID activityId = UUID.randomUUID();
        UUID ownerId = UUID.randomUUID();
        Activity activity = new Activity();
        activity.setId(activityId);
        activity.setOwnerId(ownerId);
        activity.setHallId(UUID.randomUUID());
        when(activityRepository.findByIdForUpdate(activityId)).thenReturn(Optional.of(activity));
        when(ticketRepository.existsSoldByActivityId(activityId)).thenReturn(false);
        Seat seat = new Seat(1, 1);
        seat.setId(UUID.randomUUID());
        when(seatRepository.findByHallId(activity.getHallId())).thenReturn(List.of(seat));

        SetOffersInput input = new SetOffersInput(
                List.of(new TicketTypeInput("STANDARD", 25.0)),
                List.of(new RowOfferInput(1, "STANDARD"), new RowOfferInput(1, "STANDARD"))
        );

        assertThrows(IllegalArgumentException.class, () -> activityService.setOffers(
                activityId, input, ownerId, false
        ));
        verify(offerRepository, never()).deleteByActivityId(activityId);
    }

    @Test
    void soldActivityCannotBeDeleted() {
        UUID activityId = UUID.randomUUID();
        UUID ownerId = UUID.randomUUID();
        Activity activity = new Activity();
        activity.setId(activityId);
        activity.setOwnerId(ownerId);
        when(activityRepository.findByIdForUpdate(activityId)).thenReturn(Optional.of(activity));
        when(ticketRepository.existsSoldByActivityId(activityId)).thenReturn(true);

        assertThrows(IllegalArgumentException.class, () -> activityService.deleteActivity(
                activityId, ownerId, false
        ));
        verify(favoriteRepository, never()).removeAllForActivity(activityId);
        verify(activityRepository, never()).delete(activity);
    }

    @Test
    void createRejectsPriceZonesThatDoNotCoverEveryHallSeat() {
        UUID hallId = UUID.randomUUID();
        UUID categoryId = UUID.randomUUID();
        UUID offeredSeatId = UUID.randomUUID();
        Hall hall = new Hall();
        hall.setId(hallId);
        ActivityCategory category = new ActivityCategory();
        category.setId(categoryId);
        Seat offeredSeat = new Seat(1, 1);
        offeredSeat.setId(offeredSeatId);
        Seat missingSeat = new Seat(1, 2);
        missingSeat.setId(UUID.randomUUID());
        ActivityDTO input = new ActivityDTO(
                "Event",
                LocalDate.now().plusDays(1),
                LocalTime.of(18, 0),
                LocalTime.of(20, 0),
                null,
                categoryId,
                hallId,
                List.of(),
                List.of(new PriceZoneDTO(TicketType.STANDARD, 25.0, List.of(offeredSeatId)))
        );

        when(activityRepository.findByName("Event")).thenReturn(Optional.empty());
        when(hallRepository.findById(hallId)).thenReturn(Optional.of(hall));
        when(activityCategoryRepository.findById(categoryId)).thenReturn(Optional.of(category));
        when(activityRepository.availableTimeForActivity(
                hallId, input.date(), input.startTime(), input.endTime(), null
        )).thenReturn(true);
        when(activityRepository.save(any(Activity.class))).thenAnswer(invocation -> {
            Activity saved = invocation.getArgument(0);
            saved.setId(UUID.randomUUID());
            saved.setHallId(hallId);
            return saved;
        });
        when(seatRepository.findByHallId(hallId)).thenReturn(List.of(offeredSeat, missingSeat));
        when(seatRepository.findAllByIdsAndHallId(List.of(offeredSeatId), hallId))
                .thenReturn(List.of(offeredSeat));

        IllegalArgumentException error = assertThrows(
                IllegalArgumentException.class,
                () -> activityService.createActivity(input, UUID.randomUUID())
        );

        assertEquals(
                "Every seat in the activity hall must belong to exactly one price zone",
                error.getMessage()
        );
        verify(offerRepository, never()).save(any());
    }

    @Test
    void setOffersRejectsMissingHallRowsBeforeReplacingOffers() {
        UUID activityId = UUID.randomUUID();
        UUID ownerId = UUID.randomUUID();
        UUID hallId = UUID.randomUUID();
        Activity activity = new Activity();
        activity.setId(activityId);
        activity.setOwnerId(ownerId);
        activity.setHallId(hallId);
        Seat firstRowSeat = new Seat(1, 1);
        firstRowSeat.setId(UUID.randomUUID());
        Seat secondRowSeat = new Seat(2, 1);
        secondRowSeat.setId(UUID.randomUUID());
        when(activityRepository.findByIdForUpdate(activityId)).thenReturn(Optional.of(activity));
        when(ticketRepository.existsSoldByActivityId(activityId)).thenReturn(false);
        when(seatRepository.findByHallId(hallId)).thenReturn(List.of(firstRowSeat, secondRowSeat));
        SetOffersInput input = new SetOffersInput(
                List.of(new TicketTypeInput("STANDARD", 25.0)),
                List.of(new RowOfferInput(1, "STANDARD"))
        );

        IllegalArgumentException error = assertThrows(
                IllegalArgumentException.class,
                () -> activityService.setOffers(activityId, input, ownerId, false)
        );

        assertEquals("Every row in the activity hall must have an offer", error.getMessage());
        verify(offerRepository, never()).deleteByActivityId(activityId);
    }
}
