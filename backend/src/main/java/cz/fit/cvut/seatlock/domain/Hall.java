package cz.fit.cvut.seatlock.domain;

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
public class Hall {

    @EqualsAndHashCode.Include
    private UUID id;

    private String name;

    private String address;

    private String city;

    private List<Seat> seats = new ArrayList<>();

    private List<Activity> activities = new ArrayList<>();

    public Hall(String name, String address, String city) {
        this.name = name;
        this.address = address;
        this.city = city;
    }
}
