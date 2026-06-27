package socket

// Message types
const (
	// Client -> Server
	TypeReserve   = "reserve"
	TypeUnreserve = "unreserve"
	TypePurchased = "purchased"

	// Server -> Client
	TypeSnapshot      = "snapshot"
	TypeReserved      = "reserved"
	TypeReserveFailed = "reserve_failed"
	TypeReleased      = "released"
	TypePurchasedBulk = "purchased_bulk"
	TypeError         = "error"
)

// BaseMessage is the common structure for all WS messages
type BaseMessage struct {
	Type string `json:"type"`
}

// ReserveMessage (Client -> Server)
type ReserveMessage struct {
	BaseMessage
	SeatID string `json:"seatId"`
}

// UnreserveMessage (Client -> Server)
type UnreserveMessage struct {
	BaseMessage
	SeatID string `json:"seatId"`
}

// PurchasedMessage (Client -> Server)
type PurchasedMessage struct {
	BaseMessage
	SeatIDs []string `json:"seatIds"`
}

// ReservedSeatDTO (Server -> Client) — seat with remaining TTL
type ReservedSeatDTO struct {
	SeatID string `json:"seatId"`
	TTL    int64  `json:"ttl"`
}

// SnapshotMessage (Server -> Client)
type SnapshotMessage struct {
	BaseMessage
	Purchased     []string          `json:"purchased"`
	MyReserved    []ReservedSeatDTO `json:"myReserved"`
	OtherReserved []string          `json:"otherReserved"`
}

// SeatMessage (Server -> Client) — single seat event
type SeatMessage struct {
	BaseMessage
	SeatID string `json:"seatId"`
}

// PurchasedBulkMessage (Server -> Client) — batch purchase confirmation
type PurchasedBulkMessage struct {
	BaseMessage
	SeatIDs []string `json:"seatIds"`
}

// ErrorMessage (Server -> Client)
type ErrorMessage struct {
	BaseMessage
	Message string `json:"message"`
}
