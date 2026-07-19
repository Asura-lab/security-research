package auth

import (
	"errors"
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/golang-jwt/jwt/v5"

	"security-research/fiber-orm/internal/httpx"
)

type Role string

const (
	RoleCustomer Role = "customer"
	RoleAdmin    Role = "admin"
)

type Claims struct {
	Sub  int  `json:"sub"`
	Role Role `json:"role"`
	jwt.RegisteredClaims
}

// User нь fiber context-т `user` key дор хадгалагдана.
type User struct {
	ID   int  `json:"id"`
	Role Role `json:"role"`
}

type Manager struct {
	secret []byte
	ttl    time.Duration
}

func NewManager(secret, expiresIn string) *Manager {
	d, err := time.ParseDuration(expiresIn)
	if err != nil {
		d = 15 * time.Minute
	}
	return &Manager{secret: []byte(secret), ttl: d}
}

func (m *Manager) Sign(userID int, role Role) (string, error) {
	now := time.Now()
	claims := Claims{
		Sub:  userID,
		Role: role,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(now.Add(m.ttl)),
			IssuedAt:  jwt.NewNumericDate(now),
		},
	}
	return jwt.NewWithClaims(jwt.SigningMethodHS256, claims).SignedString(m.secret)
}

func (m *Manager) Parse(token string) (*Claims, error) {
	parsed, err := jwt.ParseWithClaims(token, &Claims{}, func(t *jwt.Token) (interface{}, error) {
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, errors.New("unexpected signing method")
		}
		return m.secret, nil
	})
	if err != nil {
		return nil, err
	}
	claims, ok := parsed.Claims.(*Claims)
	if !ok || !parsed.Valid {
		return nil, errors.New("invalid claims")
	}
	return claims, nil
}

// Middleware — Authorization: Bearer <token> шалгах. Амжилттай үед `user` locals-т хадгалагдана.
func (m *Manager) Middleware() fiber.Handler {
	return func(ctx *fiber.Ctx) error {
		header := ctx.Get("Authorization")
		if !strings.HasPrefix(header, "Bearer ") {
			return httpx.Unauthorized("токен байхгүй")
		}
		claims, err := m.Parse(strings.TrimPrefix(header, "Bearer "))
		if err != nil {
			return httpx.Unauthorized("токен буруу")
		}
		ctx.Locals("user", &User{ID: claims.Sub, Role: claims.Role})
		return ctx.Next()
	}
}

// RequireAdmin нь `Middleware` дараа гинжлэгддэг: role != admin бол 403.
func RequireAdmin() fiber.Handler {
	return func(ctx *fiber.Ctx) error {
		u, ok := ctx.Locals("user").(*User)
		if !ok || u == nil {
			return httpx.Unauthorized("хандалт хориотой")
		}
		if u.Role != RoleAdmin {
			return httpx.Forbidden("хандалт хориотой")
		}
		return ctx.Next()
	}
}

// FromCtx нь handler-т `user`-ыг гаргаж авна.
func FromCtx(ctx *fiber.Ctx) (*User, error) {
	u, ok := ctx.Locals("user").(*User)
	if !ok || u == nil {
		return nil, httpx.Unauthorized("хандалт хориотой")
	}
	return u, nil
}
