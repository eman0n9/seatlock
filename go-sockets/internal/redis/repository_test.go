package redis

import (
	"context"
	"errors"
	"fmt"
	"testing"
	"time"

	miniredis "github.com/alicebob/miniredis/v2"
	goRedis "github.com/redis/go-redis/v9"
)

const (
	testEventID = "550e8400-e29b-41d4-a716-446655440000"
	testUserID  = "550e8400-e29b-41d4-a716-446655440001"
)

func newTestRepository(t *testing.T) (*Repository, *miniredis.Miniredis) {
	t.Helper()
	server := miniredis.RunT(t)
	client := goRedis.NewClient(&goRedis.Options{Addr: server.Addr()})
	t.Cleanup(func() { client.Close() })
	return NewRepository(client), server
}

func seatID(number int) string {
	return fmt.Sprintf("550e8400-e29b-41d4-a716-%012d", number)
}

func TestSetSeatReservedEnforcesPerUserLimit(t *testing.T) {
	repo, _ := newTestRepository(t)
	ctx := context.Background()

	for i := 1; i <= 10; i++ {
		ok, err := repo.SetSeatReserved(ctx, testEventID, seatID(i), testUserID, 10)
		if err != nil || !ok {
			t.Fatalf("reservation %d: ok=%v err=%v", i, ok, err)
		}
	}

	if _, err := repo.SetSeatReserved(ctx, testEventID, seatID(11), testUserID, 10); !errors.Is(err, ErrReservationLimit) {
		t.Fatalf("eleventh reservation error = %v, want ErrReservationLimit", err)
	}

	ok, err := repo.RemoveSeatReservation(ctx, testEventID, seatID(1), testUserID)
	if err != nil || !ok {
		t.Fatalf("RemoveSeatReservation() = %v, %v", ok, err)
	}
	ok, err = repo.SetSeatReserved(ctx, testEventID, seatID(11), testUserID, 10)
	if err != nil || !ok {
		t.Fatalf("reservation after release: ok=%v err=%v", ok, err)
	}
}

func TestReconcilePurchasedSeatsReplacesAuthoritativeStateAndCleansOwnerSet(t *testing.T) {
	repo, server := newTestRepository(t)
	ctx := context.Background()
	seat := seatID(1)

	ok, err := repo.SetSeatReserved(ctx, testEventID, seat, testUserID, 10)
	if err != nil || !ok {
		t.Fatalf("SetSeatReserved() = %v, %v", ok, err)
	}
	if err := repo.ReconcilePurchasedSeats(ctx, testEventID, []string{seat}); err != nil {
		t.Fatalf("ReconcilePurchasedSeats() error = %v", err)
	}

	if got, err := server.Get(seatKey(testEventID, seat)); err != nil || got != "purchased" {
		t.Fatalf("stored seat state = %q, %v", got, err)
	}
	reservationsKey := userReservationsKey(testEventID, testUserID)
	if server.Exists(reservationsKey) {
		isMember, err := server.SIsMember(reservationsKey, seat)
		if err != nil {
			t.Fatalf("SIsMember() error = %v", err)
		}
		if isMember {
			t.Fatal("purchased seat remained in the owner's reservation set")
		}
	}
}

func TestPersistEventSeatsCancelsDisconnectedExpiry(t *testing.T) {
	repo, server := newTestRepository(t)
	ctx := context.Background()
	seat := seatID(1)

	if err := repo.ReconcilePurchasedSeats(ctx, testEventID, []string{seat}); err != nil {
		t.Fatalf("ReconcilePurchasedSeats() error = %v", err)
	}
	server.SetTTL(seatKey(testEventID, seat), time.Minute)
	server.SetTTL(eventSeatsKey(testEventID), time.Minute)

	if err := repo.PersistEventSeats(ctx, testEventID); err != nil {
		t.Fatalf("PersistEventSeats() error = %v", err)
	}
	if ttl := server.TTL(seatKey(testEventID, seat)); ttl != 0 {
		t.Fatalf("seat TTL = %v, want no expiry", ttl)
	}
	if ttl := server.TTL(eventSeatsKey(testEventID)); ttl != 0 {
		t.Fatalf("event set TTL = %v, want no expiry", ttl)
	}
}

func TestExpiredSeatIsRemovedFromEventIndex(t *testing.T) {
	repo, server := newTestRepository(t)
	ctx := context.Background()
	seat := seatID(1)
	server.SAdd(eventSeatsKey(testEventID), seat)

	expired, ok, err := repo.removeExpiredSeatFromEvent(ctx, seatKey(testEventID, seat))
	if err != nil {
		t.Fatalf("removeExpiredSeatFromEvent() error = %v", err)
	}
	if !ok || expired.EventID != testEventID || expired.SeatID != seat {
		t.Fatalf("expired seat = %#v, ok=%v", expired, ok)
	}
	if server.Exists(eventSeatsKey(testEventID)) {
		t.Fatal("expired seat remained in the event index")
	}
}

