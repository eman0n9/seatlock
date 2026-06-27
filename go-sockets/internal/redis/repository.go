package redis

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/redis/go-redis/v9"
)

type Repository struct {
	client *redis.Client
}

func NewRepository(client *redis.Client) *Repository {
	return &Repository{client: client}
}

// Key helpers
func seatKey(eventId, seatId string) string {
	return fmt.Sprintf("seat:%s:%s", eventId, seatId)
}

func eventSeatsKey(eventId string) string {
	return fmt.Sprintf("event_seats:%s", eventId)
}

func connectionsKey(eventId string) string {
	return fmt.Sprintf("connections:%s", eventId)
}

func grpcSyncedKey(eventId string) string {
	return fmt.Sprintf("grpc_synced:%s", eventId)
}

func (r *Repository) IncrementConnections(ctx context.Context, eventId string) (int64, error) {
	return r.client.Incr(ctx, connectionsKey(eventId)).Result()
}

func (r *Repository) MarkGRPCSynced(ctx context.Context, eventId string) error {
	return r.client.Set(ctx, grpcSyncedKey(eventId), "1", 0).Err()
}

func (r *Repository) IsGRPCSynced(ctx context.Context, eventId string) (bool, error) {
	err := r.client.Get(ctx, grpcSyncedKey(eventId)).Err()
	if errors.Is(err, redis.Nil) {
		return false, nil
	}
	return err == nil, err
}

func (r *Repository) GetConnections(ctx context.Context, eventId string) (int64, error) {
	val, err := r.client.Get(ctx, connectionsKey(eventId)).Int64()
	if errors.Is(err, redis.Nil) {
		return 0, nil
	}
	return val, err
}

func (r *Repository) SetSeatPurchased(ctx context.Context, eventId, seatId string) error {
	pipe := r.client.Pipeline()
	pipe.Set(ctx, seatKey(eventId, seatId), "purchased", 0)
	pipe.SAdd(ctx, eventSeatsKey(eventId), seatId)
	pipe.Persist(ctx, seatKey(eventId, seatId))
	_, err := pipe.Exec(ctx)
	return err
}

func (r *Repository) SetSeatReserved(ctx context.Context, eventId, seatId, userId string) (bool, error) {
	key := seatKey(eventId, seatId)
	val := "reserved:" + userId

	ok, err := r.client.SetNX(ctx, key, val, 600*time.Second).Result()
	if err != nil {
		return false, err
	}

	if !ok {
		existing, err := r.client.Get(ctx, key).Result()
		if err != nil {
			return false, err
		}
		if existing == val {
			return true, nil
		}
		return false, nil
	}

	r.client.SAdd(ctx, eventSeatsKey(eventId), seatId)
	return true, nil
}

type SeatInfo struct {
	SeatID string
	Status string // "purchased", "reserved"
	UserID string // only for reserved
	TTL    int64  // seconds remaining, -1 if no expiry
}

func (r *Repository) GetEventSnapshot(ctx context.Context, eventId string) ([]SeatInfo, error) {
	seats, err := r.client.SMembers(ctx, eventSeatsKey(eventId)).Result()
	if err != nil {
		return nil, err
	}

	if len(seats) == 0 {
		return nil, nil
	}

	pipe := r.client.Pipeline()
	getCmds := make([]*redis.StringCmd, len(seats))
	ttlCmds := make([]*redis.DurationCmd, len(seats))
	for i, seatId := range seats {
		key := seatKey(eventId, seatId)
		getCmds[i] = pipe.Get(ctx, key)
		ttlCmds[i] = pipe.TTL(ctx, key)
	}
	_, err = pipe.Exec(ctx)
	if err != nil && !errors.Is(err, redis.Nil) {
		return nil, err
	}

	var result []SeatInfo
	for i, cmd := range getCmds {
		val, err := cmd.Result()
		if errors.Is(err, redis.Nil) || val == "" {
			continue
		}

		ttl := int64(ttlCmds[i].Val().Seconds())

		if val == "purchased" {
			result = append(result, SeatInfo{SeatID: seats[i], Status: "purchased", TTL: ttl})
		} else if uid, ok := strings.CutPrefix(val, "reserved:"); ok {
			result = append(result, SeatInfo{SeatID: seats[i], Status: "reserved", UserID: uid, TTL: ttl})
		}
	}
	return result, nil
}

