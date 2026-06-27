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
public class ActivityCategory {

    @EqualsAndHashCode.Include
    private UUID id;

    private String name;

    private List<Activity> activities = new ArrayList<>();

    public ActivityCategory(String name) {
        this.name = name;
    }
}
