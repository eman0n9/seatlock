package cz.fit.cvut.seatlock.domain;

import cz.fit.cvut.seatlock.domain.enums.Role;
import lombok.EqualsAndHashCode;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Getter
@Setter
@NoArgsConstructor
@EqualsAndHashCode(onlyExplicitlyIncluded = true)
public class User {

    @EqualsAndHashCode.Include
    private UUID id;

    private String email;

    private String password;

    private String name;

    private String surname;

    private String countryCode;

    private String phoneNumber;

    private Role role;

    private List<Order> orders = new ArrayList<>();

    public User(String email, String password, String name, String surname, String countryCode, String phoneNumber) {
        this.email = email;
        this.password = password;
        this.name = name;
        this.surname = surname;
        this.countryCode = countryCode;
        this.phoneNumber = phoneNumber;
    }
}
