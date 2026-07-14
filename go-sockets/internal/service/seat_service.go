package service

import (
	"context"
	"fmt"
	"log"
	"time"

	internalGrpc "github.com/minakdanCVUT/SP1Team/seatlock_sockets/internal/grpc"
	internalRedis "github.com/minakdanCVUT/SP1Team/seatlock_sockets/internal/redis"
	"github.com/minakdanCVUT/SP1Team/seatlock_sockets/internal/validation"
)

const (
	MaxHeldSeats                = 10
	disconnectedCacheTTLSeconds = 1800
	connectionCleanupTimeout    = 2 * time.Second
)

var ErrReservationLimit = internalRedis.ErrReservationLimit

type seatRepository interface {
	IncrementConnections(ctx context.Context, eventID string) (int64, error)
	DecrementAndExpire(ctx context.Context, eventID string, ttlSeconds int) (int64, error)
	PersistEventSeats(ctx context.Context, eventID string) error
	GetEventSnapshot(ctx context.Context, eventID string) ([]internalRedis.SeatInfo, error)
	ReconcilePurchasedSeats(ctx context.Context, eventID string, seatIDs []string) error
	SetSeatReserved(ctx context.Context, eventID, seatID, userID string, limit int) (bool, error)
	RemoveSeatReservation(ctx context.Context, eventID, seatID, userID string) (bool, error)
}

type SeatService struct {
	repo       seatRepository
	grpcClient internalGrpc.SeatClient
}

func NewSeatService(repo seatRepository, grpcClient internalGrpc.SeatClient) *SeatService {
	return &SeatService{
		repo:       repo,
		grpcClient: grpcClient,
	}
}

type ReservedSeat struct {
	SeatID string
	TTL    int64
}

type Snapshot struct {
	Purchased     []string
	MyReserved    []ReservedSeat
	OtherReserved []string
}

func (s *SeatService) OnConnect(ctx context.Context, eventID, userID string) (*Snapshot, error) {
	if !validation.IsUUID(eventID) {
		return nil, fmt.Errorf("invalid event ID")
	}
	if userID == "" {
		return nil, fmt.Errorf("user ID is required")
	}

	if _, err := s.repo.IncrementConnections(ctx, eventID); err != nil {
		return nil, err
	}

	connected := false
	defer func() {
		if connected {
			return
		}
		cleanupCtx, cancel := context.WithTimeout(context.Background(), connectionCleanupTimeout)
		defer cancel()
		if _, err := s.repo.DecrementAndExpire(cleanupCtx, eventID, disconnectedCacheTTLSeconds); err != nil {
			log.Printf("failed to roll back connection count for event %s: %v", eventID, err)
		}
	}()

	// A reconnect must cancel the expiry scheduled when the last client left,
	// including when this is the first returning connection.
	if err := s.repo.PersistEventSeats(ctx, eventID); err != nil {
		return nil, err
	}

	// Spring owns the durable purchase state. Reconcile on every connection so
	// a failed after-commit Redis publication cannot leave a seat reservable.
	if _, err := s.syncPurchasedFromBackend(ctx, eventID); err != nil {
		return nil, err
	}

	seats, err := s.repo.GetEventSnapshot(ctx, eventID)
	if err != nil {
		return nil, err
	}

	snapshot := &Snapshot{
		Purchased:     make([]string, 0),
		MyReserved:    make([]ReservedSeat, 0),
		OtherReserved: make([]string, 0),
	}
	for _, seat := range seats {
		switch seat.Status {
		case "purchased":
			snapshot.Purchased = append(snapshot.Purchased, seat.SeatID)
		case "reserved":
			if seat.UserID == userID {
				snapshot.MyReserved = append(snapshot.MyReserved, ReservedSeat{SeatID: seat.SeatID, TTL: seat.TTL})
			} else {
				snapshot.OtherReserved = append(snapshot.OtherReserved, seat.SeatID)
			}
		}
	}

	connected = true
	return snapshot, nil
}

func (s *SeatService) ReserveSeat(ctx context.Context, eventID, seatID, userID string) (bool, error) {
	if err := validateSeatOperation(eventID, seatID, userID); err != nil {
		return false, err
	}
	return s.repo.SetSeatReserved(ctx, eventID, seatID, userID, MaxHeldSeats)
}

func (s *SeatService) UnreserveSeat(ctx context.Context, eventID, seatID, userID string) (bool, error) {
	if err := validateSeatOperation(eventID, seatID, userID); err != nil {
		return false, err
	}
	return s.repo.RemoveSeatReservation(ctx, eventID, seatID, userID)
}

func (s *SeatService) OnDisconnect(ctx context.Context, eventID string) error {
	if !validation.IsUUID(eventID) {
		return fmt.Errorf("invalid event ID")
	}
	_, err := s.repo.DecrementAndExpire(ctx, eventID, disconnectedCacheTTLSeconds)
	return err
}

func (s *SeatService) syncPurchasedFromBackend(ctx context.Context, eventID string) ([]string, error) {
	seatIDs, err := s.grpcClient.GetPurchasedSeats(ctx, eventID)
	if err != nil {
		return nil, err
	}

	seen := make(map[string]struct{}, len(seatIDs))
	purchased := make([]string, 0, len(seatIDs))
	for _, seatID := range seatIDs {
		if !validation.IsUUID(seatID) {
			log.Printf("Spring returned invalid seat ID for event %s; ignoring it", eventID)
			continue
		}
		if _, exists := seen[seatID]; exists {
			continue
		}
		seen[seatID] = struct{}{}
		purchased = append(purchased, seatID)
	}
	if err := s.repo.ReconcilePurchasedSeats(ctx, eventID, purchased); err != nil {
		return nil, err
	}
	return purchased, nil
}

func validateSeatOperation(eventID, seatID, userID string) error {
	if !validation.IsUUID(eventID) {
		return fmt.Errorf("invalid event ID")
	}
	if !validation.IsUUID(seatID) {
		return fmt.Errorf("invalid seat ID")
	}
	if userID == "" {
		return fmt.Errorf("user ID is required")
	}
	return nil
}
