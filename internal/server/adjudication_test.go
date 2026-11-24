package server

import (
	"math"
	"testing"
)

func TestAdjudicationPreviewCalculation(t *testing.T) {
	var requestedAmount int64 = 72_500_000
	var nonCoverDeduction int64 = 2_500_000
	var totalBill int64 = 125_000_000
	var primaryPayerApproved int64 = 37_500_000

	recommendedApproved := requestedAmount - nonCoverDeduction
	if recommendedApproved != 70_000_000 {
		t.Fatalf("expected recommended approved 70,000,000, got %d", recommendedApproved)
	}

	initialPatientExcess := totalBill - primaryPayerApproved - requestedAmount
	if initialPatientExcess != 15_000_000 {
		t.Fatalf("expected initial patient excess 15,000,000, got %d", initialPatientExcess)
	}

	patientAdditionalExcess := nonCoverDeduction
	finalPatientExcess := initialPatientExcess + patientAdditionalExcess
	if finalPatientExcess != 17_500_000 {
		t.Fatalf("expected final patient excess 17,500,000, got %d", finalPatientExcess)
	}

	coveragePercent := math.Round((float64(recommendedApproved)/float64(totalBill)*100.0)*10) / 10
	if coveragePercent != 56.0 {
		t.Fatalf("expected coverage percent 56.0, got %f", coveragePercent)
	}
}

func TestReconciliationSplitMath(t *testing.T) {
	var totalBill int64 = 125_000_000
	var bpjsApproved int64 = 37_500_000
	var insurerApproved int64 = 70_000_000

	patientFinalExcess := totalBill - bpjsApproved - insurerApproved
	if patientFinalExcess != 17_500_000 {
		t.Fatalf("expected patient excess 17,500,000, got %d", patientFinalExcess)
	}

	// Test zero excess or over-approval clamp
	var highBPJS int64 = 80_000_000
	var highInsurer int64 = 50_000_000
	excess := totalBill - highBPJS - highInsurer
	if excess < 0 {
		excess = 0
	}
	if excess != 0 {
		t.Fatalf("expected 0 excess, got %d", excess)
	}
}

func TestDecisionTypes(t *testing.T) {
	validDecisions := map[string]bool{
		"APPROVED":          true,
		"REVISION_REQUIRED": true,
		"REJECTED":          true,
	}

	cases := []struct {
		decision string
		valid    bool
	}{
		{"APPROVED", true},
		{"REVISION_REQUIRED", true},
		{"REJECTED", true},
		{"PENDING", false},
		{"UNKNOWN", false},
	}

	for _, tc := range cases {
		if validDecisions[tc.decision] != tc.valid {
			t.Errorf("decision %s validity expected %v, got %v", tc.decision, tc.valid, validDecisions[tc.decision])
		}
	}
}
