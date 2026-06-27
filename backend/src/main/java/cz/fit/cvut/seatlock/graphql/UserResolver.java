package cz.fit.cvut.seatlock.graphql;

import cz.fit.cvut.seatlock.dto.UpdateUserDTO;
import cz.fit.cvut.seatlock.dto.UserDTO;
import cz.fit.cvut.seatlock.repository.UserRepository;
import cz.fit.cvut.seatlock.security.SeatlockUserDetails;
import cz.fit.cvut.seatlock.service.UserService;
import lombok.RequiredArgsConstructor;
import org.springframework.graphql.data.method.annotation.Argument;
import org.springframework.graphql.data.method.annotation.MutationMapping;
import org.springframework.graphql.data.method.annotation.QueryMapping;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.stereotype.Controller;

import java.util.UUID;

@Controller
@RequiredArgsConstructor
public class UserResolver {

    private final UserRepository userRepository;
    private final UserService service;

    @QueryMapping
    public UserDTO me(@AuthenticationPrincipal SeatlockUserDetails details){
        return service.me(details.getUsername());
    }

    @PreAuthorize("hasRole('ADMIN')")
    @MutationMapping
    public Boolean approveOrganizer(@Argument UUID userId) {
        return userRepository.updateRoleToOrganization(userId);
    }

    @PreAuthorize("isAuthenticated()")
    @MutationMapping
    public Boolean updateUser(
            @AuthenticationPrincipal SeatlockUserDetails details,
            @Argument UpdateUserDTO input
    ){
        return service.updateUser(details.getUsername(), input);
    }
}