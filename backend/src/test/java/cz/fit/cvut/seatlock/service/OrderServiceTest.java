package cz.fit.cvut.seatlock.service;

import cz.fit.cvut.seatlock.domain.Activity;
import cz.fit.cvut.seatlock.domain.Offer;
import cz.fit.cvut.seatlock.domain.Order;
import cz.fit.cvut.seatlock.domain.Seat;
import cz.fit.cvut.seatlock.domain.User;
import cz.fit.cvut.seatlock.dto.OrderDTO;
import cz.fit.cvut.seatlock.dto.CheckoutResponse;
import cz.fit.cvut.seatlock.repository.ActivityRepository;
import cz.fit.cvut.seatlock.repository.OfferRepository;
import cz.fit.cvut.seatlock.repository.OrderRepository;
import cz.fit.cvut.seatlock.repository.SeatRepository;
import cz.fit.cvut.seatlock.repository.TicketRepository;
import cz.fit.cvut.seatlock.repository.UserRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ValueOperations;
import org.springframework.data.redis.core.script.RedisScript;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.transaction.support.TransactionSynchronizationUtils;

import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.AdditionalMatchers.aryEq;

@ExtendWith(MockitoExtension.class)
class OrderServiceTest {

    @Mock private OrderRepository orderRepository;
    @Mock private UserRepository userRepository;
    @Mock private TicketRepository ticketRepository;
    @Mock private OfferRepository offerRepository;
    @Mock private SeatRepository seatRepository;
    @Mock private ActivityRepository activityRepository;
    @Mock private StringRedisTemplate redisTemplate;
    @Mock private ValueOperations<String, String> valueOperations;

    @InjectMocks
    private OrderService orderService;

    @Test
    void duplicateSeatIdsAreRejectedBeforeCheckoutStarts() {
        UUID seatId = UUID.randomUUID();

        assertThrows(
                IllegalArgumentException.class,
                () -> orderService.checkout(UUID.randomUUID(), UUID.randomUUID(), List.of(seatId, seatId))
        );

        verify(userRepository, never()).findById(org.mockito.ArgumentMatchers.any());
    }

    @Test
    void checkoutRejectsMoreThanTenSeatsBeforePersistence() {
        List<UUID> seatIds = java.util.stream.IntStream.range(0, 11)
                .mapToObj(ignored -> UUID.randomUUID())
                .toList();

        IllegalArgumentException error = assertThrows(
                IllegalArgumentException.class,
                () -> orderService.checkout(UUID.randomUUID(), UUID.randomUUID(), seatIds)
        );

        assertEquals("A maximum of 10 seats is allowed per order", error.getMessage());
        verifyNoInteractions(userRepository);
    }

    @Test
    void userCannotReadAnotherUsersOrder() {
        UUID orderId = UUID.randomUUID();
        User owner = new User();
        owner.setId(UUID.randomUUID());
        Order order = new Order();
        order.setUser(owner);
        when(orderRepository.findById(orderId)).thenReturn(Optional.of(order));

        assertThrows(
                AccessDeniedException.class,
                () -> orderService.getOrderById(orderId, UUID.randomUUID(), false)
        );

        verify(orderRepository, never()).findByIdAsDTO(orderId);
    }

    @Test
    void checkoutRequiresReservationOwnedByCurrentUser() {
        UUID userId = UUID.randomUUID();
        UUID activityId = UUID.randomUUID();
        UUID seatId = UUID.randomUUID();

        User user = new User();
        user.setId(userId);
        Seat seat = new Seat();
        seat.setId(seatId);
        Offer offer = new Offer();
        offer.setPrice(10.0);
        offer.setSeats(List.of(seat));

        when(userRepository.findById(userId)).thenReturn(Optional.of(user));
        when(activityRepository.findByIdForUpdate(activityId)).thenReturn(Optional.of(new Activity()));
        when(offerRepository.findByActivityId(activityId)).thenReturn(List.of(offer));
        when(ticketRepository.findStatusesByActivityId(activityId)).thenReturn(Map.of());
        when(seatRepository.findById(seatId)).thenReturn(Optional.of(seat));
        when(redisTemplate.opsForValue()).thenReturn(valueOperations);
        when(valueOperations.get("seat:" + activityId + ":" + seatId))
                .thenReturn("reserved:" + UUID.randomUUID());

        assertThrows(
                IllegalArgumentException.class,
                () -> orderService.checkout(userId, activityId, List.of(seatId))
        );

        verify(orderRepository, never()).save(org.mockito.ArgumentMatchers.any());
    }

