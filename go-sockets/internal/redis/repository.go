package redis

import (
	"context"
	"errors"
	"fmt"
	"log"
	"strings"
	"time"

	"github.com/minakdanCVUT/SP1Team/seatlock_sockets/internal/validation"
	"github.com/redis/go-redis/v9"
)

type Repository struct {
	client *redis.Client
}

var ErrReservationLimit = errors.New("reservation limit reached")

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

func userReservationsKey(eventId, userId string) string {
	return fmt.Sprintf("user_reservations:%s:%s", eventId, userId)
}

func (r *Repository) IncrementConnections(ctx context.Context, eventId string) (int64, error) {
	return r.client.Incr(ctx, connectionsKey(eventId)).Result()
}

func (r *Repository) GetConnections(ctx context.Context, eventId string) (int64, error) {
	val, err := r.client.Get(ctx, connectionsKey(eventId)).Int64()
	if errors.Is(err, redis.Nil) {
		return 0, nil
	}
	return val, err
}

const reconcilePurchasedLua = `
local eventId = ARGV[1]
for i = 2, #ARGV do
  local seatId = ARGV[i]
  local purchasedKey = 'seat:' .. eventId .. ':' .. seatId
  local current = redis.call('GET', purchasedKey)
  if current and string.sub(current, 1, 9) == 'reserved:' then
    local userId = string.sub(current, 10)
    local reservationsKey = 'user_reservations:' .. eventId .. ':' .. userId
    redis.call('SREM', reservationsKey, seatId)
  end
  redis.call('SET', purchasedKey, 'purchased')
  redis.call('SADD', KEYS[1], seatId)
end
return #ARGV - 1
`

func (r *Repository) ReconcilePurchasedSeats(ctx context.Context, eventId string, seatIds []string) error {
	args := make([]interface{}, 1, len(seatIds)+1)
	args[0] = eventId
	for _, seatID := range seatIds {
		args = append(args, seatID)
	}
	return r.client.Eval(ctx, reconcilePurchasedLua, []string{eventSeatsKey(eventId)}, args...).Err()
}

const reserveLua = `
local owner = ARGV[1]
local existing = redis.call('GET', KEYS[1])
if existing then
  if existing == owner then
    return 1
  end
  return 0
end

local heldSeats = redis.call('SMEMBERS', KEYS[3])
for _, heldSeatId in ipairs(heldSeats) do
  if redis.call('GET', ARGV[3] .. heldSeatId) ~= owner then
    redis.call('SREM', KEYS[3], heldSeatId)
  end
end

if redis.call('SCARD', KEYS[3]) >= tonumber(ARGV[5]) then
  return -1
end

redis.call('SET', KEYS[1], owner, 'EX', ARGV[4])
redis.call('SADD', KEYS[2], ARGV[2])
redis.call('SADD', KEYS[3], ARGV[2])
redis.call('EXPIRE', KEYS[3], ARGV[4])
return 1
`

