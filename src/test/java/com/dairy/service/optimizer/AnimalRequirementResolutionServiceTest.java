package com.dairy.service.optimizer;

import com.dairy.dto.optimizer.RequirementProfileDTO;
import com.dairy.exception.AnimalNotFoundException;
import com.dairy.exception.RequirementNotFoundException;
import com.dairy.model.AnimalRequirement;
import com.dairy.model.Herd;
import com.dairy.repository.AnimalRequirementRepository;
import com.dairy.service.HerdService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AnimalRequirementResolutionServiceTest {

    @Mock
    private HerdService herdService;

    @Mock
    private AnimalStageResolver stageResolver;

    @Mock
    private AnimalRequirementRepository animalRequirementRepository;

    @InjectMocks
    private AnimalRequirementResolutionService service;

    private AnimalRequirement requirement(String stage) {
        AnimalRequirement r = new AnimalRequirement();
        r.setAnimalStage(stage);
        r.setDryMatterIntake(15.0);
        r.setCrudeProteinReq(2.5);
        r.setTdnReq(10.0);
        r.setCalciumReq(50.0);
        return r;
    }

    @Test
    void resolve_animalNotFound_throws() {
        when(herdService.getHerdById(99L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.resolve(99L, null))
                .isInstanceOf(AnimalNotFoundException.class);
    }

    @Test
    void resolve_usesAutoResolvedStage_whenNoOverrideGiven() {
        Herd herd = new Herd();
        herd.setId(1L);
        herd.setAnimalStatus("DRY");
        when(herdService.getHerdById(1L)).thenReturn(Optional.of(herd));
        when(stageResolver.resolveStage(herd)).thenReturn("Dry Cow");
        when(animalRequirementRepository.findMatching(eq("Dry Cow"), any(), any(), any()))
                .thenReturn(List.of(requirement("Dry Cow")));

        RequirementProfileDTO profile = service.resolve(1L, null);

        assertThat(profile.getResolvedStage()).isEqualTo("Dry Cow");
        assertThat(profile.isStageOverridden()).isFalse();
        assertThat(profile.getTargets().get("DryMatter")).isEqualTo(15.0);
    }

    @Test
    void resolve_validOverride_isUsedInsteadOfAutoResolution() {
        Herd herd = new Herd();
        herd.setId(2L);
        herd.setAnimalStatus("LACTATING");
        when(animalRequirementRepository.findByAnimalStage("Peak Lactation")).thenReturn(Optional.of(requirement("Peak Lactation")));
        when(animalRequirementRepository.findMatching(eq("Peak Lactation"), any(), any(), any()))
                .thenReturn(List.of(requirement("Peak Lactation")));

        RequirementProfileDTO profile = service.resolve(herd, "Peak Lactation");

        assertThat(profile.getResolvedStage()).isEqualTo("Peak Lactation");
        assertThat(profile.isStageOverridden()).isTrue();
    }

    @Test
    void resolve_invalidOverride_fallsBackToAutoResolution() {
        Herd herd = new Herd();
        herd.setId(3L);
        herd.setAnimalStatus("LACTATING");
        when(animalRequirementRepository.findByAnimalStage("LACTATING")).thenReturn(Optional.empty()); // the coarse status doesn't match any seeded stage
        when(stageResolver.resolveStage(herd)).thenReturn("Early Lactation");
        when(animalRequirementRepository.findMatching(eq("Early Lactation"), any(), any(), any()))
                .thenReturn(List.of(requirement("Early Lactation")));

        RequirementProfileDTO profile = service.resolve(herd, "LACTATING");

        assertThat(profile.getResolvedStage()).isEqualTo("Early Lactation");
        assertThat(profile.isStageOverridden()).isFalse();
    }

    @Test
    void resolve_noSeededRequirementForStage_throws() {
        Herd herd = new Herd();
        herd.setId(4L);
        when(stageResolver.resolveStage(herd)).thenReturn("Unmapped Stage");
        when(animalRequirementRepository.findMatching(eq("Unmapped Stage"), any(), any(), any())).thenReturn(List.of());
        when(animalRequirementRepository.findByAnimalStage("Unmapped Stage")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.resolve(herd, null))
                .isInstanceOf(RequirementNotFoundException.class);
    }
}