    @Test
    void committedCheckoutMarksSeatPurchasedInRedis() {
        UUID userId = UUID.randomUUID();
        UUID activityId = UUID.randomUUID();
        UUID seatId = UUID.randomUUID();
        String seatKey = "seat:" + activityId + ":" + seatId;

        User user = new User();
        user.setId(userId);
        Seat seat = new Seat();
        seat.setId(seatId);
        Offer offer = new Offer();
        offer.setPrice(10.0);
        offer.setSeats(List.of(seat));

        when(userRepository.findById(userId)).thenReturn(Optional.of(user));
        when(activityRepository.findByIdForUpdate(activityId)).thenReturn(Optional.of(new Activity()));
        when(offerRepository.findByActivityId(activityId)).thenReturn(List.of(offer));
        when(ticketRepository.findStatusesByActivityId(activityId)).thenReturn(Map.of());
        when(seatRepository.findById(seatId)).thenReturn(Optional.of(seat));
        when(redisTemplate.opsForValue()).thenReturn(valueOperations);
        when(valueOperations.get(seatKey)).thenReturn("reserved:" + userId);
        when(orderRepository.save(any(Order.class))).thenAnswer(invocation -> invocation.getArgument(0));

        TransactionSynchronizationManager.initSynchronization();
        try {
            orderService.checkout(userId, activityId, List.of(seatId));

            verify(valueOperations, never()).set(seatKey, "purchased");
            TransactionSynchronizationUtils.triggerAfterCommit();
            verify(valueOperations).set(seatKey, "purchased");
            verify(redisTemplate).convertAndSend(
                    "seatlock:purchases:" + activityId,
                    seatId.toString()
            );
        } finally {
            TransactionSynchronizationManager.clearSynchronization();
        }
    }

    @Test
    void checkoutReturnsPersistedOrderIdAndAuthoritativeTotal() {
        UUID userId = UUID.randomUUID();
        UUID activityId = UUID.randomUUID();
        UUID seatId = UUID.randomUUID();
        UUID orderId = UUID.randomUUID();
        User user = new User();
        user.setId(userId);
        Seat seat = new Seat();
        seat.setId(seatId);
        Offer offer = new Offer();
        offer.setPrice(12.5);
        offer.setSeats(List.of(seat));

        when(userRepository.findById(userId)).thenReturn(Optional.of(user));
        when(activityRepository.findByIdForUpdate(activityId)).thenReturn(Optional.of(new Activity()));
        when(offerRepository.findByActivityId(activityId)).thenReturn(List.of(offer));
        when(ticketRepository.findStatusesByActivityId(activityId)).thenReturn(Map.of());
        when(seatRepository.findById(seatId)).thenReturn(Optional.of(seat));
        when(redisTemplate.opsForValue()).thenReturn(valueOperations);
        when(valueOperations.get("seat:" + activityId + ":" + seatId)).thenReturn("reserved:" + userId);
        when(orderRepository.save(any(Order.class))).thenAnswer(invocation -> {
            Order order = invocation.getArgument(0);
            order.setId(orderId);
            return order;
        });

        TransactionSynchronizationManager.initSynchronization();
        try {
            CheckoutResponse response = orderService.checkout(userId, activityId, List.of(seatId));
            assertEquals(orderId, response.orderId());
            assertEquals(12.5, response.totalPrice());
        } finally {
            TransactionSynchronizationManager.clearSynchronization();
        }
    }

    @Test
    void releaseReservationsExecutesOneAtomicOwnerScopedScript() {
        UUID userId = UUID.randomUUID();
        UUID activityId = UUID.randomUUID();
        UUID firstSeatId = UUID.randomUUID();
        UUID secondSeatId = UUID.randomUUID();

        orderService.releaseReservations(
                userId,
                activityId,
                List.of(firstSeatId, firstSeatId, secondSeatId)
        );

        verify(redisTemplate).execute(
                org.mockito.ArgumentMatchers.<RedisScript<Long>>any(),
                eq(List.of(
                        "user_reservations:" + activityId + ":" + userId,
                        "event_seats:" + activityId
                )),
                aryEq(new Object[]{
                        activityId.toString(),
                        "reserved:" + userId,
                        firstSeatId.toString(),
                        secondSeatId.toString()
                })
        );
    }

    @Test
    void releaseReservationsRejectsMoreThanTenSeatsBeforeRedis() {
        List<UUID> seatIds = java.util.stream.IntStream.range(0, 11)
                .mapToObj(ignored -> UUID.randomUUID())
                .toList();

        IllegalArgumentException error = assertThrows(
                IllegalArgumentException.class,
                () -> orderService.releaseReservations(UUID.randomUUID(), UUID.randomUUID(), seatIds)
        );

        assertEquals("A maximum of 10 seats is allowed per order", error.getMessage());
        verifyNoInteractions(redisTemplate);
    }

    @Test
    void orderListUsesCompleteGraphQlDtosInRepositoryOrder() {
        UUID userId = UUID.randomUUID();
        Order first = new Order();
        first.setId(UUID.randomUUID());
        Order second = new Order();
        second.setId(UUID.randomUUID());
        List<UUID> orderIds = List.of(first.getId(), second.getId());
        List<OrderDTO> expected = List.of(
                new OrderDTO(first.getId(), 20.0, "PAID", "2026-01-01", List.of(), null),
                new OrderDTO(second.getId(), 10.0, "PAID", "2026-01-02", List.of(), null)
        );

        when(orderRepository.findByUserId(userId)).thenReturn(List.of(first, second));
        when(orderRepository.findByIdsAsDTO(orderIds)).thenReturn(expected);

        org.junit.jupiter.api.Assertions.assertEquals(expected, orderService.getOrdersByUserId(userId));
        verify(orderRepository).findByIdsAsDTO(orderIds);
    }
}
