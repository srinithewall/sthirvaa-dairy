package com.dairy.dto;

import com.dairy.model.HerdWeightRecord;

import java.util.List;

/**
 * The outcome of saving a batch of weight readings: what was stored, how far the round has
 * got, and whether that was enough to close the chore.
 */
public class WeightRoundResult {

    private List<HerdWeightRecord> saved;
    private int measuredCount;
    private int totalCount;
    private boolean roundComplete;
    private boolean taskCompleted;

    public WeightRoundResult() {}

    public WeightRoundResult(List<HerdWeightRecord> saved, int measuredCount, int totalCount,
                             boolean roundComplete, boolean taskCompleted) {
        this.saved = saved;
        this.measuredCount = measuredCount;
        this.totalCount = totalCount;
        this.roundComplete = roundComplete;
        this.taskCompleted = taskCompleted;
    }

    public List<HerdWeightRecord> getSaved() { return saved; }
    public void setSaved(List<HerdWeightRecord> saved) { this.saved = saved; }

    public int getMeasuredCount() { return measuredCount; }
    public void setMeasuredCount(int measuredCount) { this.measuredCount = measuredCount; }

    public int getTotalCount() { return totalCount; }
    public void setTotalCount(int totalCount) { this.totalCount = totalCount; }

    /** True when every active animal has a reading dated on the round's date. */
    public boolean isRoundComplete() { return roundComplete; }
    public void setRoundComplete(boolean roundComplete) { this.roundComplete = roundComplete; }

    /** True when this save closed the chore (or found it already closed). */
    public boolean isTaskCompleted() { return taskCompleted; }
    public void setTaskCompleted(boolean taskCompleted) { this.taskCompleted = taskCompleted; }
}
