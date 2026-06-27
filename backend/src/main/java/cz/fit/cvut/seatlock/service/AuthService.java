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
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class AuthService {
    private final UserRepository userRepository;
    private final SeatlockUserDetailsService seatlockUserDetailsService;
    private final JWTUtils jwtUtils;
    private final PasswordEncoder passwordEncoder;

    public void register(RegisterDTO registerDTO) {
        userRepository.findUserByEmail(registerDTO.email())
                .ifPresent(user -> {
                    throw new UserAlreadyExistsException("User with this email already exists");
                });
        userRepository.findUserByPhoneNumber(registerDTO.phoneNumber())
                .ifPresent(user -> {
                    throw new UserAlreadyExistsException("Phone number is already used");
                });
        User newUser = new User(registerDTO.email(), passwordEncoder.encode(registerDTO.password()), registerDTO.name(),
                registerDTO.surname(), registerDTO.countryCode(), registerDTO.phoneNumber());
        newUser.setRole(Role.ROLE_CUSTOMER);
        userRepository.save(newUser);
    }

    public String login(LoginDTO loginDTO) {
        var userDetails = seatlockUserDetailsService.loadUserByUsername(loginDTO.email());
        if(!passwordEncoder.matches(loginDTO.password(), userDetails.getPassword())){
            throw new InvalidCredentialsException("Invalid credentials");
        }
        return jwtUtils.generateToken(userDetails);
    }
}
