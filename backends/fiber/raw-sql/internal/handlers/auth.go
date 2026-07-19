package handlers

import (
	"context"
	"errors"
	"strings"

	"github.com/gofiber/fiber/v2"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"golang.org/x/crypto/bcrypt"

	"security-research/fiber-raw/internal/auth"
	"security-research/fiber-raw/internal/httpx"
)

type AuthHandler struct {
	Pool *pgxpool.Pool
	JWT  *auth.Manager
}

type registerReq struct {
	Username string `json:"username"`
	Email    string `json:"email"`
	Password string `json:"password"`
}

type loginReq struct {
	Username string `json:"username"`
	Password string `json:"password"`
}

func (h *AuthHandler) Register(ctx *fiber.Ctx) error {
	var body registerReq
	if err := ctx.BodyParser(&body); err != nil {
		return httpx.Validation("JSON алдаатай")
	}
	if err := validateRegister(body); err != nil {
		return err
	}

	var exists int
	err := h.Pool.QueryRow(context.Background(),
		"SELECT id FROM users WHERE username = $1 OR email = $2 LIMIT 1",
		body.Username, body.Email).Scan(&exists)
	if err == nil {
		return httpx.Conflict("username эсвэл email аль хэдийн байна")
	}
	if err != nil && !errors.Is(err, pgx.ErrNoRows) {
		return httpx.Internal(err.Error())
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(body.Password), 12)
	if err != nil {
		return httpx.Internal(err.Error())
	}

	var userID int
	err = h.Pool.QueryRow(context.Background(),
		`INSERT INTO users (username, email, password_hash, role, is_admin)
		 VALUES ($1, $2, $3, 'customer', FALSE) RETURNING id`,
		body.Username, body.Email, string(hash)).Scan(&userID)
	if err != nil {
		return httpx.Internal(err.Error())
	}
	return ctx.Status(fiber.StatusCreated).JSON(fiber.Map{
		"user_id":  userID,
		"username": body.Username,
		"role":     "customer",
	})
}

func (h *AuthHandler) Login(ctx *fiber.Ctx) error {
	var body loginReq
	if err := ctx.BodyParser(&body); err != nil {
		return httpx.Validation("JSON алдаатай")
	}
	if body.Username == "" || body.Password == "" {
		return httpx.Validation("username, password шаардлагатай")
	}

	var userID int
	var passwordHash, role string
	err := h.Pool.QueryRow(context.Background(),
		"SELECT id, password_hash, role FROM users WHERE username = $1 LIMIT 1",
		body.Username).Scan(&userID, &passwordHash, &role)
	if errors.Is(err, pgx.ErrNoRows) {
		return httpx.Unauthorized("нэвтрэх нэр эсвэл нууц үг буруу")
	}
	if err != nil {
		return httpx.Internal(err.Error())
	}
	if err := bcrypt.CompareHashAndPassword([]byte(passwordHash), []byte(body.Password)); err != nil {
		return httpx.Unauthorized("нэвтрэх нэр эсвэл нууц үг буруу")
	}
	r := auth.Role(role)
	if r != auth.RoleAdmin {
		r = auth.RoleCustomer
	}
	token, err := h.JWT.Sign(userID, r)
	if err != nil {
		return httpx.Internal(err.Error())
	}
	return ctx.JSON(fiber.Map{
		"access_token": token,
		"role":         r,
		"user_id":      userID,
	})
}

func validateRegister(r registerReq) error {
	if len(r.Username) < 3 || len(r.Username) > 50 {
		return httpx.Validation("username 3-50 тэмдэгт байна")
	}
	if !strings.Contains(r.Email, "@") {
		return httpx.Validation("email хэлбэр буруу")
	}
	if len(r.Password) < 8 {
		return httpx.Validation("password >= 8 тэмдэгт")
	}
	return nil
}
