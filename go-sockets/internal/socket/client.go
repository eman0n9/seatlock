package socket

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"sync"
	"time"

	"github.com/gorilla/websocket"
	"github.com/minakdanCVUT/SP1Team/seatlock_sockets/internal/service"
	"github.com/minakdanCVUT/SP1Team/seatlock_sockets/internal/validation"
)

const (
	writeWait        = 10 * time.Second
	pongWait         = 60 * time.Second
	pingPeriod       = (pongWait * 9) / 10
	operationTimeout = 5 * time.Second
	maxMessageSize   = 64 * 1024
)

type Client struct {
	hub      *Hub
	conn     *websocket.Conn
	eventID  string
	userID   string
	send     chan []byte
	done     chan struct{}
	stopOnce sync.Once
}

func (c *Client) ReadPump() {
	defer func() {
		log.Printf("[WS] disconnect: user=%s event=%s", c.userID, c.eventID)
		ctx, cancel := context.WithTimeout(context.Background(), operationTimeout)
		defer cancel()
		if err := c.hub.service.OnDisconnect(ctx, c.eventID); err != nil {
			log.Printf("[WS] disconnect cleanup failed: user=%s event=%s err=%v", c.userID, c.eventID, err)
		}
		c.hub.Unregister(c)
		c.conn.Close()
	}()

	c.conn.SetReadLimit(maxMessageSize)
	c.conn.SetReadDeadline(time.Now().Add(pongWait))
	c.conn.SetPongHandler(func(string) error {
		c.conn.SetReadDeadline(time.Now().Add(pongWait))
		return nil
	})

	for {
		_, message, err := c.conn.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseNormalClosure, websocket.CloseGoingAway) {
				log.Printf("[WS] read failed: %v", err)
			}
			break
		}

		decoded, err := decodeClientMessage(message)
		if err != nil {
			c.sendError(err.Error())
			continue
		}

		ctx, cancel := context.WithTimeout(context.Background(), operationTimeout)
		c.handleMessage(ctx, decoded)
		cancel()
	}
}

func (c *Client) handleMessage(ctx context.Context, message any) {
	switch msg := message.(type) {
	case ReserveMessage:
		success, err := c.hub.service.ReserveSeat(ctx, c.eventID, msg.SeatID, c.userID)
		if err != nil {
			log.Printf("[WS] reserve failed: user=%s event=%s seat=%s err=%v", c.userID, c.eventID, msg.SeatID, err)
			if errors.Is(err, service.ErrReservationLimit) {
				c.sendError(fmt.Sprintf("a maximum of %d seats may be reserved", service.MaxHeldSeats))
			} else {
				c.sendError("unable to reserve seat")
			}
			return
		}

		if success {
			log.Printf("[WS] reserved: user=%s event=%s seat=%s", c.userID, c.eventID, msg.SeatID)
			c.hub.Broadcast(BroadcastMessage{
				EventID: c.eventID,
				Exclude: c,
				Payload: SeatMessage{
					BaseMessage: BaseMessage{Type: TypeReserved},
					SeatID:      msg.SeatID,
				},
			})
			return
		}

		log.Printf("[WS] reserve_failed: user=%s event=%s seat=%s", c.userID, c.eventID, msg.SeatID)
		c.sendJSON(SeatMessage{
			BaseMessage: BaseMessage{Type: TypeReserveFailed},
			SeatID:      msg.SeatID,
		})

	case UnreserveMessage:
		ok, err := c.hub.service.UnreserveSeat(ctx, c.eventID, msg.SeatID, c.userID)
		if err != nil {
			log.Printf("[WS] unreserve failed: user=%s event=%s seat=%s err=%v", c.userID, c.eventID, msg.SeatID, err)
			c.sendError("unable to release seat")
			return
		}
		if !ok {
			return
		}

		log.Printf("[WS] unreserved: user=%s event=%s seat=%s", c.userID, c.eventID, msg.SeatID)
		c.hub.Broadcast(BroadcastMessage{
			EventID: c.eventID,
			Payload: SeatMessage{
				BaseMessage: BaseMessage{Type: TypeReleased},
				SeatID:      msg.SeatID,
			},
		})

	}
}

func (c *Client) sendError(message string) {
	c.sendJSON(ErrorMessage{
		BaseMessage: BaseMessage{Type: TypeError},
		Message:     message,
	})
}

func (c *Client) sendJSON(message any) {
	payload, err := json.Marshal(message)
	if err != nil {
		log.Printf("[WS] response encoding failed: %v", err)
		return
	}
	if !c.enqueue(payload) {
		log.Printf("[WS] response queue full: user=%s event=%s", c.userID, c.eventID)
	}
}

func (c *Client) enqueue(payload []byte) bool {
	select {
	case <-c.done:
		return false
	default:
	}

	select {
	case c.send <- payload:
		return true
	case <-c.done:
		return false
	default:
		return false
	}
}

func (c *Client) stop() {
	c.stopOnce.Do(func() {
		close(c.done)
		if c.conn != nil {
			c.conn.Close()
		}
	})
}

func decodeClientMessage(data []byte) (any, error) {
	var base BaseMessage
	if err := json.Unmarshal(data, &base); err != nil {
		return nil, fmt.Errorf("invalid JSON")
	}
	if base.Type == "" {
		return nil, fmt.Errorf("message type is required")
	}

	switch base.Type {
	case TypeReserve:
		var message ReserveMessage
		if err := decodeStrict(data, &message); err != nil {
			return nil, fmt.Errorf("invalid reserve message")
		}
		if !validation.IsUUID(message.SeatID) {
			return nil, fmt.Errorf("seatId must be a UUID")
		}
		return message, nil

	case TypeUnreserve:
		var message UnreserveMessage
		if err := decodeStrict(data, &message); err != nil {
			return nil, fmt.Errorf("invalid unreserve message")
		}
		if !validation.IsUUID(message.SeatID) {
			return nil, fmt.Errorf("seatId must be a UUID")
		}
		return message, nil

	default:
		return nil, fmt.Errorf("unsupported message type")
	}
}

func decodeStrict(data []byte, destination any) error {
	decoder := json.NewDecoder(bytes.NewReader(data))
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(destination); err != nil {
		return err
	}
	if err := decoder.Decode(&struct{}{}); !errors.Is(err, io.EOF) {
		return fmt.Errorf("message must contain exactly one JSON object")
	}
	return nil
}

func (c *Client) WritePump() {
	ticker := time.NewTicker(pingPeriod)
	defer func() {
		ticker.Stop()
		c.conn.Close()
	}()
	for {
		select {
		case <-c.done:
			return
		case message := <-c.send:
			c.conn.SetWriteDeadline(time.Now().Add(writeWait))
			if err := c.conn.WriteMessage(websocket.TextMessage, message); err != nil {
				return
			}
		case <-ticker.C:
			c.conn.SetWriteDeadline(time.Now().Add(writeWait))
			if err := c.conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		}
	}
}
