package handler

import (
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/minakdanCVUT/SP1Team/seatlock_sockets/internal/security"
	"github.com/minakdanCVUT/SP1Team/seatlock_sockets/internal/socket"
)

func RegisterRoutes(hub *socket.Hub) http.Handler {
	r := chi.NewRouter()

	r.Get("/health", func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"status":"UP"}`))
	})

	r.With(security.AuthMiddleware).Get("/ws", func(w http.ResponseWriter, r *http.Request) {
		socket.ServeWs(hub, w, r)
	})

	return r
}
