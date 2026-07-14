FROM golang:1.26.5-alpine AS builder

WORKDIR /app

COPY go.mod go.sum ./
RUN go mod download

COPY . .
RUN CGO_ENABLED=0 go build -o seatlock ./cmd/server

FROM alpine:3.21

RUN apk add --no-cache ca-certificates \
    && addgroup -S seatlock \
    && adduser -S seatlock -G seatlock

COPY --from=builder /app/seatlock /seatlock

USER seatlock

EXPOSE 8081

HEALTHCHECK --interval=10s --timeout=3s --retries=3 \
    CMD wget -q -O - http://localhost:8081/health > /dev/null || exit 1

ENTRYPOINT ["/seatlock"]
