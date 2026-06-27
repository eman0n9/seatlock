package socket

import (
	"encoding/json"
	"log"

	"github.com/minakdanCVUT/SP1Team/seatlock_sockets/internal/redis"
	"github.com/minakdanCVUT/SP1Team/seatlock_sockets/internal/service"
)

type Hub struct {
	eventRooms map[string]map[*Client]bool
	register   chan *Client
	unregister chan *Client
	broadcast  chan BroadcastMessage
	service    *service.SeatService
	expired    <-chan redis.ExpiredSeat
}

type BroadcastMessage struct {
	EventID string
	Payload interface{}
	Exclude *Client
}

func NewHub(service *service.SeatService, expired <-chan redis.ExpiredSeat) *Hub {
	return &Hub{
		eventRooms: make(map[string]map[*Client]bool),
		register:   make(chan *Client),
		unregister: make(chan *Client),
		broadcast:  make(chan BroadcastMessage),
		service:    service,
		expired:    expired,
	}
}

func (h *Hub) Run() {
	for {
		select {
		case client := <-h.register:
			if h.eventRooms[client.eventID] == nil {
				h.eventRooms[client.eventID] = make(map[*Client]bool)
			}
			h.eventRooms[client.eventID][client] = true

		case client := <-h.unregister:
			if clients, ok := h.eventRooms[client.eventID]; ok {
				if _, ok := clients[client]; ok {
					delete(clients, client)
					close(client.send)
					if len(clients) == 0 {
						delete(h.eventRooms, client.eventID)
					}
				}
			}

		case bm := <-h.broadcast:
			clients := h.eventRooms[bm.EventID]
			message, err := json.Marshal(bm.Payload)
			if err != nil {
				log.Printf("error marshaling broadcast message: %v", err)
				continue
			}
			for client := range clients {
				if client == bm.Exclude {
					continue
				}
				select {
				case client.send <- message:
				default:
					close(client.send)
					delete(clients, client)
				}
			}

		case seat := <-h.expired:
			log.Printf("[WS] ttl expired: event=%s seat=%s", seat.EventID, seat.SeatID)
			clients := h.eventRooms[seat.EventID]
			if len(clients) == 0 {
				continue
			}
			msg := SeatMessage{
				BaseMessage: BaseMessage{Type: TypeReleased},
				SeatID:      seat.SeatID,
			}
			payload, err := json.Marshal(msg)
			if err != nil {
				continue
			}
			for client := range clients {
				select {
				case client.send <- payload:
				default:
					close(client.send)
					delete(clients, client)
				}
			}
		}
	}
}
