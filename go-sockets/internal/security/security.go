package security

import (
	"context"
	"encoding/base64"
	"fmt"
	"log"
	"net/http"
	"os"

	"github.com/golang-jwt/jwt/v5"
	"github.com/minakdanCVUT/SP1Team/seatlock_sockets/internal/apperr"
)

type contextKey string

const UserIDKey contextKey = "user_id"

var jwtSecret []byte

func Init() {
	secret := os.Getenv("JWT_SECRET")
	if secret == "" {
		jwtSecret = []byte("dev-secret")
		return
	}
	decoded, err := base64.StdEncoding.DecodeString(secret)
	if err != nil {
		log.Printf("[AUTH] JWT_SECRET is not valid base64, using raw bytes")
		jwtSecret = []byte(secret)
		return
	}
	jwtSecret = decoded
}

func AuthMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		tokenStr := r.URL.Query().Get("token")
		if tokenStr == "" {
			apperr.HandleError(w, apperr.ErrUnauthorized())
			return
		}

		token, err := jwt.Parse(tokenStr, func(token *jwt.Token) (any, error) {
			if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
				return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
			}
			return jwtSecret, nil
		})
		if err != nil || !token.Valid {
			log.Printf("[AUTH] token invalid: %v", err)
			apperr.HandleError(w, apperr.ErrUnauthorized())
			return
		}

		claims, ok := token.Claims.(jwt.MapClaims)
		if !ok {
			apperr.HandleError(w, apperr.ErrUnauthorized())
			return
		}

		userID, ok := claims["userId"].(string)
		if !ok || userID == "" {
			apperr.HandleError(w, apperr.ErrUnauthorized())
			return
		}

		ctx := context.WithValue(r.Context(), UserIDKey, userID)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}
