package com.dairy.repo.store;

import com.dairy.model.store.StoreStockMove;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface StoreStockMoveRepository extends JpaRepository<StoreStockMove, Long> {
    List<StoreStockMove> findTop200ByItemIdOrderByMovedAtDescIdDesc(Long itemId);
}
