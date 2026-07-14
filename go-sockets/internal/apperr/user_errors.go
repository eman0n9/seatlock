package apperr

import (
	"encoding/json"
	"errors"
	"log"
	"net/http"
)

type ErrKind string

const (
	KindUnauthorized ErrKind = "unauthorized"
)

type AppError struct {
	Kind    ErrKind `json:"-"`
	Message string  `json:"message"`
	cause   error
}

func (e *AppError) Error() string {
	return e.Message
}
func (e *AppError) Unwrap() error {
	return e.cause
}

func ErrUnauthorized() *AppError {
	return &AppError{Kind: KindUnauthorized, Message: "Unauthorized"}
}

func httpStatus(kind ErrKind) int {
	switch kind {
	case KindUnauthorized:
		return http.StatusUnauthorized
	default:
		return http.StatusInternalServerError
	}
}

func HandleError(w http.ResponseWriter, err error) {
	if appErr, ok := errors.AsType[*AppError](err); ok {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(httpStatus(appErr.Kind))
		err := json.NewEncoder(w).Encode(appErr)
		if err != nil {
			return
		}
		return
	}

	log.Printf("Unhandled error: %v", err)
	w.WriteHeader(http.StatusInternalServerError)
	_, err = w.Write([]byte("Something went wrong"))
	if err != nil {
		return
	}
}