func (r *Repository) PersistEventSeats(ctx context.Context, eventId string) error {
	seats, err := r.client.SMembers(ctx, eventSeatsKey(eventId)).Result()
	if err != nil {
		return err
	}

	if len(seats) == 0 {
		return nil
	}

	pipe := r.client.Pipeline()
	cmds := make([]*redis.StringCmd, len(seats))
	for i, seatId := range seats {
		cmds[i] = pipe.Get(ctx, seatKey(eventId, seatId))
	}
	_, err = pipe.Exec(ctx)
	if err != nil && !errors.Is(err, redis.Nil) {
		return err
	}

	pipe2 := r.client.Pipeline()
	for i, cmd := range cmds {
		val, _ := cmd.Result()
		if val == "purchased" {
			pipe2.Persist(ctx, seatKey(eventId, seats[i]))
		}
	}
	_, err = pipe2.Exec(ctx)
	return err
}

// Lua Script: remove reservation only if owned by this user
const unreserveLua = `
local val = redis.call('GET', KEYS[1])
if val == ARGV[1] then
  redis.call('DEL', KEYS[1])
  redis.call('SREM', KEYS[2], ARGV[2])
  return 1
end
return 0
`

func (r *Repository) RemoveSeatReservation(ctx context.Context, eventId, seatId, userId string) (bool, error) {
	keys := []string{seatKey(eventId, seatId), eventSeatsKey(eventId)}
	result, err := r.client.Eval(ctx, unreserveLua, keys, "reserved:"+userId, seatId).Int64()
	if err != nil {
		return false, err
	}
	return result == 1, nil
}

type ExpiredSeat struct {
	EventID string
	SeatID  string
}

func (r *Repository) SubscribeToExpirations(ctx context.Context) (<-chan ExpiredSeat, error) {
	if err := r.client.ConfigSet(ctx, "notify-keyspace-events", "Ex").Err(); err != nil {
		return nil, fmt.Errorf("enable keyspace notifications: %w", err)
	}

	sub := r.client.PSubscribe(ctx, "__keyevent@0__:expired")
	ch := make(chan ExpiredSeat, 64)

	go func() {
		defer close(ch)
		defer sub.Close()

		for {
			msg, err := sub.ReceiveMessage(ctx)
			if err != nil {
				if ctx.Err() != nil {
					return
				}
				continue
			}

			// msg.Payload = "seat:{eventId}:{seatId}"
			parts := strings.SplitN(msg.Payload, ":", 3)
			if len(parts) != 3 || parts[0] != "seat" {
				continue
			}

			select {
			case ch <- ExpiredSeat{EventID: parts[1], SeatID: parts[2]}:
			case <-ctx.Done():
				return
			}
		}
	}()

	return ch, nil
}

// Lua Script: DECR connections and if 0, set EXPIRE on purchased seats only
const decrAndExpireLua = `
local count = redis.call('DECR', KEYS[1])
if count <= 0 then
  local seats = redis.call('SMEMBERS', KEYS[2])
  for _, seatId in ipairs(seats) do
    local sKey = "seat:" .. ARGV[1] .. ":" .. seatId
    local status = redis.call('GET', sKey)
    if status == "purchased" then
      redis.call('EXPIRE', sKey, ARGV[2])
    end
  end
  redis.call('DEL', KEYS[1])
  redis.call('EXPIRE', KEYS[2], ARGV[2])
  redis.call('DEL', KEYS[3])
end
return count
`

func (r *Repository) DecrementAndExpire(ctx context.Context, eventId string, ttlSeconds int) (int64, error) {
	keys := []string{connectionsKey(eventId), eventSeatsKey(eventId), grpcSyncedKey(eventId)}
	return r.client.Eval(ctx, decrAndExpireLua, keys, eventId, ttlSeconds).Int64()
}
