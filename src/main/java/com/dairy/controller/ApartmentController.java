package com.dairy.controller;

import com.dairy.model.Apartment;
import com.dairy.repo.ApartmentRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
@RequestMapping("/api/apartments")
public class ApartmentController {

    @Autowired
    private ApartmentRepository apartmentRepository;

    @GetMapping
    public List<Apartment> getAllApartments() {
        return apartmentRepository.findAll();
    }
}
