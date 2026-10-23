package com.dairy.repo;

import com.dairy.model.Asset;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface AssetRepository extends JpaRepository<Asset, Long> {

    /** Assets linked to an animal by tag, ignoring stray spaces around the serial number. */
    @Query("select a from Asset a where trim(a.serialNumber) = :tag")
    List<Asset> findBySerialNumberTrimmed(@Param("tag") String tag);
}
