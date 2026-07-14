package service

import (
	"context"
	"errors"
	"testing"

	internalRedis "github.com/minakdanCVUT/SP1Team/seatlock_sockets/internal/redis"
)

const (
	serviceEventID = "550e8400-e29b-41d4-a716-446655440000"
	serviceUserID  = "550e8400-e29b-41d4-a716-446655440001"
	serviceSeatA   = "550e8400-e29b-41d4-a716-446655440002"
	serviceSeatB   = "550e8400-e29b-41d4-a716-446655440003"
	serviceSeatC   = "550e8400-e29b-41d4-a716-446655440004"
)

type fakeSeatRepository struct {
	incrementErr        error
	persistErr          error
	snapshotErr         error
	reconcileErr        error
	snapshot            []internalRedis.SeatInfo
	persistCalls        int
	decrementCalls      int
	decrementTTL        int
	reconciledPurchased []string
	reservationLimitArg int
}

func (r *fakeSeatRepository) IncrementConnections(context.Context, string) (int64, error) {
	return 1, r.incrementErr
}

func (r *fakeSeatRepository) DecrementAndExpire(_ context.Context, _ string, ttl int) (int64, error) {
	r.decrementCalls++
	r.decrementTTL = ttl
	return 0, nil
}

func (r *fakeSeatRepository) PersistEventSeats(context.Context, string) error {
	r.persistCalls++
	return r.persistErr
}

func (r *fakeSeatRepository) GetEventSnapshot(context.Context, string) ([]internalRedis.SeatInfo, error) {
	snapshot := append([]internalRedis.SeatInfo{}, r.snapshot...)
	for _, seatID := range r.reconciledPurchased {
		found := false
		for _, seat := range snapshot {
			if seat.SeatID == seatID && seat.Status == "purchased" {
				found = true
				break
			}
		}
		if !found {
			snapshot = append(snapshot, internalRedis.SeatInfo{SeatID: seatID, Status: "purchased"})
		}
	}
	return snapshot, r.snapshotErr
}

func (r *fakeSeatRepository) ReconcilePurchasedSeats(_ context.Context, _ string, seatIDs []string) error {
	if r.reconcileErr != nil {
		return r.reconcileErr
	}
	r.reconciledPurchased = append([]string{}, seatIDs...)
	return nil
}

func (r *fakeSeatRepository) SetSeatReserved(_ context.Context, _, _, _ string, limit int) (bool, error) {
	r.reservationLimitArg = limit
	return true, nil
}

func (r *fakeSeatRepository) RemoveSeatReservation(context.Context, string, string, string) (bool, error) {
	return true, nil
}

type fakeSeatGRPCClient struct {
	purchased []string
	err       error
	calls     int
}

func (c *fakeSeatGRPCClient) GetPurchasedSeats(context.Context, string) ([]string, error) {
	c.calls++
	return c.purchased, c.err
}

func (c *fakeSeatGRPCClient) Close() error { return nil }

func TestOnConnectRollsBackConnectionWhenInitializationFails(t *testing.T) {
	repo := &fakeSeatRepository{persistErr: errors.New("redis unavailable")}
	service := NewSeatService(repo, &fakeSeatGRPCClient{})

	if _, err := service.OnConnect(context.Background(), serviceEventID, serviceUserID); err == nil {
		t.Fatal("OnConnect() succeeded, want error")
	}
	if repo.decrementCalls != 1 {
		t.Fatalf("DecrementAndExpire() calls = %d, want 1", repo.decrementCalls)
	}
	if repo.decrementTTL != disconnectedCacheTTLSeconds {
		t.Fatalf("cleanup TTL = %d, want %d", repo.decrementTTL, disconnectedCacheTTLSeconds)
	}
}

func TestOnConnectPersistsSeatsForFirstReturningConnection(t *testing.T) {
	repo := &fakeSeatRepository{
		snapshot: []internalRedis.SeatInfo{{SeatID: serviceSeatA, Status: "purchased"}},
	}
	service := NewSeatService(repo, &fakeSeatGRPCClient{})

	snapshot, err := service.OnConnect(context.Background(), serviceEventID, serviceUserID)
	if err != nil {
		t.Fatalf("OnConnect() error = %v", err)
	}
	if repo.persistCalls != 1 {
		t.Fatalf("PersistEventSeats() calls = %d, want 1", repo.persistCalls)
	}
	if repo.decrementCalls != 0 {
		t.Fatalf("unexpected connection rollback calls = %d", repo.decrementCalls)
	}
	if len(snapshot.Purchased) != 1 || snapshot.Purchased[0] != serviceSeatA {
		t.Fatalf("snapshot purchased = %v", snapshot.Purchased)
	}
}

func TestOnConnectReturnsEmptyArraysInsteadOfNil(t *testing.T) {
	repo := &fakeSeatRepository{}
	service := NewSeatService(repo, &fakeSeatGRPCClient{})

	snapshot, err := service.OnConnect(context.Background(), serviceEventID, serviceUserID)
	if err != nil {
		t.Fatalf("OnConnect() error = %v", err)
	}
	if snapshot.Purchased == nil || snapshot.MyReserved == nil || snapshot.OtherReserved == nil {
		t.Fatalf("snapshot contains nil slices: %#v", snapshot)
	}
}

func TestOnConnectReconcilesPurchasedSeatsWithBackendEveryTime(t *testing.T) {
	repo := &fakeSeatRepository{}
	grpcClient := &fakeSeatGRPCClient{
		purchased: []string{serviceSeatA, serviceSeatC, serviceSeatC, "invalid"},
	}
	service := NewSeatService(repo, grpcClient)

	first, err := service.OnConnect(context.Background(), serviceEventID, serviceUserID)
	if err != nil {
		t.Fatalf("first OnConnect() error = %v", err)
	}
	second, err := service.OnConnect(context.Background(), serviceEventID, serviceUserID)
	if err != nil {
		t.Fatalf("second OnConnect() error = %v", err)
	}
	if grpcClient.calls != 2 {
		t.Fatalf("GetPurchasedSeats() calls = %d, want 2", grpcClient.calls)
	}
	if len(repo.reconciledPurchased) != 2 || repo.reconciledPurchased[0] != serviceSeatA || repo.reconciledPurchased[1] != serviceSeatC {
		t.Fatalf("cached purchased seats = %v", repo.reconciledPurchased)
	}
	if len(first.Purchased) != 2 || len(second.Purchased) != 2 {
		t.Fatalf("purchased snapshots = %v and %v", first.Purchased, second.Purchased)
	}
}

func TestReserveSeatPassesConfiguredLimitToRepository(t *testing.T) {
	repo := &fakeSeatRepository{}
	service := NewSeatService(repo, &fakeSeatGRPCClient{})

	ok, err := service.ReserveSeat(context.Background(), serviceEventID, serviceSeatA, serviceUserID)
	if err != nil || !ok {
		t.Fatalf("ReserveSeat() = %v, %v", ok, err)
	}
	if repo.reservationLimitArg != MaxHeldSeats {
		t.Fatalf("reservation limit = %d, want %d", repo.reservationLimitArg, MaxHeldSeats)
	}
}
