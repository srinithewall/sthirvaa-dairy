package com.dairy.config;

import com.github.benmanes.caffeine.cache.Caffeine;
import org.springframework.cache.CacheManager;
import org.springframework.cache.annotation.EnableCaching;
import org.springframework.cache.caffeine.CaffeineCache;
import org.springframework.cache.support.SimpleCacheManager;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.time.Duration;
import java.util.Arrays;

/**
 * In-process caching for reference data - the small, rarely-changing tables that are read on
 * almost every request (breeds, categories, feed master data, role permissions).
 *
 * Deliberately NOT used for operational data such as herds, milk records or chores. Those
 * change whenever someone records a milking or a herd event, and showing a farmhand a stale
 * figure costs more than the query does.
 *
 * Caffeine is in-process, which is correct for a single backend instance. If the app is ever
 * scaled to more than one instance these caches will diverge between them, and this should
 * move to a shared cache (Redis) at that point.
 *
 * Entries are evicted explicitly when the underlying table is written (see the @CacheEvict
 * annotations on the controllers and services that own each table). The time limits below are
 * only a backstop, for rows changed directly in the database rather than through the app.
 */
@Configuration
@EnableCaching
public class CacheConfig {

    /** Breed formulas - read once per herd-list request. */
    public static final String BREEDS = "breeds";

    /** Income/expense category lookups. */
    public static final String CATEGORIES = "categories";

    /** Feed master rows and their nutrition, read throughout the feed optimizer. */
    public static final String FEED_MASTER = "feedMaster";

    /** Nutrient requirement rows, seeded and then read-only. */
    public static final String ANIMAL_REQUIREMENTS = "animalRequirements";

    /**
     * Role/module permission rows, read on every secured request for non-admin users.
     *
     * Kept to a short window on purpose: this is an authorisation decision, so a revoked
     * permission stays in effect until the entry expires. Five minutes is the ceiling on
     * how long that can last. Nothing in the app writes this table today - it is maintained
     * directly in the database - so there is no eviction hook to rely on.
     */
    public static final String ROLE_PERMISSIONS = "rolePermissions";

    @Bean
    public CacheManager cacheManager() {
        SimpleCacheManager manager = new SimpleCacheManager();
        manager.setCaches(Arrays.asList(
                buildCache(BREEDS, Duration.ofHours(6), 200),
                buildCache(CATEGORIES, Duration.ofHours(6), 200),
                buildCache(FEED_MASTER, Duration.ofHours(6), 1000),
                buildCache(ANIMAL_REQUIREMENTS, Duration.ofHours(6), 200),
                // Short, because it gates access. See the note on ROLE_PERMISSIONS.
                buildCache(ROLE_PERMISSIONS, Duration.ofMinutes(5), 500)
        ));
        return manager;
    }

    private CaffeineCache buildCache(String name, Duration ttl, int maximumSize) {
        return new CaffeineCache(name, Caffeine.newBuilder()
                .expireAfterWrite(ttl)
                .maximumSize(maximumSize)
                .build());
    }
}
