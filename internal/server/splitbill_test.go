package server

import "testing"

func TestCalculateSplitPercentage(t *testing.T) {
	got, err := calculateSplit("COB", 125_000_000, 50_000_000, splitInput{
		SplitMethod: "PERCENTAGE", BPJSPercent: 30, InsurerPercent: 58, PatientPercent: 12,
	})
	if err != nil {
		t.Fatal(err)
	}
	if got.BPJSEstimated != 37_500_000 || got.InsurerEstimated != 72_500_000 || got.PatientEstimated != 15_000_000 {
		t.Fatalf("unexpected allocation: %+v", got)
	}
}

func TestCalculateSplitNominalLeavesRemainderToPatient(t *testing.T) {
	bpjs, insurer := int64(40_000_000), int64(65_000_000)
	got, err := calculateSplit("COB", 125_000_000, 0, splitInput{
		SplitMethod: "NOMINAL", CustomBPJSAmount: &bpjs, CustomInsurerAmount: &insurer,
	})
	if err != nil {
		t.Fatal(err)
	}
	if got.PatientEstimated != 20_000_000 || got.BPJSEstimated != bpjs || got.InsurerEstimated != insurer {
		t.Fatalf("unexpected allocation: %+v", got)
	}
}

func TestCalculateSplitNonCOBForcesInsurerToZero(t *testing.T) {
	got, err := calculateSplit("NON_COB", 125_000_000, 0, splitInput{
		SplitMethod: "PERCENTAGE", BPJSPercent: 30, InsurerPercent: 58, PatientPercent: 12,
	})
	if err != nil {
		t.Fatal(err)
	}
	if got.InsurerEstimated != 0 || got.InsurerPercent != 0 || got.PatientEstimated != 87_500_000 {
		t.Fatalf("unexpected NON_COB allocation: %+v", got)
	}
}

func TestCalculateSplitRejectsOverAllocation(t *testing.T) {
	_, err := calculateSplit("COB", 100, 0, splitInput{
		SplitMethod: "PERCENTAGE", BPJSPercent: 70, InsurerPercent: 40,
	})
	if err == nil {
		t.Fatal("expected percentage over-allocation to fail")
	}
}

func TestAllocateByWeightKeepsPayerSharesWithinEachItem(t *testing.T) {
	bpjs, err := allocateByWeight([]int64{1, 1}, 1)
	if err != nil {
		t.Fatal(err)
	}
	available := []int64{1 - bpjs[0], 1 - bpjs[1]}
	insurer, err := allocateByWeight(available, 1)
	if err != nil {
		t.Fatal(err)
	}
	for index := range bpjs {
		if bpjs[index]+insurer[index] > 1 {
			t.Fatalf("payer allocations exceed item %d: BPJS=%d insurer=%d", index, bpjs[index], insurer[index])
		}
	}
	if bpjs[0]+bpjs[1] != 1 || insurer[0]+insurer[1] != 1 {
		t.Fatalf("payer totals were not conserved: bpjs=%v insurer=%v", bpjs, insurer)
	}
}
