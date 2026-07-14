package security

import (
	"encoding/base64"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

func TestInitRejectsMissingAndInvalidSecrets(t *testing.T) {
	tests := []struct {
		name   string
		secret string
	}{
		{name: "missing"},
		{name: "invalid base64", secret: "not-base64"},
		{name: "empty decoded secret", secret: base64.StdEncoding.EncodeToString(nil)},
		{name: "short decoded secret", secret: base64.StdEncoding.EncodeToString(make([]byte, 31))},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Setenv("JWT_SECRET", tt.secret)
			if err := Init(); err == nil {
				t.Fatal("Init() succeeded, want configuration error")
			}
			if jwtSecret != nil {
				t.Fatal("Init() retained a JWT secret after an error")
			}
		})
	}
}

func TestAuthMiddlewareRequiresWebSocketTokenPurpose(t *testing.T) {
	secret := make([]byte, 32)
	t.Setenv("JWT_SECRET", base64.StdEncoding.EncodeToString(secret))
	if err := Init(); err != nil {
		t.Fatalf("Init() error = %v", err)
	}

	next := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusNoContent)
	})
	for _, tt := range []struct {
		purpose string
		status  int
	}{
		{purpose: "websocket", status: http.StatusNoContent},
		{purpose: "api", status: http.StatusUnauthorized},
	} {
		t.Run(tt.purpose, func(t *testing.T) {
			token := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
				"userId":       "550e8400-e29b-41d4-a716-446655440001",
				"tokenPurpose": tt.purpose,
				"exp":          time.Now().Add(time.Minute).Unix(),
			})
			signed, err := token.SignedString(secret)
			if err != nil {
				t.Fatalf("SignedString() error = %v", err)
			}

			request := httptest.NewRequest(http.MethodGet, "/ws?token="+signed, nil)
			response := httptest.NewRecorder()
			AuthMiddleware(next).ServeHTTP(response, request)
			if response.Code != tt.status {
				t.Fatalf("status = %d, want %d", response.Code, tt.status)
			}
		})
	}
}

func TestInitDecodesBase64Secret(t *testing.T) {
	want := make([]byte, 32)
	for i := range want {
		want[i] = byte(i + 1)
	}
	t.Setenv("JWT_SECRET", base64.StdEncoding.EncodeToString(want))

	if err := Init(); err != nil {
		t.Fatalf("Init() error = %v", err)
	}
	if string(jwtSecret) != string(want) {
		t.Fatalf("jwtSecret = %q, want %q", jwtSecret, want)
	}
}
