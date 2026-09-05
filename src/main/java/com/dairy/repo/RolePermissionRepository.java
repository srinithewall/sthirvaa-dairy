package com.dairy.repo;

import com.dairy.config.CacheConfig;
import com.dairy.model.RolePermission;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface RolePermissionRepository extends JpaRepository<RolePermission, Long> {

    /**
     * Cached: SecurityService.can() calls this on every secured request made by a non-admin
     * user. Note this caches an authorisation decision - a permission revoked directly in the
     * database takes up to the cache's five-minute window to take effect. Saving through this
     * repository evicts immediately.
     */
    @Cacheable(CacheConfig.ROLE_PERMISSIONS)
    Optional<RolePermission> findByRoleAndModuleName(String role, String moduleName);

    @Override
    @CacheEvict(value = CacheConfig.ROLE_PERMISSIONS, allEntries = true)
    <S extends RolePermission> S save(S permission);

    @Override
    @CacheEvict(value = CacheConfig.ROLE_PERMISSIONS, allEntries = true)
    <S extends RolePermission> java.util.List<S> saveAll(Iterable<S> permissions);

    @Override
    @CacheEvict(value = CacheConfig.ROLE_PERMISSIONS, allEntries = true)
    void deleteById(Long id);
}