func (r *Repository) SetSeatReserved(ctx context.Context, eventId, seatId, userId string, limit int) (bool, error) {
	if limit <= 0 {
		return false, fmt.Errorf("reservation limit must be positive")
	}

	keys := []string{
		seatKey(eventId, seatId),
		eventSeatsKey(eventId),
		userReservationsKey(eventId, userId),
	}
	result, err := r.client.Eval(
		ctx,
		reserveLua,
		keys,
		"reserved:"+userId,
		seatId,
		"seat:"+eventId+":",
		int64((10*time.Minute)/time.Second),
		limit,
	).Int64()
	if err != nil {
		return false, err
	}
	if result == -1 {
		return false, ErrReservationLimit
	}
	return result == 1, nil
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
	if err := r.client.Persist(ctx, eventSeatsKey(eventId)).Err(); err != nil {
		return err
	}

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
  redis.call('SREM', KEYS[3], ARGV[2])
  return 1
end
return 0
`

func (r *Repository) RemoveSeatReservation(ctx context.Context, eventId, seatId, userId string) (bool, error) {
	keys := []string{seatKey(eventId, seatId), eventSeatsKey(eventId), userReservationsKey(eventId, userId)}
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

type PurchasedSeats struct {
	EventID string
	SeatIDs []string
}

type ReleasedSeats struct {
	EventID string
	SeatIDs []string
}

func (r *Repository) SubscribeToPurchases(ctx context.Context) (<-chan PurchasedSeats, error) {
	const channelPrefix = "seatlock:purchases:"
	return subscribeToSeatBatches(ctx, r.client, channelPrefix, func(eventID string, seatIDs []string) PurchasedSeats {
		return PurchasedSeats{EventID: eventID, SeatIDs: seatIDs}
	})
}

func (r *Repository) SubscribeToReleases(ctx context.Context) (<-chan ReleasedSeats, error) {
	const channelPrefix = "seatlock:releases:"
	return subscribeToSeatBatches(ctx, r.client, channelPrefix, func(eventID string, seatIDs []string) ReleasedSeats {
		return ReleasedSeats{EventID: eventID, SeatIDs: seatIDs}
	})
}

func subscribeToSeatBatches[T any](
	ctx context.Context,
	client *redis.Client,
	channelPrefix string,
	create func(eventID string, seatIDs []string) T,
) (<-chan T, error) {
	sub := client.PSubscribe(ctx, channelPrefix+"*")
	if _, err := sub.Receive(ctx); err != nil {
		sub.Close()
		return nil, fmt.Errorf("subscribe to %s*: %w", channelPrefix, err)
	}

	ch := make(chan T, 16)
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

			eventID := strings.TrimPrefix(msg.Channel, channelPrefix)
			if !validation.IsUUID(eventID) {
				continue
			}
			seatIDs := strings.Split(msg.Payload, ",")
			if len(seatIDs) == 0 {
				continue
			}
			valid := true
			for _, seatID := range seatIDs {
				if !validation.IsUUID(seatID) {
					valid = false
					break
				}
			}
			if !valid {
				continue
			}

			select {
			case ch <- create(eventID, seatIDs):
			case <-ctx.Done():
				return
			}
		}
	}()
	return ch, nil
}

func (r *Repository) SubscribeToExpirations(ctx context.Context) (<-chan ExpiredSeat, error) {
	if err := r.client.ConfigSet(ctx, "notify-keyspace-events", "Ex").Err(); err != nil {
		return nil, fmt.Errorf("enable keyspace notifications: %w", err)
	}

	sub := r.client.PSubscribe(ctx, "__keyevent@0__:expired")
	if _, err := sub.Receive(ctx); err != nil {
		sub.Close()
		return nil, fmt.Errorf("subscribe to key expirations: %w", err)
	}
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

			seat, ok, err := r.removeExpiredSeatFromEvent(ctx, msg.Payload)
			if err != nil {
				log.Printf("failed to remove expired seat %s from event %s index: %v", seat.SeatID, seat.EventID, err)
				continue
			}
			if !ok {
				continue
			}

			select {
			case ch <- seat:
			case <-ctx.Done():
				return
			}
		}
	}()

	return ch, nil
}

func (r *Repository) removeExpiredSeatFromEvent(ctx context.Context, expiredKey string) (ExpiredSeat, bool, error) {
	// expiredKey = "seat:{eventId}:{seatId}"
	parts := strings.SplitN(expiredKey, ":", 3)
	if len(parts) != 3 || parts[0] != "seat" || !validation.IsUUID(parts[1]) || !validation.IsUUID(parts[2]) {
		return ExpiredSeat{}, false, nil
	}

	seat := ExpiredSeat{EventID: parts[1], SeatID: parts[2]}
	removed, err := r.client.Eval(ctx, removeExpiredSeatLua,
		[]string{seatKey(seat.EventID, seat.SeatID), eventSeatsKey(seat.EventID)},
		seat.SeatID,
	).Int64()
	return seat, removed == 1, err
}

const removeExpiredSeatLua = `
if redis.call('EXISTS', KEYS[1]) == 1 then
  return 0
end
return redis.call('SREM', KEYS[2], ARGV[1])
`

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
end
return count
`

func (r *Repository) DecrementAndExpire(ctx context.Context, eventId string, ttlSeconds int) (int64, error) {
	keys := []string{connectionsKey(eventId), eventSeatsKey(eventId)}
	return r.client.Eval(ctx, decrAndExpireLua, keys, eventId, ttlSeconds).Int64()
}

const recoverStaleConnectionsLua = `
local seats = redis.call('SMEMBERS', KEYS[2])
for _, seatId in ipairs(seats) do
  local seatStateKey = 'seat:' .. ARGV[1] .. ':' .. seatId
  if redis.call('GET', seatStateKey) == 'purchased' then
    redis.call('EXPIRE', seatStateKey, ARGV[2])
  end
end
redis.call('DEL', KEYS[1])
redis.call('EXPIRE', KEYS[2], ARGV[2])
return 1
`

// RecoverStaleConnections clears counters left by a crashed single WebSocket
// instance and schedules its disconnected cache for expiry.
func (r *Repository) RecoverStaleConnections(ctx context.Context, ttlSeconds int) (int, error) {
	if ttlSeconds <= 0 {
		return 0, fmt.Errorf("recovery TTL must be positive")
	}

	var cursor uint64
	staleKeys := make(map[string]string)
	for {
		keys, nextCursor, err := r.client.Scan(ctx, cursor, "connections:*", 100).Result()
		if err != nil {
			return 0, err
		}
		for _, key := range keys {
			eventID := strings.TrimPrefix(key, "connections:")
			if !validation.IsUUID(eventID) {
				continue
			}
			staleKeys[key] = eventID
		}
		cursor = nextCursor
		if cursor == 0 {
			break
		}
	}

	recovered := 0
	for key, eventID := range staleKeys {
		if err := r.client.Eval(ctx, recoverStaleConnectionsLua,
			[]string{key, eventSeatsKey(eventID)}, eventID, ttlSeconds,
		).Err(); err != nil {
			return recovered, err
		}
		recovered++
	}
	return recovered, nil
}
