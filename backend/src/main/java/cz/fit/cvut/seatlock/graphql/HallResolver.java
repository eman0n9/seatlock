package cz.fit.cvut.seatlock.graphql;

import cz.fit.cvut.seatlock.domain.Hall;
import cz.fit.cvut.seatlock.dto.HallDTO;
import cz.fit.cvut.seatlock.dto.HallSeatMapDTO;
import cz.fit.cvut.seatlock.service.HallService;
import lombok.RequiredArgsConstructor;
import org.springframework.graphql.data.method.annotation.Argument;
import org.springframework.graphql.data.method.annotation.MutationMapping;
import org.springframework.graphql.data.method.annotation.QueryMapping;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Controller;

import java.util.List;
import java.util.UUID;

@Controller
@RequiredArgsConstructor
public class HallResolver {
    private final HallService hallService;

    @PreAuthorize("hasRole('ADMIN')")
    @MutationMapping
    public Hall createHall(@Argument HallDTO input){
        return hallService.createHall(input);
    }

    @PreAuthorize("hasRole('ADMIN')")
    @MutationMapping
    public Boolean deleteHall(@Argument UUID id){
        return hallService.deleteHall(id);
    }

    @PreAuthorize("hasRole('ADMIN')")
    @MutationMapping
    public Boolean updateHall(@Argument HallDTO input, @Argument UUID id){ return hallService.updateHall(input, id); }

    @QueryMapping
    public List<Hall> getAllHalls(){
        return hallService.getAllHalls();
    }

    @QueryMapping
    public Hall getHallById(@Argument UUID id){
        return hallService.getHallById(id);
    }

    @QueryMapping
    public HallSeatMapDTO getHallSeatMap(@Argument UUID id){
        return hallService.getHallSeatMap(id);
    }
}
