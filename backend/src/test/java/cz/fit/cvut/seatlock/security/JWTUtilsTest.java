package cz.fit.cvut.seatlock.security;

import org.junit.jupiter.api.Test;
import org.springframework.security.core.authority.SimpleGrantedAuthority;

import java.util.Base64;
import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class JWTUtilsTest {

    @Test
    void invalidSecretFailsDuringInitialization() {
        assertThrows(IllegalStateException.class, () -> new JWTUtils("not-base64", 60_000));
    }

    @Test
    void shortSecretFailsDuringInitialization() {
        String shortSecret = Base64.getEncoder().encodeToString(new byte[16]);

        assertThrows(IllegalStateException.class, () -> new JWTUtils(shortSecret, 60_000));
    }

    @Test
    void validSecretCanIssueAndVerifyToken() {
        String secret = Base64.getEncoder().encodeToString(new byte[32]);
        JWTUtils jwtUtils = new JWTUtils(secret, 60_000);
        SeatlockUserDetails user = new SeatlockUserDetails(
                UUID.randomUUID(),
                "user@example.com",
                "password",
                List.of(new SimpleGrantedAuthority("ROLE_CUSTOMER"))
        );

        String token = jwtUtils.generateToken(user);

        assertTrue(jwtUtils.validateJwtToken(token));
        assertEquals(user.getUsername(), jwtUtils.getUserNameFromJwtToken(token));
        assertEquals(user.getId(), jwtUtils.getUserIdFromJwtToken(token));
        assertTrue(jwtUtils.hasPurpose(token, "api"));

        String websocketToken = jwtUtils.generateShortLivedToken(user);
        assertTrue(jwtUtils.validateJwtToken(websocketToken));
        assertTrue(jwtUtils.hasPurpose(websocketToken, "websocket"));
    }
}
