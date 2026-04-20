package com.dairy.repo;

import com.dairy.model.RolePermission;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;

public interface RolePermissionRepository extends JpaRepository<RolePermission, Long> {
    Optional<RolePermission> findByRoleAndModuleName(String role, String moduleName);
}
