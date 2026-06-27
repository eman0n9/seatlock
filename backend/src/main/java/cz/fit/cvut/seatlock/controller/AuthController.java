package cz.fit.cvut.seatlock.controller;

import cz.fit.cvut.seatlock.dto.LoginDTO;
import cz.fit.cvut.seatlock.dto.RegisterDTO;
import cz.fit.cvut.seatlock.dto.TokenResponseDTO;
import cz.fit.cvut.seatlock.security.JWTUtils;
import cz.fit.cvut.seatlock.security.SeatlockUserDetails;
import cz.fit.cvut.seatlock.service.AuthService;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.parameters.RequestBody;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseCookie;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Duration;

@Tag(name = "Authentication", description = "API for authentication")
@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {
    private final AuthService authService;
    private final JWTUtils jwtUtils;

    @Operation(
            summary = "Register a new user",
            tags = {"Authentication"}
    )
    @ApiResponses({
            @ApiResponse(responseCode = "201", description = "User registered successfully"),
            @ApiResponse(responseCode = "409", description = "Email or phone number already in use"),
            @ApiResponse(responseCode = "500", description = "Internal server error")
    })
    @PostMapping("/register")
    public ResponseEntity<Void> register(
            @RequestBody(
                    description = "User registration data",
                    required = true,
                    content = @Content(
                            mediaType = "application/json",
                            schema = @Schema(implementation = RegisterDTO.class)
                    )
            )
            @org.springframework.web.bind.annotation.RequestBody RegisterDTO registerDTO) {
        authService.register(registerDTO);
        return ResponseEntity.status(HttpStatus.CREATED).build();
    }

    @Operation(
            summary = "Login",
            description = "Returns JWT token as HttpOnly cookie",
            tags = {"Authentication"}
    )
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Login successful, token set in cookie"),
            @ApiResponse(responseCode = "401", description = "Invalid credentials"),
            @ApiResponse(responseCode = "500", description = "Internal server error")
    })
    @PostMapping("/login")
    public ResponseEntity<Void> login(
            @RequestBody(
                    description = "User login credentials",
                    required = true,
                    content = @Content(
                            mediaType = "application/json",
                            schema = @Schema(implementation = LoginDTO.class)
                    )
            )
            @org.springframework.web.bind.annotation.RequestBody LoginDTO loginDTO,
            HttpServletResponse response) {
        var token = authService.login(loginDTO);
        ResponseCookie cookie = ResponseCookie.from("accessToken", token)
                .httpOnly(true)
                .secure(false)
                .path("/")
                .maxAge(Duration.ofDays(1))
                .sameSite("Strict")
                .build();
        response.addHeader(HttpHeaders.SET_COOKIE, cookie.toString());
        return ResponseEntity.ok().build();
    }

    @Operation(
            summary = "Login with token response",
            description = "Returns JWT token in JSON body",
            tags = {"Authentication"}
    )
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Login successful, token returned in body",
                    content = @Content(mediaType = "application/json", schema = @Schema(implementation = TokenResponseDTO.class))),
            @ApiResponse(responseCode = "401", description = "Invalid credentials"),
            @ApiResponse(responseCode = "500", description = "Internal server error")
    })
    @PostMapping("/login-token")
    public ResponseEntity<TokenResponseDTO> loginWithToken(
            @RequestBody(
                    description = "User login credentials",
                    required = true,
                    content = @Content(
                            mediaType = "application/json",
                            schema = @Schema(implementation = LoginDTO.class)
                    )
            )
            @org.springframework.web.bind.annotation.RequestBody LoginDTO loginDTO) {
        var token = authService.login(loginDTO);
        return ResponseEntity.ok(new TokenResponseDTO(token));
    }

    @Operation(
            summary = "Get short-lived WebSocket token",
            description = "Returns a 30-second JWT as a readable cookie for WebSocket handshake with Go service",
            tags = {"Authentication"}
    )
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Token set in ws_token cookie"),
            @ApiResponse(responseCode = "401", description = "Not authenticated")
    })
    @PostMapping("/ws-token")
    public ResponseEntity<Void> wsToken(
            @AuthenticationPrincipal SeatlockUserDetails userDetails,
            HttpServletResponse response) {
        String token = jwtUtils.generateShortLivedToken(userDetails);
        ResponseCookie cookie = ResponseCookie.from("ws_token", token)
                .httpOnly(false)
                .secure(false)
                .path("/")
                .maxAge(Duration.ofSeconds(30))
                .sameSite("Strict")
                .build();
        response.addHeader(HttpHeaders.SET_COOKIE, cookie.toString());
        return ResponseEntity.ok().build();
    }

    @Operation(
            summary = "Logout",
            description = "Clears the JWT cookie",
            tags = {"Authentication"}
    )
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Logged out successfully"),
            @ApiResponse(responseCode = "500", description = "Internal server error")
    })
    @PostMapping("/logout")
    public ResponseEntity<Void> logout(HttpServletResponse response) {
        ResponseCookie cookie = ResponseCookie.from("accessToken", "")
                .httpOnly(true)
                .secure(false)
                .path("/")
                .maxAge(0)
                .sameSite("Strict")
                .build();
        response.addHeader(HttpHeaders.SET_COOKIE, cookie.toString());
        return ResponseEntity.ok().build();
    }
}
