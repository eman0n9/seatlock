package cz.fit.cvut.seatlock.service;

import cz.fit.cvut.seatlock.dto.LoginDTO;
import cz.fit.cvut.seatlock.exception.InvalidCredentialsException;
import cz.fit.cvut.seatlock.repository.UserRepository;
import cz.fit.cvut.seatlock.security.JWTUtils;
import cz.fit.cvut.seatlock.security.SeatlockUserDetailsService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.security.crypto.password.PasswordEncoder;

import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AuthServiceTest {

    @Mock
    private UserRepository userRepository;
    @Mock
    private SeatlockUserDetailsService userDetailsService;
    @Mock
    private JWTUtils jwtUtils;
    @Mock
    private PasswordEncoder passwordEncoder;

    @InjectMocks
    private AuthService authService;

    @Test
    void nonexistentUserIsReportedAsInvalidCredentials() {
        LoginDTO login = new LoginDTO("missing@example.com", "password");
        when(userDetailsService.loadUserByUsername(login.email()))
                .thenThrow(new UsernameNotFoundException("User not found"));

        assertThrows(InvalidCredentialsException.class, () -> authService.login(login));
    }
}
