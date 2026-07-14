package cz.fit.cvut.seatlock.config;

import cz.fit.cvut.seatlock.domain.User;
import cz.fit.cvut.seatlock.domain.enums.Role;
import cz.fit.cvut.seatlock.repository.ActivityCategoryRepository;
import cz.fit.cvut.seatlock.repository.ActivityRepository;
import cz.fit.cvut.seatlock.repository.HallRepository;
import cz.fit.cvut.seatlock.repository.SeatRepository;
import cz.fit.cvut.seatlock.repository.UserRepository;
import cz.fit.cvut.seatlock.service.ActivityService;
import cz.fit.cvut.seatlock.service.HallService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.boot.DefaultApplicationArguments;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class BootstrapDataInitializerTest {

    @Mock private UserRepository userRepository;
    @Mock private ActivityCategoryRepository categoryRepository;
    @Mock private ActivityRepository activityRepository;
    @Mock private HallRepository hallRepository;
    @Mock private SeatRepository seatRepository;
    @Mock private HallService hallService;
    @Mock private ActivityService activityService;
    @Mock private PasswordEncoder passwordEncoder;

    @InjectMocks
    private BootstrapDataInitializer initializer;

    @Test
    void createsConfiguredAdminWithoutEnablingDemoData() {
        ReflectionTestUtils.setField(initializer, "adminEmail", " Admin@SeatLock.Local ");
        ReflectionTestUtils.setField(initializer, "adminPassword", "strong-password");
        ReflectionTestUtils.setField(initializer, "demoDataEnabled", false);
        when(userRepository.findUserByEmail("admin@seatlock.local")).thenReturn(Optional.empty());
        when(passwordEncoder.encode("strong-password")).thenReturn("encoded-password");
        when(userRepository.save(any(User.class))).thenAnswer(invocation -> {
            User user = invocation.getArgument(0);
            user.setId(UUID.randomUUID());
            return user;
        });

        initializer.run(new DefaultApplicationArguments(new String[0]));

        ArgumentCaptor<User> captor = ArgumentCaptor.forClass(User.class);
        verify(userRepository).save(captor.capture());
        assertEquals("admin@seatlock.local", captor.getValue().getEmail());
        assertEquals("encoded-password", captor.getValue().getPassword());
        assertEquals(Role.ROLE_ADMIN, captor.getValue().getRole());
    }
}
