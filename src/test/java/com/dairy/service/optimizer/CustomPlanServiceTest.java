package com.dairy.service.optimizer;

import com.dairy.dto.optimizer.PlanDetailDTO;
import com.dairy.dto.optimizer.PlanSummaryDTO;
import com.dairy.dto.optimizer.SavePlanRequestDTO;
import com.dairy.dto.optimizer.UpdatePlanRequestDTO;
import com.dairy.exception.AnimalNotFoundException;
import com.dairy.exception.PlanNotFoundException;
import com.dairy.model.FeedMaster;
import com.dairy.model.FeedPlan;
import com.dairy.model.FeedPlanItem;
import com.dairy.repo.HerdRepository;
import com.dairy.repository.FeedMasterRepository;
import com.dairy.repository.FeedPlanItemRepository;
import com.dairy.repository.FeedPlanRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InOrder;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class CustomPlanServiceTest {

    @Mock private FeedPlanRepository feedPlanRepository;
    @Mock private FeedPlanItemRepository feedPlanItemRepository;
    @Mock private FeedMasterRepository feedMasterRepository;
    @Mock private HerdRepository herdRepository;

    @InjectMocks
    private CustomPlanService service;

    private SavePlanRequestDTO saveRequest(Long animalId) {
        SavePlanRequestDTO req = new SavePlanRequestDTO();
        req.setAnimalId(animalId);
        req.setPlanName("Winter Ration");
        SavePlanRequestDTO.FeedEntry entry = new SavePlanRequestDTO.FeedEntry();
        entry.setFeedId(10L);
        entry.setQuantityKg(5.0);
        req.setFeedEntries(List.of(entry));
        return req;
    }

    private FeedMaster feedWithCost(Long id, Double cost) {
        FeedMaster f = new FeedMaster();
        f.setId(id);
        f.setFeedName("Grass");
        f.setCostPerKgAsFed(cost);
        return f;
    }

    @Test
    void savePlan_animalNotFound_throws() {
        when(herdRepository.existsById(1L)).thenReturn(false);

        assertThatThrownBy(() -> service.savePlan(saveRequest(1L)))
                .isInstanceOf(AnimalNotFoundException.class);
    }

    @Test
    void savePlan_happyPath_persistsPlanAndItems() {
        when(herdRepository.existsById(1L)).thenReturn(true);
        FeedPlan saved = new FeedPlan();
        saved.setId(100L);
        saved.setHerdId(1L);
        saved.setPlanName("Winter Ration");
        saved.setPlanType("CUSTOM");
        saved.setUpdatedAt(LocalDateTime.now());
        when(feedPlanRepository.save(any(FeedPlan.class))).thenReturn(saved);
        when(feedMasterRepository.findById(10L)).thenReturn(Optional.of(feedWithCost(10L, 2.0)));

        PlanSummaryDTO summary = service.savePlan(saveRequest(1L));

        assertThat(summary.getId()).isEqualTo(100L);
        assertThat(summary.getPlanName()).isEqualTo("Winter Ration");

        ArgumentCaptor<List<FeedPlanItem>> itemsCaptor = ArgumentCaptor.forClass(List.class);
        verify(feedPlanItemRepository).saveAll(itemsCaptor.capture());
        assertThat(itemsCaptor.getValue()).hasSize(1);
        assertThat(itemsCaptor.getValue().get(0).getFeedId()).isEqualTo(10L);
        assertThat(itemsCaptor.getValue().get(0).getQuantityKg()).isEqualTo(5.0);

        // cost = 2.0/kg * 5kg = 10.0, saved back onto the plan
        verify(feedPlanRepository, times(2)).save(any(FeedPlan.class));
    }

    @Test
    void savePlan_unknownFeed_throws() {
        when(herdRepository.existsById(1L)).thenReturn(true);
        FeedPlan saved = new FeedPlan();
        saved.setId(100L);
        when(feedPlanRepository.save(any(FeedPlan.class))).thenReturn(saved);
        when(feedMasterRepository.findById(10L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.savePlan(saveRequest(1L)))
                .isInstanceOf(com.dairy.exception.FeedNotFoundException.class);
    }

    @Test
    void listPlans_scopesToGivenAnimal_notOtherAnimals() {
        when(herdRepository.existsById(1L)).thenReturn(true);
        FeedPlan planForAnimal1 = new FeedPlan();
        planForAnimal1.setId(1L);
        planForAnimal1.setHerdId(1L);
        planForAnimal1.setPlanName("Animal 1 Plan");
        when(feedPlanRepository.findByHerdIdOrderByUpdatedAtDesc(1L)).thenReturn(List.of(planForAnimal1));

        List<PlanSummaryDTO> plans = service.listPlans(1L);

        assertThat(plans).hasSize(1);
        assertThat(plans.get(0).getPlanName()).isEqualTo("Animal 1 Plan");
        verify(feedPlanRepository, never()).findByHerdIdOrderByUpdatedAtDesc(2L);
    }

    @Test
    void listPlans_animalNotFound_throws() {
        when(herdRepository.existsById(99L)).thenReturn(false);

        assertThatThrownBy(() -> service.listPlans(99L)).isInstanceOf(AnimalNotFoundException.class);
    }

    @Test
    void loadPlan_returnsFeedLinesWithNames() {
        FeedPlan plan = new FeedPlan();
        plan.setId(5L);
        plan.setHerdId(1L);
        plan.setPlanName("Winter Ration");
        plan.setPlanType("CUSTOM");
        when(feedPlanRepository.findById(5L)).thenReturn(Optional.of(plan));
        when(feedPlanItemRepository.findByFeedPlanId(5L)).thenReturn(List.of(new FeedPlanItem(5L, 10L, 5.0)));
        when(feedMasterRepository.findById(10L)).thenReturn(Optional.of(feedWithCost(10L, 2.0)));

        PlanDetailDTO detail = service.loadPlan(5L);

        assertThat(detail.getAnimalId()).isEqualTo(1L);
        assertThat(detail.getFeeds()).hasSize(1);
        assertThat(detail.getFeeds().get(0).getFeedName()).isEqualTo("Grass");
        assertThat(detail.getFeeds().get(0).getQuantityKg()).isEqualTo(5.0);
    }

    @Test
    void loadPlan_notFound_throws() {
        when(feedPlanRepository.findById(999L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.loadPlan(999L)).isInstanceOf(PlanNotFoundException.class);
    }

    private UpdatePlanRequestDTO updateRequest(Long feedId, Double quantityKg) {
        UpdatePlanRequestDTO req = new UpdatePlanRequestDTO();
        req.setPlanName("Summer Ration");
        UpdatePlanRequestDTO.FeedEntry entry = new UpdatePlanRequestDTO.FeedEntry();
        entry.setFeedId(feedId);
        entry.setQuantityKg(quantityKg);
        req.setFeedEntries(List.of(entry));
        return req;
    }

    private FeedPlan existingPlan(Long id) {
        FeedPlan plan = new FeedPlan();
        plan.setId(id);
        plan.setHerdId(1L);
        plan.setPlanName("Winter Ration");
        plan.setPlanType("CUSTOM");
        plan.setTotalEstimatedCost(10.0);
        return plan;
    }

    @Test
    void updatePlan_notFound_throws() {
        when(feedPlanRepository.findById(999L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.updatePlan(999L, updateRequest(10L, 5.0)))
                .isInstanceOf(PlanNotFoundException.class);
        verify(feedPlanItemRepository, never()).deleteByFeedPlanId(any());
    }

    @Test
    void updatePlan_replacesNameAndItems_andRecomputesCost() {
        FeedPlan plan = existingPlan(5L);
        when(feedPlanRepository.findById(5L)).thenReturn(Optional.of(plan));
        when(feedPlanRepository.save(any(FeedPlan.class))).thenAnswer(inv -> inv.getArgument(0));
        when(feedMasterRepository.findById(10L)).thenReturn(Optional.of(feedWithCost(10L, 2.0)));

        PlanSummaryDTO summary = service.updatePlan(5L, updateRequest(10L, 3.0));

        assertThat(summary.getPlanName()).isEqualTo("Summer Ration");
        // 2.0/kg * 3kg = 6.0, replacing the previous 10.0
        assertThat(summary.getTotalEstimatedCost()).isEqualTo(6.0);

        verify(feedPlanItemRepository).deleteByFeedPlanId(5L);
        ArgumentCaptor<List<FeedPlanItem>> itemsCaptor = ArgumentCaptor.forClass(List.class);
        verify(feedPlanItemRepository).saveAll(itemsCaptor.capture());
        assertThat(itemsCaptor.getValue()).hasSize(1);
        assertThat(itemsCaptor.getValue().get(0).getQuantityKg()).isEqualTo(3.0);
    }

    @Test
    void updatePlan_oldItemsDeletedBeforeNewOnesWritten() {
        FeedPlan plan = existingPlan(5L);
        when(feedPlanRepository.findById(5L)).thenReturn(Optional.of(plan));
        when(feedPlanRepository.save(any(FeedPlan.class))).thenAnswer(inv -> inv.getArgument(0));
        when(feedMasterRepository.findById(10L)).thenReturn(Optional.of(feedWithCost(10L, 2.0)));

        service.updatePlan(5L, updateRequest(10L, 3.0));

        // The flush matters: without it Hibernate orders inserts before deletes and the
        // replaced lines survive the edit.
        InOrder inOrder = inOrder(feedPlanItemRepository);
        inOrder.verify(feedPlanItemRepository).deleteByFeedPlanId(5L);
        inOrder.verify(feedPlanItemRepository).flush();
        inOrder.verify(feedPlanItemRepository).saveAll(any());
    }

    @Test
    void updatePlan_ratioWithNoPricedFeed_clearsStaleCost() {
        FeedPlan plan = existingPlan(5L);
        when(feedPlanRepository.findById(5L)).thenReturn(Optional.of(plan));
        when(feedPlanRepository.save(any(FeedPlan.class))).thenAnswer(inv -> inv.getArgument(0));
        when(feedMasterRepository.findById(11L)).thenReturn(Optional.of(feedWithCost(11L, null)));

        PlanSummaryDTO summary = service.updatePlan(5L, updateRequest(11L, 4.0));

        assertThat(summary.getTotalEstimatedCost()).isNull();
    }

    @Test
    void updatePlan_unknownFeed_throws() {
        when(feedPlanRepository.findById(5L)).thenReturn(Optional.of(existingPlan(5L)));
        when(feedMasterRepository.findById(10L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.updatePlan(5L, updateRequest(10L, 3.0)))
                .isInstanceOf(com.dairy.exception.FeedNotFoundException.class);
    }

    @Test
    void deletePlan_notFound_throws() {
        when(feedPlanRepository.existsById(999L)).thenReturn(false);

        assertThatThrownBy(() -> service.deletePlan(999L)).isInstanceOf(PlanNotFoundException.class);
        verify(feedPlanRepository, never()).deleteById(any());
        verify(feedPlanItemRepository, never()).deleteByFeedPlanId(any());
    }

    @Test
    void deletePlan_removesItemsThenPlan() {
        when(feedPlanRepository.existsById(5L)).thenReturn(true);

        service.deletePlan(5L);

        InOrder inOrder = inOrder(feedPlanItemRepository, feedPlanRepository);
        inOrder.verify(feedPlanItemRepository).deleteByFeedPlanId(5L);
        inOrder.verify(feedPlanRepository).deleteById(5L);
    }
}
