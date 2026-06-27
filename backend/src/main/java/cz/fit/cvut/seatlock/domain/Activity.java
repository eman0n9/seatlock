package cz.fit.cvut.seatlock.domain;

import lombok.EqualsAndHashCode;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Getter
@Setter
@NoArgsConstructor
@EqualsAndHashCode(onlyExplicitlyIncluded = true)
public class Activity {

    @EqualsAndHashCode.Include
    private UUID id;

    private String name;

    private LocalDate date;

    private LocalTime startTime;

    private LocalTime endTime;

    private String description;

    private UUID hallId;

    private UUID activityCategoryId;

    private ActivityCategory category;

    private Hall hall;

    private List<Performer> performers = new ArrayList<>();

    private List<Offer> offers = new ArrayList<>();

    public Activity(String name, LocalDate date, LocalTime startTime, LocalTime endTime, String description, ActivityCategory activityCategory, Hall hall, List<Performer> performers) {
        this.name = name;
        this.date = date;
        this.startTime = startTime;
        this.endTime = endTime;
        this.description = description;
        this.category = activityCategory;
        this.hall = hall;
        this.performers = performers;
    }
}