func TestStaleExpiryDoesNotRemoveFreshSeatState(t *testing.T) {
	repo, server := newTestRepository(t)
	ctx := context.Background()
	seat := seatID(1)
	server.SAdd(eventSeatsKey(testEventID), seat)
	server.Set(seatKey(testEventID, seat), "reserved:"+testUserID)

	_, released, err := repo.removeExpiredSeatFromEvent(ctx, seatKey(testEventID, seat))
	if err != nil {
		t.Fatalf("removeExpiredSeatFromEvent() error = %v", err)
	}
	if released {
		t.Fatal("stale expiry released a fresh reservation")
	}
	member, err := server.SIsMember(eventSeatsKey(testEventID), seat)
	if err != nil || !member {
		t.Fatalf("fresh reservation missing from event index: member=%v err=%v", member, err)
	}

	server.Set(seatKey(testEventID, seat), "purchased")
	_, released, err = repo.removeExpiredSeatFromEvent(ctx, seatKey(testEventID, seat))
	if err != nil {
		t.Fatalf("removeExpiredSeatFromEvent() purchased error = %v", err)
	}
	if released {
		t.Fatal("stale expiry released a purchased seat")
	}
}

func TestSubscribeToPurchasesValidatesAndForwardsBackendEvents(t *testing.T) {
	repo, _ := newTestRepository(t)
	ctx, cancel := context.WithTimeout(context.Background(), time.Second)
	defer cancel()

	purchases, err := repo.SubscribeToPurchases(ctx)
	if err != nil {
		t.Fatalf("SubscribeToPurchases() error = %v", err)
	}
	seat := seatID(1)
	if err := repo.client.Publish(ctx, "seatlock:purchases:"+testEventID, seat).Err(); err != nil {
		t.Fatalf("Publish() error = %v", err)
	}

	select {
	case purchase := <-purchases:
		if purchase.EventID != testEventID || len(purchase.SeatIDs) != 1 || purchase.SeatIDs[0] != seat {
			t.Fatalf("purchase = %#v", purchase)
		}
	case <-ctx.Done():
		t.Fatal("timed out waiting for purchase event")
	}
}

func TestSubscribeToReleasesValidatesAndForwardsBackendEvents(t *testing.T) {
	repo, _ := newTestRepository(t)
	ctx, cancel := context.WithTimeout(context.Background(), time.Second)
	defer cancel()

	releases, err := repo.SubscribeToReleases(ctx)
	if err != nil {
		t.Fatalf("SubscribeToReleases() error = %v", err)
	}
	seat := seatID(2)
	if err := repo.client.Publish(ctx, "seatlock:releases:"+testEventID, seat).Err(); err != nil {
		t.Fatalf("Publish() error = %v", err)
	}

	select {
	case release := <-releases:
		if release.EventID != testEventID || len(release.SeatIDs) != 1 || release.SeatIDs[0] != seat {
			t.Fatalf("release = %#v", release)
		}
	case <-ctx.Done():
		t.Fatal("timed out waiting for release event")
	}
}

func TestRecoverStaleConnectionsExpiresOnlyRecoveredEventCache(t *testing.T) {
	repo, server := newTestRepository(t)
	ctx := context.Background()
	seat := seatID(1)
	server.Set(connectionsKey(testEventID), "3")
	server.Set(seatKey(testEventID, seat), "purchased")
	server.SAdd(eventSeatsKey(testEventID), seat)
	server.Set("unrelated", "value")

	recovered, err := repo.RecoverStaleConnections(ctx, 1800)
	if err != nil {
		t.Fatalf("RecoverStaleConnections() error = %v", err)
	}
	if recovered != 1 {
		t.Fatalf("recovered = %d, want 1", recovered)
	}
	if server.Exists(connectionsKey(testEventID)) {
		t.Fatal("stale connection counter was not removed")
	}
	if ttl := server.TTL(seatKey(testEventID, seat)); ttl != 30*time.Minute {
		t.Fatalf("purchased seat TTL = %v, want 30m", ttl)
	}
	if ttl := server.TTL(eventSeatsKey(testEventID)); ttl != 30*time.Minute {
		t.Fatalf("event index TTL = %v, want 30m", ttl)
	}
	if got, err := server.Get("unrelated"); err != nil || got != "value" {
		t.Fatalf("unrelated key = %q, %v", got, err)
	}
}
