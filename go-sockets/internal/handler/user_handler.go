package handler

import "github.com/minakdanCVUT/SP1Team/seatlock_sockets/internal/service"

type UserHandler struct {
	service *service.UserService
}

func NewUserHandler(s *service.UserService) *UserHandler {
	return &UserHandler{
		service: s,
	}
}
