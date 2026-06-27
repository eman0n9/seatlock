package service

import (
	"context"
	"log"

	"github.com/minakdanCVUT/SP1Team/seatlock_sockets/internal/grpc"
	"github.com/minakdanCVUT/SP1Team/seatlock_sockets/internal/redis"
)

type SeatService struct {
	repo       *redis.Repository
	grpcClient grpc.SeatClient
}

func NewSeatService(repo *redis.Repository, grpcClient grpc.SeatClient) *SeatService {
	return &SeatService{
		repo:       repo,
		grpcClient: grpcClient,
	}
}

type ReservedSeat struct {
	SeatID string
	TTL    int64
}

type Snapshot struct {
	Purchased     []string
	MyReserved    []ReservedSeat
	OtherReserved []string
}

func (s *SeatService) OnConnect(ctx context.Context, eventId, userId string) (*Snapshot, error) {
	count, err := s.repo.IncrementConnections(ctx, eventId)
	if err != nil {
		return nil, err
	}

	seats, err := s.repo.GetEventSnapshot(ctx, eventId)
	if err != nil {
		return nil, err
	}

	snap := &Snapshot{}
	for _, si := range seats {
		switch si.Status {
		case "purchased":
			snap.Purchased = append(snap.Purchased, si.SeatID)
		case "reserved":
			if si.UserID == userId {
				snap.MyReserved = append(snap.MyReserved, ReservedSeat{SeatID: si.SeatID, TTL: si.TTL})
			} else {
				snap.OtherReserved = append(snap.OtherReserved, si.SeatID)
			}
		}
	}

	hasCachedData := len(snap.Purchased) > 0 || len(snap.MyReserved) > 0 || len(snap.OtherReserved) > 0

	if !hasCachedData {
		synced, err := s.repo.IsGRPCSynced(ctx, eventId)
		if err != nil {
			return nil, err
		}

		if !synced {
			log.Printf("Cache miss for event %s, calling Spring via gRPC", eventId)
			springPurchased, err := s.grpcClient.GetPurchasedSeats(ctx, eventId)
			if err != nil {
				return nil, err
			}

			if err := s.repo.MarkGRPCSynced(ctx, eventId); err != nil {
				log.Printf("Error marking gRPC synced for event %s: %v", eventId, err)
			}

			for _, seatId := range springPurchased {
				if err := s.repo.SetSeatPurchased(ctx, eventId, seatId); err != nil {
					log.Printf("Error setting seat purchased in Redis: %v", err)
				}
			}
			snap.Purchased = springPurchased
		}
	} else if count > 1 {
		if err := s.repo.PersistEventSeats(ctx, eventId); err != nil {
			log.Printf("Error persisting seats for event %s: %v", eventId, err)
		}
	}

	return snap, nil
}

func (s *SeatService) ReserveSeat(ctx context.Context, eventId, seatId, userId string) (bool, error) {
	return s.repo.SetSeatReserved(ctx, eventId, seatId, userId)
}

func (s *SeatService) UnreserveSeat(ctx context.Context, eventId, seatId, userId string) (bool, error) {
	return s.repo.RemoveSeatReservation(ctx, eventId, seatId, userId)
}

func (s *SeatService) PurchaseSeats(ctx context.Context, eventId string, seatIds []string) error {
	for _, seatId := range seatIds {
		if err := s.repo.SetSeatPurchased(ctx, eventId, seatId); err != nil {
			return err
		}
	}
	return nil
}

func (s *SeatService) OnDisconnect(ctx context.Context, eventId string) error {
	_, err := s.repo.DecrementAndExpire(ctx, eventId, 1800)
	return err
}
