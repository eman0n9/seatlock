package socket

import (
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"

	"github.com/gorilla/websocket"
)

const socketSeatID = "550e8400-e29b-41d4-a716-446655440000"

func TestDecodeClientMessage(t *testing.T) {
	decoded, err := decodeClientMessage([]byte(fmt.Sprintf(`{"type":"reserve","seatId":%q}`, socketSeatID)))
	if err != nil {
		t.Fatalf("decodeClientMessage() error = %v", err)
	}
	message, ok := decoded.(ReserveMessage)
	if !ok || message.SeatID != socketSeatID {
		t.Fatalf("decoded message = %#v", decoded)
	}
}

func TestDecodeClientMessageRejectsInvalidPayloads(t *testing.T) {
	validSeat := fmt.Sprintf(`{"type":"reserve","seatId":%q}`, socketSeatID)
	tests := []struct {
		name    string
		payload string
	}{
		{name: "malformed JSON", payload: `{"type":`},
		{name: "missing type", payload: `{}`},
		{name: "unknown type", payload: `{"type":"lock"}`},
		{name: "missing seat", payload: `{"type":"reserve"}`},
		{name: "invalid UUID", payload: `{"type":"reserve","seatId":"seat-1"}`},
		{name: "unknown field", payload: fmt.Sprintf(`{"type":"reserve","seatId":%q,"extra":true}`, socketSeatID)},
		{name: "multiple objects", payload: validSeat + validSeat},
		{name: "client purchase notification", payload: `{"type":"purchased","seatIds":[]}`},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if _, err := decodeClientMessage([]byte(tt.payload)); err == nil {
				t.Fatalf("decodeClientMessage(%s) succeeded, want error", tt.payload)
			}
		})
	}
}

func TestWritePumpSendsOneJSONDocumentPerFrame(t *testing.T) {
	serverErr := make(chan error, 1)
	done := make(chan struct{})
	stopClient := make(chan struct{})
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		conn, err := upgrader.Upgrade(w, r, nil)
		if err != nil {
			serverErr <- err
			close(done)
			return
		}

		client := &Client{conn: conn, send: make(chan []byte, 2), done: make(chan struct{})}
		client.send <- []byte(`{"type":"first"}`)
		client.send <- []byte(`{"type":"second"}`)
		pumpDone := make(chan struct{})
		go func() {
			client.WritePump()
			close(pumpDone)
		}()
		<-stopClient
		client.stop()
		<-pumpDone
		close(done)
	}))
	defer server.Close()

	wsURL := "ws" + strings.TrimPrefix(server.URL, "http")
	conn, _, err := websocket.DefaultDialer.Dial(wsURL, nil)
	if err != nil {
		t.Fatalf("websocket dial error = %v", err)
	}
	defer conn.Close()

	want := []string{`{"type":"first"}`, `{"type":"second"}`}
	for _, expected := range want {
		messageType, payload, err := conn.ReadMessage()
		if err != nil {
			t.Fatalf("ReadMessage() error = %v", err)
		}
		if messageType != websocket.TextMessage {
			t.Fatalf("message type = %d, want text", messageType)
		}
		if string(payload) != expected {
			t.Fatalf("frame payload = %q, want %q", payload, expected)
		}
	}
	close(stopClient)

	<-done
	select {
	case err := <-serverErr:
		t.Fatalf("server error = %v", err)
	default:
	}
}

func TestEnqueueIsSafeWhileClientStops(t *testing.T) {
	client := &Client{send: make(chan []byte, 1), done: make(chan struct{})}
	var workers sync.WaitGroup
	for i := 0; i < 20; i++ {
		workers.Add(1)
		go func() {
			defer workers.Done()
			for j := 0; j < 100; j++ {
				client.enqueue([]byte(`{"type":"test"}`))
			}
		}()
	}
	client.stop()
	workers.Wait()
	if client.enqueue([]byte(`{"type":"late"}`)) {
		t.Fatal("enqueue succeeded after stop")
	}
}

func TestWebSocketMessageLimit(t *testing.T) {
	if maxMessageSize != 64*1024 {
		t.Fatalf("maxMessageSize = %d, want %d", maxMessageSize, 64*1024)
	}
}

func TestAllowedWebSocketOrigins(t *testing.T) {
	t.Setenv("WS_ALLOWED_ORIGINS", "https://seatlock.example.com, https://admin.seatlock.example.com")

	allowed := httptest.NewRequest(http.MethodGet, "/ws", nil)
	allowed.Header.Set("Origin", "https://seatlock.example.com")
	if !isAllowedOrigin(allowed) {
		t.Fatal("configured origin was rejected")
	}

	rejected := httptest.NewRequest(http.MethodGet, "/ws", nil)
	rejected.Header.Set("Origin", "https://example.net")
	if isAllowedOrigin(rejected) {
		t.Fatal("unconfigured origin was accepted")
	}
}
