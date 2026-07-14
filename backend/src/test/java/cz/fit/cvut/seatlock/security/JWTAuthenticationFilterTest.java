package cz.fit.cvut.seatlock.security;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockFilterChain;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;

import java.util.Base64;
import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class JWTAuthenticationFilterTest {

    @AfterEach
    void clearSecurityContext() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void apiTokenLoadsCurrentUserByImmutableId() throws Exception {
        JWTUtils jwtUtils = jwtUtils();
        SeatlockUserDetailsService userDetailsService = mock(SeatlockUserDetailsService.class);
        UUID userId = UUID.randomUUID();
        SeatlockUserDetails tokenOwner = user(userId, "old@example.com");
        SeatlockUserDetails currentUser = user(userId, "new@example.com");
        when(userDetailsService.loadUserById(userId)).thenReturn(currentUser);

        MockHttpServletRequest request = new MockHttpServletRequest();
        request.addHeader("Authorization", "Bearer " + jwtUtils.generateToken(tokenOwner));
        new JWTAuthenticationFilter(jwtUtils, userDetailsService).doFilterInternal(
                request, new MockHttpServletResponse(), new MockFilterChain()
        );

        assertEquals(currentUser, SecurityContextHolder.getContext().getAuthentication().getPrincipal());
        verify(userDetailsService).loadUserById(userId);
    }

    @Test
    void websocketTokenCannotAuthenticateApiRequest() throws Exception {
        JWTUtils jwtUtils = jwtUtils();
        SeatlockUserDetailsService userDetailsService = mock(SeatlockUserDetailsService.class);
        SeatlockUserDetails user = user(UUID.randomUUID(), "user@example.com");
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.addHeader("Authorization", "Bearer " + jwtUtils.generateShortLivedToken(user));

        new JWTAuthenticationFilter(jwtUtils, userDetailsService).doFilterInternal(
                request, new MockHttpServletResponse(), new MockFilterChain()
        );

        assertNull(SecurityContextHolder.getContext().getAuthentication());
        verify(userDetailsService, never()).loadUserById(user.getId());
    }

    private JWTUtils jwtUtils() {
        return new JWTUtils(Base64.getEncoder().encodeToString(new byte[32]), 60_000);
    }

    private SeatlockUserDetails user(UUID id, String email) {
        return new SeatlockUserDetails(
                id,
                email,
                "password",
                List.of(new SimpleGrantedAuthority("ROLE_CUSTOMER"))
        );
    }
}
