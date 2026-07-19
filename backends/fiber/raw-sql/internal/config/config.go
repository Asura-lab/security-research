package config

import (
	"fmt"
	"os"
	"strconv"
)

// Backend variant тодорхойлолт — health-т буцаагдана.
const (
	VariantName = "fiber-raw"
	HTTPPort    = 4001
)

// Implementation — R5 feature flag (alpha default, beta fixed).
type Implementation string

const (
	Alpha Implementation = "alpha"
	Beta  Implementation = "beta"
)

// Config нь бүх backend variant-ын гол env-ыг агуулна.
type Config struct {
	DatabaseURL    string
	JWTSecret      string
	JWTExpiresIn   string
	StatsdHost     string
	StatsdPort     int
	StatsdEnabled  bool
	Implementation Implementation
}

func Load() Config {
	host := getenv("POSTGRES_HOST", "localhost")
	port := getenv("POSTGRES_PORT", "5432")
	user := getenv("POSTGRES_USER", "postgres")
	password := getenv("POSTGRES_PASSWORD", "research123")
	dbname := getenv("POSTGRES_DB", "shop")

	ddHost := os.Getenv("DD_AGENT_HOST")
	ddPort, _ := strconv.Atoi(getenv("DD_DOGSTATSD_PORT", "8125"))

	impl := Alpha
	if os.Getenv("IMPLEMENTATION") == "beta" {
		impl = Beta
	}

	return Config{
		DatabaseURL:    fmt.Sprintf("postgres://%s:%s@%s:%s/%s?sslmode=disable", user, password, host, port, dbname),
		JWTSecret:      getenv("JWT_SECRET", "research-jwt-secret"),
		JWTExpiresIn:   getenv("JWT_EXPIRES_IN", "15m"),
		StatsdHost:     getenv("DD_AGENT_HOST", "datadog"),
		StatsdPort:     ddPort,
		StatsdEnabled:  ddHost != "",
		Implementation: impl,
	}
}

func getenv(key, fallback string) string {
	if v, ok := os.LookupEnv(key); ok {
		return v
	}
	return fallback
}
