package cz.fit.cvut.seatlock.service;

import cz.fit.cvut.seatlock.domain.*;
import cz.fit.cvut.seatlock.domain.enums.OrderStatus;
import cz.fit.cvut.seatlock.domain.enums.TicketStatus;
import cz.fit.cvut.seatlock.dto.CheckoutResponse;
import cz.fit.cvut.seatlock.dto.OrderDTO;
import cz.fit.cvut.seatlock.repository.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.jooq.exception.IntegrityConstraintViolationException;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.script.DefaultRedisScript;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class OrderService {
    private static final int MAX_SEATS_PER_ORDER = 10;
    private static final String SEAT_LIMIT_ERROR = "A maximum of 10 seats is allowed per order";
    private static final int REDIS_SYNC_ATTEMPTS = 3;
    private static final DefaultRedisScript<Long> RELEASE_RESERVATIONS_SCRIPT = new DefaultRedisScript<>("""
            local expectedOwner = ARGV[2]
            local released = {}
            for i = 3, #ARGV do
                local seatId = ARGV[i]
                local seatKey = 'seat:' .. ARGV[1] .. ':' .. seatId
                if redis.call('GET', seatKey) == expectedOwner then
                    redis.call('DEL', seatKey)
                    redis.call('SREM', KEYS[2], seatId)
                    table.insert(released, seatId)
                end
                redis.call('SREM', KEYS[1], seatId)
            end
            if redis.call('SCARD', KEYS[1]) == 0 then
                redis.call('DEL', KEYS[1])
            end
            if #released > 0 then
                redis.call('PUBLISH', 'seatlock:releases:' .. ARGV[1], table.concat(released, ','))
            end
            return #released
            """, Long.class);
    private final OrderRepository orderRepository;
    private final UserRepository userRepository;
    private final TicketRepository ticketRepository;
    private final OfferRepository offerRepository;
    private final SeatRepository seatRepository;
    private final ActivityRepository activityRepository;
    private final StringRedisTemplate redisTemplate;

    public List<OrderDTO> getOrdersByUserId(UUID userId) {
        return loadOrderDTOs(orderRepository.findByUserId(userId));
    }

    public List<OrderDTO> getUpcomingOrdersByUserId(UUID userId) {
        return loadOrderDTOs(orderRepository.findUpcomingByUserId(userId));
    }

    public List<OrderDTO> getPastOrdersByUserId(UUID userId) {
        return loadOrderDTOs(orderRepository.findPastByUserId(userId));
    }

    public List<Ticket> getTicketsByOrderId(UUID orderId) {
        return ticketRepository.findByOrderId(orderId);
    }

    public OrderDTO getOrderById(UUID orderId, UUID userId, boolean admin) {
        Order order = orderRepository.findById(orderId)
                .orElseThrow(() -> new IllegalArgumentException("Order not found"));
        if (!admin && !userId.equals(order.getUser().getId())) {
            throw new AccessDeniedException("Order does not belong to the current user");
        }
        return orderRepository.findByIdAsDTO(orderId)
                .orElseThrow(() -> new IllegalArgumentException("Order not found"));
    }

    @Transactional
    public CheckoutResponse checkout(UUID userId, UUID activityId, List<UUID> seatIds) {
        if (seatIds == null || seatIds.isEmpty()) {
            throw new IllegalArgumentException("No seats selected for checkout");
        }
        if (seatIds.size() > MAX_SEATS_PER_ORDER) {
            throw new IllegalArgumentException(SEAT_LIMIT_ERROR);
        }
        if (new HashSet<>(seatIds).size() != seatIds.size()) {
            throw new IllegalArgumentException("Duplicate seats are not allowed");
        }

        User user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));

        activityRepository.findByIdForUpdate(activityId)
                .orElseThrow(() -> new IllegalArgumentException("Activity not found"));

        List<Offer> offers = offerRepository.findByActivityId(activityId);
        Map<UUID, Offer> offerBySeatId = new HashMap<>();
        for (Offer offer : offers) {
            for (Seat s : offer.getSeats()) {
                offerBySeatId.put(s.getId(), offer);
            }
        }

        double totalPrice = 0.0;
        for (UUID seatId : seatIds) {
            Offer offer = offerBySeatId.get(seatId);
            if (offer == null) {
                throw new IllegalArgumentException("No offer found for seat: " + seatId);
            }
            totalPrice += offer.getPrice();
        }

        var existingStatuses = ticketRepository.findStatusesByActivityId(activityId);
        Map<UUID, Seat> seatById = new HashMap<>();
        for (UUID seatId : seatIds) {
            if (existingStatuses.get(seatId) == TicketStatus.SOLD) {
                throw new IllegalArgumentException("Seat " + seatId + " is already sold");
            }
            Seat seat = seatRepository.findById(seatId)
                    .orElseThrow(() -> new IllegalArgumentException("Seat not found: " + seatId));
            seatById.put(seatId, seat);
        }

        validateReservations(userId, activityId, seatIds);

        Order order = new Order();
        order.setUser(user);
        order.setStatus(OrderStatus.PAID);
        order.setCreatedAt(LocalDateTime.now());
        order.setTotalPrice(totalPrice);
        Order savedOrder = orderRepository.save(order);

        try {
            for (UUID seatId : seatIds) {
                Ticket ticket = new Ticket();
                ticket.setOrder(savedOrder);
                ticket.setSeat(seatById.get(seatId));
                ticket.setOffer(offerBySeatId.get(seatId));
                ticket.setActivityId(activityId);
                ticket.setStatus(TicketStatus.SOLD);
                ticketRepository.save(ticket);
            }
        } catch (DataIntegrityViolationException | IntegrityConstraintViolationException ex) {
            throw new IllegalArgumentException("One or more seats are already sold", ex);
        }

        synchronizeRedisAfterCommit(activityId, seatIds);
        return new CheckoutResponse(savedOrder.getId(), activityId, List.copyOf(seatIds), savedOrder.getTotalPrice());
    }

    public Boolean releaseReservations(UUID userId, UUID activityId, List<UUID> seatIds) {
        if (seatIds == null || seatIds.isEmpty()) {
            return true;
        }
        if (seatIds.size() > MAX_SEATS_PER_ORDER) {
            throw new IllegalArgumentException(SEAT_LIMIT_ERROR);
        }
        if (seatIds.stream().anyMatch(java.util.Objects::isNull)) {
            throw new IllegalArgumentException("Seat IDs must not be null");
        }

        List<UUID> distinctSeatIds = seatIds.stream().distinct().toList();
        List<String> keys = List.of(
                "user_reservations:" + activityId + ":" + userId,
                "event_seats:" + activityId
        );
        Object[] arguments = new Object[distinctSeatIds.size() + 2];
        arguments[0] = activityId.toString();
        arguments[1] = "reserved:" + userId;
        for (int i = 0; i < distinctSeatIds.size(); i++) {
            arguments[i + 2] = distinctSeatIds.get(i).toString();
        }
        redisTemplate.execute(RELEASE_RESERVATIONS_SCRIPT, keys, arguments);
        return true;
    }

    private void validateReservations(UUID userId, UUID activityId, List<UUID> seatIds) {
        String expectedOwner = "reserved:" + userId;
        for (UUID seatId : seatIds) {
            String key = "seat:" + activityId + ":" + seatId;
            if (!expectedOwner.equals(redisTemplate.opsForValue().get(key))) {
                throw new IllegalArgumentException("Seat " + seatId + " is not reserved by the current user");
            }
        }
    }

    private List<OrderDTO> loadOrderDTOs(List<Order> orders) {
        return orderRepository.findByIdsAsDTO(
                orders.stream().map(Order::getId).toList()
        );
    }

    private void synchronizeRedisAfterCommit(UUID activityId, List<UUID> seatIds) {
        List<UUID> purchasedSeatIds = List.copyOf(seatIds);
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override
            public void afterCommit() {
                for (int attempt = 1; attempt <= REDIS_SYNC_ATTEMPTS; attempt++) {
                    try {
                        for (UUID seatId : purchasedSeatIds) {
                            redisTemplate.opsForValue().set("seat:" + activityId + ":" + seatId, "purchased");
                        }
                        redisTemplate.convertAndSend(
                                "seatlock:purchases:" + activityId,
                                purchasedSeatIds.stream().map(UUID::toString).collect(Collectors.joining(","))
                        );
                        return;
                    } catch (RuntimeException ex) {
                        if (attempt == REDIS_SYNC_ATTEMPTS) {
                            log.error("Order committed, but purchased seats could not be synchronized to Redis after {} attempts",
                                    REDIS_SYNC_ATTEMPTS, ex);
                        } else {
                            log.warn("Redis purchase synchronization attempt {} failed; retrying", attempt);
                        }
                    }
                }
            }
        });
    }
}
