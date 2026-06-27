package socket

import (
	"encoding/json"
	"log"
	"net/http"

	"github.com/gorilla/websocket"
	"github.com/minakdanCVUT/SP1Team/seatlock_sockets/internal/security"
)

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin:     func(r *http.Request) bool { return true },
}

func ServeWs(hub *Hub, w http.ResponseWriter, r *http.Request) {
	eventId := r.URL.Query().Get("eventId")
	if eventId == "" {
		http.Error(w, "eventId is required", http.StatusBadRequest)
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
	}

	snapshot, err := hub.service.OnConnect(r.Context(), eventId, userID)
	if err != nil {
		log.Printf("error on connect: %v", err)
		conn.Close()
		return
	}

	myReserved := make([]ReservedSeatDTO, len(snapshot.MyReserved))
	for i, s := range snapshot.MyReserved {
		myReserved[i] = ReservedSeatDTO{SeatID: s.SeatID, TTL: s.TTL}
	}

	snapshotMsg := SnapshotMessage{
		BaseMessage:   BaseMessage{Type: TypeSnapshot},
		Purchased:     snapshot.Purchased,
		MyReserved:    myReserved,
		OtherReserved: snapshot.OtherReserved,
	}
	payload, _ := json.Marshal(snapshotMsg)
	log.Printf("[WS] snapshot sent: user=%s event=%s purchased=%d myReserved=%d otherReserved=%d",
		userID, eventId, len(snapshot.Purchased), len(snapshot.MyReserved), len(snapshot.OtherReserved))
	client.send <- payload

	hub.register <- client

	go client.ReadPump()
	go client.WritePump()
}
