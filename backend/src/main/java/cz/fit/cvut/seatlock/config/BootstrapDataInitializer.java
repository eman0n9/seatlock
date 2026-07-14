package cz.fit.cvut.seatlock.config;

import cz.fit.cvut.seatlock.domain.ActivityCategory;
import cz.fit.cvut.seatlock.domain.Hall;
import cz.fit.cvut.seatlock.domain.Seat;
import cz.fit.cvut.seatlock.domain.User;
import cz.fit.cvut.seatlock.domain.enums.Role;
import cz.fit.cvut.seatlock.domain.enums.TicketType;
import cz.fit.cvut.seatlock.dto.ActivityDTO;
import cz.fit.cvut.seatlock.dto.HallDTO;
import cz.fit.cvut.seatlock.dto.PriceZoneDTO;
import cz.fit.cvut.seatlock.dto.RowConfig;
import cz.fit.cvut.seatlock.repository.ActivityCategoryRepository;
import cz.fit.cvut.seatlock.repository.ActivityRepository;
import cz.fit.cvut.seatlock.repository.HallRepository;
import cz.fit.cvut.seatlock.repository.SeatRepository;
import cz.fit.cvut.seatlock.repository.UserRepository;
import cz.fit.cvut.seatlock.service.ActivityService;
import cz.fit.cvut.seatlock.service.HallService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.annotation.Order;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;
import java.util.Locale;

@Component
@Order(0)
@RequiredArgsConstructor
@Slf4j
public class BootstrapDataInitializer implements ApplicationRunner {

    private static final String DEMO_ACTIVITY_NAME = "SeatLock Live Demo";
    private static final String DEMO_HALL_NAME = "SeatLock Demo Arena";

    private final UserRepository userRepository;
    private final ActivityCategoryRepository categoryRepository;
    private final ActivityRepository activityRepository;
    private final HallRepository hallRepository;
    private final SeatRepository seatRepository;
    private final HallService hallService;
    private final ActivityService activityService;
    private final PasswordEncoder passwordEncoder;

    @Value("${app.bootstrap-admin.email:}")
    private String adminEmail;

    @Value("${app.bootstrap-admin.password:}")
    private String adminPassword;

    @Value("${app.demo-data.enabled:false}")
    private boolean demoDataEnabled;

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        if (adminEmail.isBlank() && adminPassword.isBlank() && !demoDataEnabled) {
            return;
        }
        if (adminEmail.isBlank() || adminPassword.length() < 8 || adminPassword.length() > 72) {
            throw new IllegalStateException(
                    "Bootstrap admin requires APP_BOOTSTRAP_ADMIN_EMAIL and an 8-72 character password"
            );
        }

        User admin = createAdminIfMissing();
        if (demoDataEnabled) {
            createDemoEventIfMissing(admin);
        }
    }

    private User createAdminIfMissing() {
        String normalizedEmail = adminEmail.trim().toLowerCase(Locale.ROOT);
        return userRepository.findUserByEmail(normalizedEmail).orElseGet(() -> {
            User admin = new User(
                    normalizedEmail,
                    passwordEncoder.encode(adminPassword),
                    "SeatLock",
                    "Admin",
                    "+420",
                    "000000000"
            );
            admin.setRole(Role.ROLE_ADMIN);
            log.info("Creating bootstrap administrator {}", normalizedEmail);
            return userRepository.save(admin);
        });
    }

    private void createDemoEventIfMissing(User admin) {
        if (admin.getRole() != Role.ROLE_ADMIN) {
            throw new IllegalStateException("Bootstrap admin email belongs to a non-admin account");
        }
        if (activityRepository.findByName(DEMO_ACTIVITY_NAME).isPresent()) {
            return;
        }

        ActivityCategory category = categoryRepository.findByName("Concerts")
                .orElseGet(() -> categoryRepository.save(new ActivityCategory("Concerts")));
        Hall hall = hallRepository.findByName(DEMO_HALL_NAME)
                .orElseGet(() -> hallService.createHall(new HallDTO(
                        DEMO_HALL_NAME,
                        "Demo Street 1",
                        "Prague",
                        List.of(
                                new RowConfig(1, 10),
                                new RowConfig(2, 10),
                                new RowConfig(3, 10),
                                new RowConfig(4, 10)
                        )
                )));

        List<Seat> seats = seatRepository.findByHallId(hall.getId());
        List<PriceZoneDTO> priceZones = List.of(
                zone(TicketType.VIP, 149.0, seats, 1),
                zone(TicketType.STANDARD, 89.0, seats, 2, 3),
                zone(TicketType.ECONOMY, 49.0, seats, 4)
        );

        activityService.createActivity(new ActivityDTO(
                DEMO_ACTIVITY_NAME,
                LocalDate.now().plusMonths(2),
                LocalTime.of(19, 30),
                LocalTime.of(22, 0),
                "Demo event for the SeatLock reservation and checkout flow.",
                category.getId(),
                hall.getId(),
                List.of(),
                priceZones
        ), admin.getId());
    }

    private PriceZoneDTO zone(TicketType type, double price, List<Seat> seats, int... rows) {
        List<Integer> rowNumbers = java.util.Arrays.stream(rows).boxed().toList();
        return new PriceZoneDTO(
                type,
                price,
                seats.stream()
                        .filter(seat -> rowNumbers.contains(seat.getRowNumber()))
                        .map(Seat::getId)
                        .toList()
        );
    }
}
