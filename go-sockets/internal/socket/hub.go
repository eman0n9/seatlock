package socket

import (
	"context"
	"encoding/json"
	"log"

	"github.com/minakdanCVUT/SP1Team/seatlock_sockets/internal/redis"
	"github.com/minakdanCVUT/SP1Team/seatlock_sockets/internal/service"
)

const maxPendingMessages = 255

type clientState struct {
	active  bool
	pending [][]byte
}

type registerRequest struct {
	client *Client
	done   chan struct{}
}

type activateRequest struct {
	client   *Client
	snapshot []byte
	result   chan bool
}

type Hub struct {
	eventRooms map[string]map[*Client]*clientState
	register   chan registerRequest
	activate   chan activateRequest
	unregister chan *Client
	broadcast  chan BroadcastMessage
	done       chan struct{}
	service    *service.SeatService
	expired    <-chan redis.ExpiredSeat
	purchases  <-chan redis.PurchasedSeats
	releases   <-chan redis.ReleasedSeats
}

type BroadcastMessage struct {
	EventID string
	Payload interface{}
	Exclude *Client
}

func NewHub(
	service *service.SeatService,
	expired <-chan redis.ExpiredSeat,
	purchases <-chan redis.PurchasedSeats,
	releases <-chan redis.ReleasedSeats,
) *Hub {
	return &Hub{
		eventRooms: make(map[string]map[*Client]*clientState),
		register:   make(chan registerRequest),
		activate:   make(chan activateRequest),
		unregister: make(chan *Client),
		broadcast:  make(chan BroadcastMessage),
		done:       make(chan struct{}),
		service:    service,
		expired:    expired,
		purchases:  purchases,
		releases:   releases,
	}
}

func (h *Hub) Run(ctx context.Context) {
	defer close(h.done)
	defer h.closeAllClients()

	for {
		select {
		case <-ctx.Done():
			return

		case request := <-h.register:
			if h.eventRooms[request.client.eventID] == nil {
				h.eventRooms[request.client.eventID] = make(map[*Client]*clientState)
			}
			h.eventRooms[request.client.eventID][request.client] = &clientState{}
			close(request.done)

		case request := <-h.activate:
			request.result <- h.activateClient(request.client, request.snapshot)

		case client := <-h.unregister:
			h.removeClient(client)

		case message := <-h.broadcast:
			h.broadcastMessage(message)

		case seat, ok := <-h.expired:
			if !ok {
				h.expired = nil
				continue
			}
			log.Printf("[WS] ttl expired: event=%s seat=%s", seat.EventID, seat.SeatID)
			h.broadcastReleased(seat.EventID, []string{seat.SeatID})

		case purchase, ok := <-h.purchases:
			if !ok {
				h.purchases = nil
				continue
			}
			h.broadcastToEvent(purchase.EventID, PurchasedBulkMessage{
				BaseMessage: BaseMessage{Type: TypePurchasedBulk},
				SeatIDs:     purchase.SeatIDs,
			})

		case release, ok := <-h.releases:
			if !ok {
				h.releases = nil
				continue
			}
			h.broadcastReleased(release.EventID, release.SeatIDs)
		}
	}
}

// RegisterPending registers the client before the snapshot is read. Event
// messages are buffered by the hub until Activate queues the snapshot first.
func (h *Hub) RegisterPending(client *Client) bool {
	done := make(chan struct{})
	select {
	case h.register <- registerRequest{client: client, done: done}:
	case <-h.done:
		return false
	}

	select {
	case <-done:
		return true
	case <-h.done:
		return false
	}
}

func (h *Hub) Activate(client *Client, snapshot []byte) bool {
	result := make(chan bool, 1)
	select {
	case h.activate <- activateRequest{client: client, snapshot: snapshot, result: result}:
	case <-h.done:
		return false
	}

	select {
	case active := <-result:
		return active
	case <-h.done:
		return false
	}
}

func (h *Hub) Unregister(client *Client) {
	select {
	case h.unregister <- client:
	case <-h.done:
		client.stop()
	}
}

func (h *Hub) Broadcast(message BroadcastMessage) bool {
	select {
	case h.broadcast <- message:
		return true
	case <-h.done:
		return false
	}
}

func (h *Hub) activateClient(client *Client, snapshot []byte) bool {
	state, ok := h.eventRooms[client.eventID][client]
	if !ok || state.active {
		return false
	}

	if !client.enqueue(snapshot) {
		h.removeClient(client)
		return false
	}
	for _, message := range state.pending {
		if !client.enqueue(message) {
			h.removeClient(client)
			return false
		}
	}
	state.pending = nil
	state.active = true
	return true
}

func (h *Hub) broadcastMessage(message BroadcastMessage) {
	payload, err := json.Marshal(message.Payload)
	if err != nil {
		log.Printf("error marshaling broadcast message: %v", err)
		return
	}
	h.deliverToEvent(message.EventID, payload, message.Exclude)
}

func (h *Hub) broadcastReleased(eventID string, seatIDs []string) {
	for _, seatID := range seatIDs {
		h.broadcastToEvent(eventID, SeatMessage{
			BaseMessage: BaseMessage{Type: TypeReleased},
			SeatID:      seatID,
		})
	}
}

func (h *Hub) broadcastToEvent(eventID string, message any) {
	payload, err := json.Marshal(message)
	if err != nil {
		log.Printf("error marshaling event message: %v", err)
		return
	}
	h.deliverToEvent(eventID, payload, nil)
}

func (h *Hub) deliverToEvent(eventID string, payload []byte, exclude *Client) {
	for client, state := range h.eventRooms[eventID] {
		if client == exclude {
			continue
		}
		if !state.active {
			if len(state.pending) >= maxPendingMessages {
				h.removeClient(client)
				continue
			}
			state.pending = append(state.pending, payload)
			continue
		}
		if !client.enqueue(payload) {
			h.removeClient(client)
		}
	}
}

func (h *Hub) removeClient(client *Client) {
	clients, ok := h.eventRooms[client.eventID]
	if !ok {
		client.stop()
		return
	}
	if _, ok := clients[client]; !ok {
		client.stop()
		return
	}
	delete(clients, client)
	client.stop()
	if len(clients) == 0 {
		delete(h.eventRooms, client.eventID)
	}
}

func (h *Hub) closeAllClients() {
	for _, clients := range h.eventRooms {
		for client := range clients {
			client.stop()
		}
	}
}
