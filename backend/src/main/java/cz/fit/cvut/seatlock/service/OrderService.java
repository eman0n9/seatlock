package cz.fit.cvut.seatlock.service;

import cz.fit.cvut.seatlock.domain.*;
import cz.fit.cvut.seatlock.domain.enums.OrderStatus;
import cz.fit.cvut.seatlock.domain.enums.TicketStatus;
import cz.fit.cvut.seatlock.domain.enums.TicketType;
import cz.fit.cvut.seatlock.dto.CheckoutResponse;
import cz.fit.cvut.seatlock.dto.OrderDTO;
import cz.fit.cvut.seatlock.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class OrderService {
    private final OrderRepository orderRepository;
    private final UserRepository userRepository;
    private final TicketRepository ticketRepository;
    private final OfferRepository offerRepository;
    private final SeatRepository seatRepository;
    private final ActivityRepository activityRepository;

    public List<Order> getOrdersByUserId(UUID userId) {
        return orderRepository.findByUserId(userId);
    }

    public List<Order> getUpcomingOrdersByUserId(UUID userId) {
        return orderRepository.findUpcomingByUserId(userId);
    }

    public List<Order> getPastOrdersByUserId(UUID userId) {
        return orderRepository.findPastByUserId(userId);
    }

    public List<Ticket> getTicketsByOrderId(UUID orderId) {
        return ticketRepository.findByOrderId(orderId);
    }

    public OrderDTO getOrderById(UUID orderId) {
        return orderRepository.findByIdAsDTO(orderId)
                .orElseThrow(() -> new RuntimeException("Order not found"));
    }

    @Transactional
    public CheckoutResponse checkout(UUID userId, UUID activityId, List<UUID> seatIds) {
        if (seatIds == null || seatIds.isEmpty()) {
            throw new RuntimeException("No seats selected for checkout");
        }

        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("User not found"));

        List<Offer> offers = offerRepository.findByActivityId(activityId);
        Map<UUID, Offer> offerBySeatId = new HashMap<>();
        for (Offer offer : offers) {
            for (Seat s : offer.getSeats()) {
                offerBySeatId.put(s.getId(), offer);
            }
        }

        Order order = new Order();
        order.setUser(user);
        order.setStatus(OrderStatus.PAID);
        order.setCreatedAt(LocalDateTime.now());
        
        double totalPrice = 0.0;
        for (UUID seatId : seatIds) {
            Offer offer = offerBySeatId.get(seatId);
            if (offer == null) {
                throw new RuntimeException("No offer found for seat: " + seatId);
            }
            totalPrice += offer.getPrice();
        }
        order.setTotalPrice(totalPrice);
        Order savedOrder = orderRepository.save(order);

        var existingStatuses = ticketRepository.findStatusesByActivityId(activityId);

        for (UUID seatId : seatIds) {
            if (existingStatuses.get(seatId) == TicketStatus.SOLD) {
                throw new RuntimeException("Seat " + seatId + " is already sold");
            }

            Seat seat = seatRepository.findById(seatId)
                    .orElseThrow(() -> new RuntimeException("Seat not found: " + seatId));

            Offer offer = offerBySeatId.get(seatId);
            
            Ticket ticket = new Ticket();
            ticket.setOrder(savedOrder);
            ticket.setSeat(seat);
            ticket.setOffer(offer);
            ticket.setStatus(TicketStatus.SOLD);
            ticketRepository.save(ticket);
        }

        return new CheckoutResponse(activityId, seatIds);
    }
}
