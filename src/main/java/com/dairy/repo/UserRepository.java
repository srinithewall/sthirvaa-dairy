package com.dairy.repo;

import com.dairy.model.User;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;

public interface UserRepository extends JpaRepository<User, Long> {
    java.util.List<User> findByFcmToken(String fcmToken);

    Optional<User> findByEmail(String email);
    Optional<User> findByUsername(String username);
    java.util.List<User> findByRoleIn(java.util.List<com.dairy.model.Role> roles);
}
