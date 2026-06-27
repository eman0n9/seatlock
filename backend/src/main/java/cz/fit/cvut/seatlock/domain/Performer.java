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
public class Performer {

    @EqualsAndHashCode.Include
    private UUID id;

    private String name;

    private String description;

    private List<Activity> activities = new ArrayList<>();

    public Performer(String name, String description) {
        this.name = name;
        this.description = description;
    }
}
