package socket

import (
	"context"
	"encoding/json"
	"log"
	"time"

	"github.com/gorilla/websocket"
)

const (
	writeWait      = 10 * time.Second
	pongWait       = 60 * time.Second
	pingPeriod     = (pongWait * 9) / 10
	maxMessageSize = 512
)

type Client struct {
	hub     *Hub
	conn    *websocket.Conn
	eventID string
	userID  string
	send    chan []byte
}

func (c *Client) ReadPump() {
	defer func() {
		log.Printf("[WS] disconnect: user=%s event=%s", c.userID, c.eventID)
		c.hub.service.OnDisconnect(context.Background(), c.eventID)
		c.hub.unregister <- c
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
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				log.Printf("error: %v", err)
			}
			break
		}

		var base BaseMessage
		if err := json.Unmarshal(message, &base); err != nil {
			log.Printf("unmarshal error: %v", err)
			continue
		}

		ctx := context.Background()

		switch base.Type {
		case TypeReserve:
			var msg ReserveMessage
			json.Unmarshal(message, &msg)
			success, err := c.hub.service.ReserveSeat(ctx, c.eventID, msg.SeatID, c.userID)
			if err != nil {
				log.Printf("reserve error: %v", err)
				continue
			}

			if success {
				log.Printf("[WS] reserved: user=%s event=%s seat=%s", c.userID, c.eventID, msg.SeatID)
				c.hub.broadcast <- BroadcastMessage{
					EventID: c.eventID,
					Exclude: c,
					Payload: SeatMessage{
						BaseMessage: BaseMessage{Type: TypeReserved},
						SeatID:      msg.SeatID,
					},
				}
			} else {
				log.Printf("[WS] reserve_failed: user=%s event=%s seat=%s", c.userID, c.eventID, msg.SeatID)
				failMsg, _ := json.Marshal(SeatMessage{
					BaseMessage: BaseMessage{Type: TypeReserveFailed},
					SeatID:      msg.SeatID,
				})
				c.send <- failMsg
			}

		case TypeUnreserve:
			var msg UnreserveMessage
			json.Unmarshal(message, &msg)
			ok, err := c.hub.service.UnreserveSeat(ctx, c.eventID, msg.SeatID, c.userID)
			if err != nil {
				log.Printf("unreserve error: %v", err)
				continue
			}

			if ok {
				log.Printf("[WS] unreserved: user=%s event=%s seat=%s", c.userID, c.eventID, msg.SeatID)
				c.hub.broadcast <- BroadcastMessage{
					EventID: c.eventID,
					Payload: SeatMessage{
						BaseMessage: BaseMessage{Type: TypeReleased},
						SeatID:      msg.SeatID,
					},
				}
			}

		case TypePurchased:
			var msg PurchasedMessage
			json.Unmarshal(message, &msg)
			if err := c.hub.service.PurchaseSeats(ctx, c.eventID, msg.SeatIDs); err != nil {
				log.Printf("[WS] purchase error: user=%s event=%s err=%v", c.userID, c.eventID, err)
				continue
			}

			log.Printf("[WS] purchased: user=%s event=%s seats=%v", c.userID, c.eventID, msg.SeatIDs)
			c.hub.broadcast <- BroadcastMessage{
				EventID: c.eventID,
				Exclude: c,
				Payload: PurchasedBulkMessage{
					BaseMessage: BaseMessage{Type: TypePurchasedBulk},
					SeatIDs:     msg.SeatIDs,
				},
			}
		}
	}
}

func (c *Client) WritePump() {
	ticker := time.NewTicker(pingPeriod)
	defer func() {
		ticker.Stop()
		c.conn.Close()
	}()
	for {
		select {
		case message, ok := <-c.send:
			c.conn.SetWriteDeadline(time.Now().Add(writeWait))
			if !ok {
				c.conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}

			w, err := c.conn.NextWriter(websocket.TextMessage)
			if err != nil {
				return
			}
			w.Write(message)

			n := len(c.send)
			for i := 0; i < n; i++ {
				w.Write([]byte{'\n'})
				w.Write(<-c.send)
			}

			if err := w.Close(); err != nil {
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
