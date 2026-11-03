package com.dairy.repo.ration;

import com.dairy.model.ration.RationMember;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface RationMemberRepository extends JpaRepository<RationMember, Long> {
    Optional<RationMember> findByHerdId(Long herdId);
    void deleteByGroupId(Long groupId);
}
