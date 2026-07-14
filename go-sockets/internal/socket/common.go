package socket

import (
	"context"
	"encoding/json"
	"log"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/gorilla/websocket"
	"github.com/minakdanCVUT/SP1Team/seatlock_sockets/internal/security"
	"github.com/minakdanCVUT/SP1Team/seatlock_sockets/internal/validation"
)

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin:     isAllowedOrigin,
}

func isAllowedOrigin(r *http.Request) bool {
	origin := r.Header.Get("Origin")
	if origin == "" {
		return true
	}

	configured := os.Getenv("WS_ALLOWED_ORIGINS")
	if configured == "" {
		configured = "http://localhost:3000"
	}

	for allowedOrigin := range strings.SplitSeq(configured, ",") {
		if strings.TrimSpace(allowedOrigin) == origin {
			return true
		}
	}
	return false
}

func ServeWs(hub *Hub, w http.ResponseWriter, r *http.Request) {
	eventId := r.URL.Query().Get("eventId")
	if !validation.IsUUID(eventId) {
		http.Error(w, "eventId must be a UUID", http.StatusBadRequest)
		return
	}

	userID, _ := r.Context().Value(security.UserIDKey).(string)
	if userID == "" {
		http.Error(w, "authentication required", http.StatusUnauthorized)
		return
	}

	log.Printf("[WS] connect: user=%s event=%s", userID, eventId)

	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("[WS] upgrade failed: user=%s event=%s err=%v", userID, eventId, err)
		return
	}

	client := &Client{
		hub:     hub,
		conn:    conn,
		eventID: eventId,
		userID:  userID,
		send:    make(chan []byte, 256),
		done:    make(chan struct{}),
	}
	if !hub.RegisterPending(client) {
		writeConnectionError(conn, "server is shutting down")
		conn.Close()
		return
	}

	connectCtx, connectCancel := context.WithTimeout(r.Context(), operationTimeout)
	snapshot, err := hub.service.OnConnect(connectCtx, eventId, userID)
	connectCancel()
	if err != nil {
		log.Printf("[WS] connect initialization failed: user=%s event=%s err=%v", userID, eventId, err)
		writeConnectionError(conn, "unable to initialize event state")
		hub.Unregister(client)
		return
	}

	myReserved := make([]ReservedSeatDTO, len(snapshot.MyReserved))
	for i, s := range snapshot.MyReserved {
		myReserved[i] = ReservedSeatDTO{SeatID: s.SeatID, TTL: s.TTL}
	}

	snapshotMsg := SnapshotMessage{
		BaseMessage:   BaseMessage{Type: TypeSnapshot},
		Purchased:     append([]string{}, snapshot.Purchased...),
		MyReserved:    myReserved,
		OtherReserved: append([]string{}, snapshot.OtherReserved...),
	}
	payload, err := json.Marshal(snapshotMsg)
	if err != nil {
		log.Printf("[WS] snapshot encoding failed: user=%s event=%s err=%v", userID, eventId, err)
		writeConnectionError(conn, "unable to encode event state")
		ctx, cancel := context.WithTimeout(context.Background(), operationTimeout)
		defer cancel()
		if disconnectErr := hub.service.OnDisconnect(ctx, eventId); disconnectErr != nil {
			log.Printf("[WS] snapshot failure cleanup failed: user=%s event=%s err=%v", userID, eventId, disconnectErr)
		}
		hub.Unregister(client)
		return
	}
	log.Printf("[WS] snapshot sent: user=%s event=%s purchased=%d myReserved=%d otherReserved=%d",
		userID, eventId, len(snapshot.Purchased), len(snapshot.MyReserved), len(snapshot.OtherReserved))
	if !hub.Activate(client, payload) {
		ctx, cancel := context.WithTimeout(context.Background(), operationTimeout)
		defer cancel()
		if disconnectErr := hub.service.OnDisconnect(ctx, eventId); disconnectErr != nil {
			log.Printf("[WS] activation cleanup failed: user=%s event=%s err=%v", userID, eventId, disconnectErr)
		}
		hub.Unregister(client)
		return
	}

	go client.ReadPump()
	go client.WritePump()
}

func writeConnectionError(conn *websocket.Conn, message string) {
	conn.SetWriteDeadline(time.Now().Add(writeWait))
	if err := conn.WriteJSON(ErrorMessage{
		BaseMessage: BaseMessage{Type: TypeError},
		Message:     message,
	}); err != nil {
		log.Printf("[WS] failed to send connection error: %v", err)
	}
}
