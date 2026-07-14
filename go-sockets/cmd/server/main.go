package main

import (
	"context"
	"errors"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/redis/go-redis/v9"

	internalGrpc "github.com/minakdanCVUT/SP1Team/seatlock_sockets/internal/grpc"
	"github.com/minakdanCVUT/SP1Team/seatlock_sockets/internal/handler"
	internalRedis "github.com/minakdanCVUT/SP1Team/seatlock_sockets/internal/redis"
	"github.com/minakdanCVUT/SP1Team/seatlock_sockets/internal/security"
	"github.com/minakdanCVUT/SP1Team/seatlock_sockets/internal/service"
	"github.com/minakdanCVUT/SP1Team/seatlock_sockets/internal/socket"
)

func main() {
	if err := security.Init(); err != nil {
		log.Fatalf("invalid security configuration: %v", err)
	}

	// Initialize Redis
	redisAddr := os.Getenv("REDIS_ADDR")
	if redisAddr == "" {
		redisAddr = "localhost:6379"
	}
	rdb := redis.NewClient(&redis.Options{
		Addr: redisAddr,
	})

	repo := internalRedis.NewRepository(rdb)
	if err := rdb.Ping(context.Background()).Err(); err != nil {
		log.Fatalf("failed to connect to Redis: %v", err)
	}
	recovered, err := repo.RecoverStaleConnections(context.Background(), 30*60)
	if err != nil {
		log.Fatalf("failed to recover stale connection counters: %v", err)
	}
	if recovered > 0 {
		log.Printf("recovered %d stale event connection counter(s)", recovered)
	}

	springAddr := os.Getenv("SPRING_GRPC_ADDR")
	if springAddr == "" {
		springAddr = "localhost:9090"
	}
	grpcClient, err := internalGrpc.NewSeatClient(springAddr)
	if err != nil {
		log.Fatalf("failed to connect to Spring gRPC: %v", err)
	}
	defer grpcClient.Close()

	appCtx, appCancel := context.WithCancel(context.Background())
	defer appCancel()

	expiredCh, err := repo.SubscribeToExpirations(appCtx)
	if err != nil {
		log.Fatalf("failed to subscribe to Redis expirations: %v", err)
	}
	purchasesCh, err := repo.SubscribeToPurchases(appCtx)
	if err != nil {
		log.Fatalf("failed to subscribe to purchases: %v", err)
	}
	releasesCh, err := repo.SubscribeToReleases(appCtx)
	if err != nil {
		log.Fatalf("failed to subscribe to releases: %v", err)
	}

	seatService := service.NewSeatService(repo, grpcClient)
	hub := socket.NewHub(seatService, expiredCh, purchasesCh, releasesCh)

	go hub.Run(appCtx)

	h := handler.RegisterRoutes(hub)

	port := os.Getenv("PORT")
	if port == "" {
		port = "8081"
	}

	srv := &http.Server{
		Addr:    ":" + port,
		Handler: h,
	}

	go func() {
		log.Printf("Server started on :%s", port)
		if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			log.Fatalf("listen: %s\n", err)
		}
	}()

	// Graceful shutdown
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit
	log.Println("Shutting down server...")

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if err := srv.Shutdown(ctx); err != nil {
		log.Fatal("Server forced to shutdown:", err)
	}

	log.Println("Server exiting")
}
