package handlers

import (
	"errors"
	"strings"

	"github.com/gofiber/fiber/v2"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"

	"security-research/fiber-orm/internal/auth"
	"security-research/fiber-orm/internal/db"
	"security-research/fiber-orm/internal/httpx"
)

type AuthHandler struct {
	DB  *gorm.DB
	JWT *auth.Manager
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
	if len(body.Username) < 3 || len(body.Username) > 50 {
		return httpx.Validation("username 3-50 тэмдэгт байна")
	}
	if !strings.Contains(body.Email, "@") {
		return httpx.Validation("email хэлбэр буруу")
	}
	if len(body.Password) < 8 {
		return httpx.Validation("password >= 8 тэмдэгт")
	}

	var existing db.User
	if err := h.DB.Where("username = ? OR email = ?", body.Username, body.Email).
		First(&existing).Error; err == nil {
		return httpx.Conflict("username эсвэл email аль хэдийн байна")
	} else if !errors.Is(err, gorm.ErrRecordNotFound) {
		return httpx.Internal(err.Error())
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(body.Password), 12)
	if err != nil {
		return httpx.Internal(err.Error())
	}
	user := db.User{
		Username:     body.Username,
		Email:        body.Email,
		PasswordHash: string(hash),
		Role:         "customer",
		IsAdmin:      false,
	}
	if err := h.DB.Create(&user).Error; err != nil {
		return httpx.Internal(err.Error())
	}
	return ctx.Status(fiber.StatusCreated).JSON(fiber.Map{
		"user_id":  user.ID,
		"username": user.Username,
		"role":     "customer",
	})
}

func (h *AuthHandler) Login(ctx *fiber.Ctx) error {
	var body loginReq
	if err := ctx.BodyParser(&body); err != nil {
		return httpx.Validation("JSON алдаатай")
	}
	var user db.User
	if err := h.DB.Where("username = ?", body.Username).First(&user).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return httpx.Unauthorized("нэвтрэх нэр эсвэл нууц үг буруу")
		}
		return httpx.Internal(err.Error())
	}
	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(body.Password)); err != nil {
		return httpx.Unauthorized("нэвтрэх нэр эсвэл нууц үг буруу")
	}
	r := auth.Role(user.Role)
	if r != auth.RoleAdmin {
		r = auth.RoleCustomer
	}
	token, err := h.JWT.Sign(user.ID, r)
	if err != nil {
		return httpx.Internal(err.Error())
	}
	return ctx.JSON(fiber.Map{
		"access_token": token,
		"role":         r,
		"user_id":      user.ID,
	})
}
