package cz.fit.cvut.seatlock.security;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.io.Decoders;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.stereotype.Component;

import javax.crypto.SecretKey;
import java.util.Date;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

@Component
public class JWTUtils {

    private final SecretKey secretKey;
    private final long jwtExpiration;

    public JWTUtils(
            @Value("${security.jwt.secret}") String encodedSecret,
            @Value("${security.jwt.expiration:86400000}") long jwtExpiration
    ) {
        this.jwtExpiration = jwtExpiration;
        try {
            this.secretKey = Keys.hmacShaKeyFor(Decoders.BASE64.decode(encodedSecret));
        } catch (RuntimeException ex) {
            throw new IllegalStateException(
                    "security.jwt.secret must be a Base64-encoded key of at least 256 bits",
                    ex
            );
        }
    }

    public String generateToken(UserDetails userDetails) {
        return buildToken(userDetails, jwtExpiration, "api");
    }

    public String generateShortLivedToken(UserDetails userDetails) {
        return buildToken(userDetails, 30_000L, "websocket");
    }

    private String buildToken(UserDetails userDetails, long expirationMs, String tokenPurpose) {
        Map<String, Object> claims = new HashMap<>();

        List<String> roles = userDetails.getAuthorities().stream()
                .map(GrantedAuthority::getAuthority)
                .collect(Collectors.toList());

        claims.put("roles", roles);
        claims.put("tokenPurpose", tokenPurpose);

        if (userDetails instanceof SeatlockUserDetails details) {
            claims.put("userId", details.getId().toString());
        }

        return Jwts.builder()
                .claims(claims)
                .subject(userDetails.getUsername())
                .issuedAt(new Date())
                .expiration(new Date(System.currentTimeMillis() + expirationMs))
                .signWith(secretKey)
                .compact();
    }

    public boolean validateJwtToken(String authToken) {
        try {
            Jwts.parser()
                    .verifyWith(secretKey)
                    .build()
                    .parseSignedClaims(authToken);
            return true;
        } catch (Exception e) {
            return false;
        }
    }

    public String getUserNameFromJwtToken(String token) {
        return getAllClaimsFromToken(token).getSubject();
    }

    public UUID getUserIdFromJwtToken(String token) {
        String userId = getAllClaimsFromToken(token).get("userId", String.class);
        if (userId == null) {
            throw new IllegalArgumentException("JWT does not contain a userId claim");
        }
        return UUID.fromString(userId);
    }

    public boolean hasPurpose(String token, String purpose) {
        return purpose.equals(getAllClaimsFromToken(token).get("tokenPurpose", String.class));
    }

    private Claims getAllClaimsFromToken(String token) {
        return Jwts.parser()
                .verifyWith(secretKey)
                .build()
                .parseSignedClaims(token)
                .getPayload();
    }

    @SuppressWarnings("unchecked")
    public List<GrantedAuthority> getAuthoritiesFromJwtToken(String token) {
        Claims claims = getAllClaimsFromToken(token);
        List<String> roles = claims.get("roles", List.class);

        if (roles == null) {
            return List.of();
        }
        return roles.stream()
                .map(SimpleGrantedAuthority::new)
                .collect(Collectors.toList());
    }
}
