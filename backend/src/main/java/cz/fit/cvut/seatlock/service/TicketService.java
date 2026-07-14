package cz.fit.cvut.seatlock.service;

import cz.fit.cvut.seatlock.repository.OfferRepository;
import cz.fit.cvut.seatlock.repository.OrderRepository;
import cz.fit.cvut.seatlock.repository.SeatRepository;
import cz.fit.cvut.seatlock.repository.TicketRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class TicketService {
    private final TicketRepository ticketRepository;
    private final OrderRepository orderRepository;
    private final SeatRepository seatRepository;
    private final OfferRepository offerRepository;
}