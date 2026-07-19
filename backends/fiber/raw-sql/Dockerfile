# Fiber Raw SQL — security-research 3/6 variant
FROM golang:1.22-alpine AS build
WORKDIR /src
COPY go.mod ./
RUN go mod download || true
COPY . .
RUN go mod tidy && CGO_ENABLED=0 go build -o /out/backend ./cmd/server

FROM alpine:3.20
WORKDIR /app
COPY --from=build /out/backend /app/backend
EXPOSE 4001
CMD ["/app/backend"]
