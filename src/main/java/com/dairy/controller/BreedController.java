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

    /** Updates the valuation inputs (base price, normal yield) of a breed. */
    @PutMapping("/{id}/valuation")
    public org.springframework.http.ResponseEntity<Breed> updateValuation(@PathVariable Long id, @RequestBody Breed body) {
        return breedRepository.findById(id).map(b -> {
            b.setBasePrice(body.getBasePrice());
            b.setNormalYield(body.getNormalYield());
            return org.springframework.http.ResponseEntity.ok(breedRepository.save(b));
        }).orElse(org.springframework.http.ResponseEntity.notFound().build());
    }
}
