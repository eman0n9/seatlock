package cz.fit.cvut.seatlock.service;

import cz.fit.cvut.seatlock.domain.Hall;
import cz.fit.cvut.seatlock.domain.Seat;
import cz.fit.cvut.seatlock.dto.HallDTO;
import cz.fit.cvut.seatlock.dto.HallRowDTO;
import cz.fit.cvut.seatlock.dto.HallSeatDTO;
import cz.fit.cvut.seatlock.dto.HallSeatMapDTO;
import cz.fit.cvut.seatlock.repository.HallRepository;
import cz.fit.cvut.seatlock.repository.SeatRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class HallService {
    private final HallRepository hallRepository;
    private final SeatRepository seatRepository;

    @Transactional
    public Hall createHall(HallDTO dto){
        if(hallRepository.findByName(dto.name()).isPresent()){
            throw new RuntimeException("This name is already occupied");
        }

        if(hallRepository.findByAddress(dto.address()).isPresent()){
            throw new RuntimeException("This address is already occupied");
        }

        Hall newHall = new Hall(dto.name(), dto.address(), dto.city());
        Hall savedHall = hallRepository.save(newHall);

        List<Seat> seatsToSave = new java.util.ArrayList<>();
        dto.seats().forEach(config -> {
            for(int i = 1; i <= config.countOfSeats(); ++i){
                Seat newSeat = new Seat(config.rowNumber(), i);
                newSeat.setHall(savedHall);
                seatsToSave.add(newSeat);
                savedHall.getSeats().add(newSeat);
            }
        });

        seatRepository.saveAll(seatsToSave);
        return savedHall;
    }

    public Boolean deleteHall(UUID id) {
        Hall hallToDelete = hallRepository.findById(id).orElseThrow(() -> new RuntimeException("Hall not found"));
        seatRepository.deleteByHallId(id);
        hallRepository.delete(hallToDelete);
        return true;
    }

    public List<Hall> getAllHalls() {
        return hallRepository.findAll();
    }

    public Hall getHallById(UUID id) {
        return hallRepository.findById(id).orElseThrow(() -> new RuntimeException("Hall not found"));
    }

    public HallSeatMapDTO getHallSeatMap(UUID id) {
        hallRepository.findById(id).orElseThrow(() -> new RuntimeException("Hall not found"));

        List<Seat> seats = seatRepository.findByHallId(id);

        Map<Integer, List<HallSeatDTO>> byRow = new LinkedHashMap<>();
        for (Seat seat : seats) {
            byRow.computeIfAbsent(seat.getRowNumber(), k -> new java.util.ArrayList<>())
                    .add(new HallSeatDTO(seat.getId(), seat.getSeatNumber(), seat.getRowNumber()));
        }

        List<HallRowDTO> rows = byRow.entrySet().stream()
                .map(e -> new HallRowDTO(e.getKey(), e.getValue()))
                .toList();

        return new HallSeatMapDTO(rows);
    }

    public Boolean updateHall(HallDTO dto, UUID id) {
        Hall hallToUpdate = hallRepository.findById(id).orElseThrow(() -> new RuntimeException("Hall not found"));
        if(dto.name() != null){
            hallRepository.findByName(dto.name()).ifPresent(found -> {
                if(!found.getId().equals(id)){
                    throw new RuntimeException("Hall with this name already exist");
                }
            });
            hallToUpdate.setName(dto.name());
        }

        if(dto.address()!= null){
            hallRepository.findByAddress(dto.address()).ifPresent(found -> {
                if(!found.getId().equals(id)){
                    throw new RuntimeException("Hall with this address already exist");
                }
            });
            hallToUpdate.setAddress(dto.address());
        }

        if(dto.city() != null){
            hallToUpdate.setCity(dto.city());
        }
        // make seats change in future
        hallRepository.save(hallToUpdate);
        return true;
    }
}