package cz.fit.cvut.seatlock.service;

import cz.fit.cvut.seatlock.dto.UpdateUserDTO;
import cz.fit.cvut.seatlock.dto.UserDTO;
import cz.fit.cvut.seatlock.repository.OrderRepository;
import cz.fit.cvut.seatlock.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.util.Locale;

@Service
@RequiredArgsConstructor
public class UserService {
    private final UserRepository userRepository;
    private final OrderRepository orderRepository;
    private final PasswordEncoder passwordEncoder;

    public UserDTO me(String email) {
        var user = userRepository.findUserByEmail(email).orElseThrow(() -> new RuntimeException("User not found"));
        return new UserDTO(user.getId(), user.getName(), user.getSurname(), user.getEmail(), user.getRole().getAuthority(), user.getPhoneNumber());
    }

    public Boolean updateUser(String email, UpdateUserDTO input) {
        var user = userRepository.findUserByEmail(email).orElseThrow(() -> new RuntimeException("User not found"));

        if (input.name() != null) {
            if (input.name().isBlank()) {
                throw new IllegalArgumentException("Name must not be blank");
            }
            user.setName(input.name().trim());
        }
        if (input.surname() != null) {
            if (input.surname().isBlank()) {
                throw new IllegalArgumentException("Surname must not be blank");
            }
            user.setSurname(input.surname().trim());
        }
        if (input.email() != null) {
            String normalizedEmail = input.email().trim().toLowerCase(Locale.ROOT);
            userRepository.findUserByEmail(normalizedEmail).ifPresent(existing -> {
                if (!existing.getId().equals(user.getId())) {
                    throw new IllegalArgumentException("Email is already in use");
                }
            });
            user.setEmail(normalizedEmail);
        }
        if (input.password() != null) {
            user.setPassword(passwordEncoder.encode(input.password()));
        }

        userRepository.save(user);
        return true;
    }
}
