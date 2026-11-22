package contracts

import "time"

type ClaimBundle struct {
	ResourceType        string                   `json:"resourceType"`
	ClaimID             string                   `json:"claimId"`
	CaseNumber          string                   `json:"caseNumber"`
	PayerTier           string                   `json:"payerTier"`
	SimulationMode      string                   `json:"simulationMode"`
	Patient             map[string]interface{}   `json:"patient"`
	Coverage            map[string]interface{}   `json:"coverage"`
	Clinical            map[string]interface{}   `json:"clinical"`
	Financial           map[string]interface{}   `json:"financial"`
	SupportingDocuments []map[string]interface{} `json:"supportingDocuments"`
}

type ClaimResponseBundle struct {
	ResourceType      string                   `json:"resourceType"`
	ClaimID           string                   `json:"claimId"`
	CaseNumber        string                   `json:"caseNumber"`
	PayerType         string                   `json:"payerType"`
	Decision          string                   `json:"decision"`
	RequestedAmount   int64                    `json:"requestedAmount"`
	ApprovedAmount    int64                    `json:"approvedAmount"`
	NonCoverDeduction int64                    `json:"nonCoverDeduction"`
	DeductionReason   string                   `json:"deductionReason"`
	ReviewerName      string                   `json:"reviewerName"`
	ReviewerNotes     string                   `json:"reviewerNotes"`
	DocumentReviews   []map[string]interface{} `json:"documentReviews"`
	DecidedAt         time.Time                `json:"decidedAt"`
}

type CommunicationMessage struct {
	ResourceType string    `json:"resourceType"`
	ClaimID      string    `json:"claimId"`
	CaseNumber   string    `json:"caseNumber"`
	SenderRole   string    `json:"senderRole"`
	SenderName   string    `json:"senderName"`
	Message      string    `json:"message"`
	SentAt       time.Time `json:"sentAt"`
}
