package cz.fit.cvut.seatlock.service;

import cz.fit.cvut.seatlock.repository.ActivityRepository;
import cz.fit.cvut.seatlock.repository.OfferRepository;
import cz.fit.cvut.seatlock.repository.TicketRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class OfferService {
    private final OfferRepository offerRepository;
    private final ActivityRepository activityRepository;
    private final TicketRepository ticketRepository;
}