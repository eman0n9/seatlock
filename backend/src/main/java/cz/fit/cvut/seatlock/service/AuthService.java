package cz.fit.cvut.seatlock.service;

import cz.fit.cvut.seatlock.domain.User;
import cz.fit.cvut.seatlock.domain.enums.Role;
import cz.fit.cvut.seatlock.dto.LoginDTO;
import cz.fit.cvut.seatlock.dto.RegisterDTO;
import cz.fit.cvut.seatlock.exception.InvalidCredentialsException;
import cz.fit.cvut.seatlock.exception.UserAlreadyExistsException;
import cz.fit.cvut.seatlock.repository.UserRepository;
import cz.fit.cvut.seatlock.security.JWTUtils;
import cz.fit.cvut.seatlock.security.SeatlockUserDetailsService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.stereotype.Service;

import java.util.Locale;

@Service
@RequiredArgsConstructor
public class AuthService {
    private final UserRepository userRepository;
    private final SeatlockUserDetailsService seatlockUserDetailsService;
    private final JWTUtils jwtUtils;
    private final PasswordEncoder passwordEncoder;

    public void register(RegisterDTO registerDTO) {
        String email = normalizeEmail(registerDTO.email());
        String phoneNumber = registerDTO.phoneNumber().trim();

        userRepository.findUserByEmail(email)
                .ifPresent(user -> {
                    throw new UserAlreadyExistsException("User with this email already exists");
                });
        userRepository.findUserByPhoneNumber(phoneNumber)
                .ifPresent(user -> {
                    throw new UserAlreadyExistsException("Phone number is already used");
                });
        User newUser = new User(email, passwordEncoder.encode(registerDTO.password()), registerDTO.name().trim(),
                registerDTO.surname().trim(), registerDTO.countryCode().trim(), phoneNumber);
        newUser.setRole(Role.ROLE_CUSTOMER);
        userRepository.save(newUser);
    }

    public String login(LoginDTO loginDTO) {
        final UserDetails userDetails;
        try {
            userDetails = seatlockUserDetailsService.loadUserByUsername(normalizeEmail(loginDTO.email()));
        } catch (UsernameNotFoundException ex) {
            throw new InvalidCredentialsException("Invalid credentials");
        }
        if(!passwordEncoder.matches(loginDTO.password(), userDetails.getPassword())){
            throw new InvalidCredentialsException("Invalid credentials");
        }
        return jwtUtils.generateToken(userDetails);
    }

    private String normalizeEmail(String email) {
        return email.trim().toLowerCase(Locale.ROOT);
    }
}
