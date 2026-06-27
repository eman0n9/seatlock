package grpc

import (
	"context"
	"fmt"

	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"

	"github.com/minakdanCVUT/SP1Team/seatlock_sockets/internal/grpc/pb"
)

type SeatClient interface {
	GetPurchasedSeats(ctx context.Context, eventId string) ([]string, error)
	Close() error
}

type seatGRPCClient struct {
	conn   *grpc.ClientConn
	client pb.SeatServiceClient
}

func NewSeatClient(springAddr string) (SeatClient, error) {
	conn, err := grpc.NewClient(springAddr, grpc.WithTransportCredentials(insecure.NewCredentials()))
	if err != nil {
		return nil, fmt.Errorf("grpc dial %s: %w", springAddr, err)
	}
	return &seatGRPCClient{
		conn:   conn,
		client: pb.NewSeatServiceClient(conn),
	}, nil
}

func (c *seatGRPCClient) GetPurchasedSeats(ctx context.Context, eventId string) ([]string, error) {
	resp, err := c.client.GetPurchasedSeats(ctx, &pb.GetPurchasedSeatsRequest{EventId: eventId})
	if err != nil {
		return nil, fmt.Errorf("GetPurchasedSeats: %w", err)
	}
	return resp.GetSeatIds(), nil
}

func (c *seatGRPCClient) Close() error {
	return c.conn.Close()
}
