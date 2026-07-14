package cz.fit.cvut.seatlock;

import cz.fit.cvut.seatlock.service.OrderService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.test.context.ActiveProfiles;

import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;

@SpringBootTest
@ActiveProfiles("test")
class SeatlockApplicationTests {
    @Autowired private OrderService orderService;
    @Autowired private StringRedisTemplate redisTemplate;

    @Test
    void contextLoads() {
    }

    @Test
    void releaseReservationsDeletesOnlyCurrentUsersSeatKeys() {
        UUID activityId = UUID.randomUUID();
        UUID userId = UUID.randomUUID();
        UUID otherUserId = UUID.randomUUID();
        UUID ownedSeatId = UUID.randomUUID();
        UUID otherSeatId = UUID.randomUUID();
        String ownedSeatKey = "seat:" + activityId + ":" + ownedSeatId;
        String otherSeatKey = "seat:" + activityId + ":" + otherSeatId;
        String userReservationsKey = "user_reservations:" + activityId + ":" + userId;
        String eventSeatsKey = "event_seats:" + activityId;

        try {
            redisTemplate.opsForValue().set(ownedSeatKey, "reserved:" + userId);
            redisTemplate.opsForValue().set(otherSeatKey, "reserved:" + otherUserId);
            redisTemplate.opsForSet().add(userReservationsKey, ownedSeatId.toString(), otherSeatId.toString());
            redisTemplate.opsForSet().add(eventSeatsKey, ownedSeatId.toString(), otherSeatId.toString());

            orderService.releaseReservations(userId, activityId, List.of(ownedSeatId, otherSeatId));

            assertNull(redisTemplate.opsForValue().get(ownedSeatKey));
            assertEquals("reserved:" + otherUserId, redisTemplate.opsForValue().get(otherSeatKey));
            assertFalse(Boolean.TRUE.equals(redisTemplate.opsForSet().isMember(eventSeatsKey, ownedSeatId.toString())));
            assertEquals(true, redisTemplate.opsForSet().isMember(eventSeatsKey, otherSeatId.toString()));
            assertFalse(Boolean.TRUE.equals(redisTemplate.hasKey(userReservationsKey)));
        } finally {
            redisTemplate.delete(List.of(ownedSeatKey, otherSeatKey, userReservationsKey, eventSeatsKey));
        }
    }

}
