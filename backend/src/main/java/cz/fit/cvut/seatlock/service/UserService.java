package cz.fit.cvut.seatlock.service;

import cz.fit.cvut.seatlock.dto.UpdateUserDTO;
import cz.fit.cvut.seatlock.dto.UserDTO;
import cz.fit.cvut.seatlock.repository.OrderRepository;
import cz.fit.cvut.seatlock.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class UserService {
    private final UserRepository userRepository;
    private final OrderRepository orderRepository;
    private final PasswordEncoder passwordEncoder;

    public UserDTO me(String email) {
        var user = userRepository.findUserByEmail(email).orElseThrow(() -> new RuntimeException("User not found"));
        return new UserDTO(user.getName(), user.getSurname(), user.getEmail(), user.getRole().getAuthority(), user.getPhoneNumber());
    }

    public Boolean updateUser(String email, UpdateUserDTO input) {
        var user = userRepository.findUserByEmail(email).orElseThrow(() -> new RuntimeException("User not found"));

        if (input.name() != null) {
            user.setName(input.name());
        }
        if (input.surname() != null) {
            user.setSurname(input.surname());
        }
        if (input.email() != null) {
            user.setEmail(input.email());
        }
        if (input.password() != null) {
            user.setPassword(passwordEncoder.encode(input.password()));
        }

        userRepository.save(user);
        return true;
    }
}