package com.dairy.controller;

import com.dairy.model.Breed;
import com.dairy.repo.BreedRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/breeds")
@CrossOrigin(origins = "*")
public class BreedController {

    @Autowired
    private BreedRepository breedRepository;

    @GetMapping
    public List<Breed> getAllBreeds() {
        return breedRepository.findAll();
    }

    @PostMapping
    public Breed createBreed(@RequestBody Breed breed) {
        return breedRepository.save(breed);
    }
}
