package com.dairy.service;

import com.dairy.model.Herd;
import com.dairy.repo.HerdRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import java.util.List;
import java.util.Optional;

@Service
public class HerdService {
    @Autowired
    private HerdRepository herdRepository;

    public List<Herd> getAllHerds() {
        return herdRepository.findAll();
    }

    public Optional<Herd> getHerdById(Long id) {
        return herdRepository.findById(id);
    }

    public Herd saveHerd(Herd herd) {
        return herdRepository.save(herd);
    }

    public void deleteHerd(Long id) {
        herdRepository.deleteById(id);
    }

    public Optional<Herd> getHerdByTagNumber(String tagNumber) {
        return herdRepository.findByTagNumber(tagNumber);
    }

    public List<Herd> getHerdsByAnimalType(String animalType) {
        return herdRepository.findByAnimalType(animalType);
    }
}
