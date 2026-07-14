package cz.fit.cvut.seatlock.service;

import com.seatlock.grpc.seats.GetPurchasedSeatsRequest;
import com.seatlock.grpc.seats.GetPurchasedSeatsResponse;
import com.seatlock.grpc.seats.SeatServiceGrpc;
import cz.fit.cvut.seatlock.repository.TicketRepository;
import io.grpc.Status;
import io.grpc.stub.StreamObserver;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class SeatGrpcService extends SeatServiceGrpc.SeatServiceImplBase {

    private final TicketRepository ticketRepository;

    @Override
    public void getPurchasedSeats(GetPurchasedSeatsRequest request, StreamObserver<GetPurchasedSeatsResponse> responseObserver) {
        String eventIdStr = request.getEventId();
        log.info("Received GetPurchasedSeats request for eventId: {}", eventIdStr);

        try {
            UUID activityId = UUID.fromString(eventIdStr);
            List<UUID> purchasedSeatIds = ticketRepository.findPurchasedSeatIdsByActivityId(activityId);

            List<String> seatIds = purchasedSeatIds.stream()
                    .map(UUID::toString)
                    .collect(Collectors.toList());

            GetPurchasedSeatsResponse response = GetPurchasedSeatsResponse.newBuilder()
                    .addAllSeatIds(seatIds)
                    .build();

            responseObserver.onNext(response);
            responseObserver.onCompleted();
            log.info("Successfully returned {} purchased seats for eventId: {}", seatIds.size(), eventIdStr);

        } catch (IllegalArgumentException e) {
            log.error("Invalid UUID format for eventId: {}", eventIdStr);
            responseObserver.onError(Status.INVALID_ARGUMENT
                    .withDescription("Invalid event_id format: " + eventIdStr)
                    .asRuntimeException());
        } catch (Exception e) {
            log.error("Error fetching purchased seats for eventId: {}", eventIdStr, e);
            responseObserver.onError(Status.INTERNAL
                    .withDescription("Internal server error occurred")
                    .asRuntimeException());
        }
    }
}
