package socket

import (
	"context"
	"encoding/json"
	"testing"
	"time"

	internalRedis "github.com/minakdanCVUT/SP1Team/seatlock_sockets/internal/redis"
)

const hubEventID = "550e8400-e29b-41d4-a716-446655440010"

func startTestHub(t *testing.T, releases <-chan internalRedis.ReleasedSeats) (*Hub, context.CancelFunc) {
	t.Helper()
	ctx, cancel := context.WithCancel(context.Background())
	hub := NewHub(nil, nil, nil, releases)
	go hub.Run(ctx)
	t.Cleanup(func() {
		cancel()
		select {
		case <-hub.done:
		case <-time.After(time.Second):
			t.Fatal("hub did not stop")
		}
	})
	return hub, cancel
}

func newTestClient(eventID string) *Client {
	return &Client{
		eventID: eventID,
		send:    make(chan []byte, 256),
		done:    make(chan struct{}),
	}
}

func TestPendingClientReceivesSnapshotBeforeBufferedEvents(t *testing.T) {
	hub, _ := startTestHub(t, nil)
	client := newTestClient(hubEventID)
	if !hub.RegisterPending(client) {
		t.Fatal("RegisterPending() failed")
	}

	hub.Broadcast(BroadcastMessage{
		EventID: hubEventID,
		Payload: SeatMessage{
			BaseMessage: BaseMessage{Type: TypeReserved},
			SeatID:      socketSeatID,
		},
	})
	snapshot := []byte(`{"type":"snapshot","purchased":[],"myReserved":[],"otherReserved":[]}`)
	if !hub.Activate(client, snapshot) {
		t.Fatal("Activate() failed")
	}

	if got := <-client.send; string(got) != string(snapshot) {
		t.Fatalf("first message = %s, want snapshot", got)
	}
	var buffered SeatMessage
	if err := json.Unmarshal(<-client.send, &buffered); err != nil {
		t.Fatalf("decode buffered event: %v", err)
	}
	if buffered.Type != TypeReserved || buffered.SeatID != socketSeatID {
		t.Fatalf("buffered event = %#v", buffered)
	}
}

func TestHubBroadcastsBackendReleasesIndividually(t *testing.T) {
	releases := make(chan internalRedis.ReleasedSeats, 1)
	hub, _ := startTestHub(t, releases)
	client := newTestClient(hubEventID)
	if !hub.RegisterPending(client) || !hub.Activate(client, []byte(`{"type":"snapshot"}`)) {
		t.Fatal("failed to activate client")
	}
	<-client.send

	secondSeatID := "550e8400-e29b-41d4-a716-446655440011"
	releases <- internalRedis.ReleasedSeats{EventID: hubEventID, SeatIDs: []string{socketSeatID, secondSeatID}}
	for _, wantSeatID := range []string{socketSeatID, secondSeatID} {
		select {
		case payload := <-client.send:
			var message SeatMessage
			if err := json.Unmarshal(payload, &message); err != nil {
				t.Fatalf("decode release: %v", err)
			}
			if message.Type != TypeReleased || message.SeatID != wantSeatID {
				t.Fatalf("release = %#v, want seat %s", message, wantSeatID)
			}
		case <-time.After(time.Second):
			t.Fatalf("timed out waiting for release of %s", wantSeatID)
		}
	}
}
