package com.dairy;

import com.dairy.model.Role;
import com.dairy.model.User;
import com.dairy.repo.UserRepository;
import org.springframework.boot.CommandLineRunner;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.annotation.Bean;
import org.springframework.scheduling.annotation.EnableAsync;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.security.crypto.password.PasswordEncoder;

@SpringBootApplication
@EnableAsync
@EnableScheduling
public class DairyApplication {
    public static void main(String[] args) {
        SpringApplication.run(DairyApplication.class, args);
    }

    @Bean
    public CommandLineRunner dataInitializer(UserRepository userRepository, PasswordEncoder passwordEncoder, com.dairy.repo.BreedRepository breedRepository) {
        return args -> {
            // Create default admin if not exists
            if (userRepository.findByUsername("admin").isEmpty()) {
                User admin = new User();
                admin.setUsername("admin");
                admin.setEmail("admin@dairy.com");
                admin.setPassword(passwordEncoder.encode("password123"));
                admin.setRole(Role.ADMIN);
                userRepository.save(admin);
                System.out.println("Default admin user created: admin / password123");
            }

            // Seed Default Breeds
            if (breedRepository.count() == 0) {
                // public Breed(name, desc, lengthRatio, formulaType, veryLow, low, belowAvg, avg, slightlyOverweight)
                breedRepository.save(new com.dairy.model.Breed("Holstein Friesian", "Large-frame exotic breed", 1.10, "SCHAEFFER", 400.0, 500.0, 600.0, 700.0, 750.0));
                breedRepository.save(new com.dairy.model.Breed("Holstein Cross", "Medium-large crossbred", 1.08, "SCHAEFFER", 380.0, 450.0, 550.0, 650.0, 700.0));
                breedRepository.save(new com.dairy.model.Breed("Jersey", "Small-frame exotic breed", 1.00, "SCHAEFFER", 300.0, 350.0, 420.0, 480.0, 520.0));
                breedRepository.save(new com.dairy.model.Breed("Jersey Cross", "Medium-small crossbred", 1.02, "SCHAEFFER", 320.0, 380.0, 450.0, 500.0, 550.0));
                breedRepository.save(new com.dairy.model.Breed("Gir", "Indigenous zebu breed", 1.05, "AGARWAL", 280.0, 320.0, 380.0, 430.0, 480.0));
                breedRepository.save(new com.dairy.model.Breed("Unknown", "Generic/Default", 1.05, "SCHAEFFER", 350.0, 400.0, 500.0, 600.0, 650.0));
            }
        };
    }
}
