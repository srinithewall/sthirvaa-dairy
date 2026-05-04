package com.dairy.repo;

import com.dairy.model.MilkDispatch;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.time.LocalDate;
import java.util.List;

public interface MilkDispatchRepository extends JpaRepository<MilkDispatch, Long> {
    List<MilkDispatch> findByDate(LocalDate date);
    List<MilkDispatch> findByDateAndShift(LocalDate date, String shift);
    List<MilkDispatch> findByDateBetween(LocalDate start, LocalDate end);
    void deleteByDateAndShift(LocalDate date, String shift);

    @Query("SELECT SUM(d.totalAmount) FROM MilkDispatch d WHERE d.date = :date AND d.dispatchType = 'CUSTOMER'")
    Double sumRevenueByDate(@Param("date") LocalDate date);

    @Query("SELECT SUM(d.quantity) FROM MilkDispatch d WHERE d.date = :date")
    Double sumQuantityByDate(@Param("date") LocalDate date);
}
