package handlers

import (
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"
	"gorm.io/gorm"

	"security-research/fiber-orm/internal/auth"
	"security-research/fiber-orm/internal/config"
	"security-research/fiber-orm/internal/db"
	"security-research/fiber-orm/internal/httpx"
)

// GORM хувилбарын Overposting туршилт.
//
// Alpha: GORM `Updates(map[string]interface{}{...})` ирсэн бүх талбарыг accept.
// Beta:  зөвхөн `username`, `address` талбарыг зөвшөөрч, мэдэгдээгүй талбар — 400.

type ProfileHandler struct {
	DB  *gorm.DB
	Cfg config.Config
}

type profileDTO struct {
	UserID   int     `json:"user_id"`
	Username string  `json:"username"`
	Email    string  `json:"email"`
	Role     string  `json:"role"`
	IsAdmin  bool    `json:"is_admin"`
	Address  *string `json:"address"`
}

func (h *ProfileHandler) Get(ctx *fiber.Ctx) error {
	user, err := auth.FromCtx(ctx)
	if err != nil {
		return err
	}
	p, err := h.fetch(user.ID)
	if err != nil {
		return err
	}
	return ctx.JSON(fiber.Map{"profile": p})
}

func (h *ProfileHandler) Update(ctx *fiber.Ctx) error {
	user, err := auth.FromCtx(ctx)
	if err != nil {
		return err
	}
	var raw map[string]json.RawMessage
	if err := json.Unmarshal(ctx.Body(), &raw); err != nil {
		return httpx.Validation("JSON алдаатай")
	}
	if h.Cfg.Implementation == config.Beta {
		if err := h.updateBeta(user.ID, raw); err != nil {
			return err
		}
	} else {
		if err := h.updateAlpha(user.ID, raw); err != nil {
			return err
		}
	}
	p, err := h.fetch(user.ID)
	if err != nil {
		return err
	}
	return ctx.JSON(fiber.Map{"profile": p})
}

func (h *ProfileHandler) updateAlpha(userID int, raw map[string]json.RawMessage) error {
	allowed := map[string]string{
		"name":     "username",
		"address":  "address",
		"role":     "role",
		"is_admin": "is_admin",
	}
	updates := map[string]interface{}{}
	for jsonKey, column := range allowed {
		v, ok := raw[jsonKey]
		if !ok {
			continue
		}
		var val interface{}
		if err := json.Unmarshal(v, &val); err != nil {
			return httpx.Validation("талбар алдаатай: " + jsonKey)
		}
		updates[column] = val
	}
	if len(updates) > 0 {
		if err := h.DB.Model(&db.User{}).Where("id = ?", userID).Updates(updates).Error; err != nil {
			return httpx.Internal(err.Error())
		}
	}

	targetsRaw, ok := raw["targets"]
	if !ok {
		return nil
	}
	var overposts []struct {
		Label string `json:"label"`
		Value string `json:"value"`
	}
	if err := json.Unmarshal(targetsRaw, &overposts); err != nil {
		return nil
	}
	var targets []db.ProfileTarget
	if err := h.DB.Where("user_id = ?", userID).Find(&targets).Error; err != nil {
		return httpx.Internal(err.Error())
	}
	byLabel := map[string]db.ProfileTarget{}
	for _, t := range targets {
		byLabel[t.TargetLabel] = t
	}
	for _, o := range overposts {
		t, ok := byLabel[o.Label]
		if !ok {
			continue
		}
		if !strings.EqualFold(o.Value, "you are hacked") {
			continue
		}
		marker := fmt.Sprintf("You are hacked | %s", t.TargetNonce)
		h.DB.Model(&db.ProfileTarget{}).Where("id = ?", t.ID).
			Updates(map[string]interface{}{"target_value": marker, "updated_at": time.Now()})
	}
	return nil
}

func (h *ProfileHandler) updateBeta(userID int, raw map[string]json.RawMessage) error {
	allowed := map[string]bool{"name": true, "address": true}
	for key := range raw {
		if !allowed[key] {
			return httpx.Validation("мэдэгдээгүй талбар: " + key)
		}
	}
	updates := map[string]interface{}{}
	if v, ok := raw["name"]; ok {
		var s string
		if err := json.Unmarshal(v, &s); err != nil {
			return httpx.Validation("name string байх ёстой")
		}
		updates["username"] = s
	}
	if v, ok := raw["address"]; ok {
		var s string
		if err := json.Unmarshal(v, &s); err != nil {
			return httpx.Validation("address string байх ёстой")
		}
		updates["address"] = s
	}
	if len(updates) == 0 {
		return nil
	}
	if err := h.DB.Model(&db.User{}).Where("id = ?", userID).Updates(updates).Error; err != nil {
		return httpx.Internal(err.Error())
	}
	return nil
}

func (h *ProfileHandler) fetch(userID int) (profileDTO, error) {
	var u db.User
	if err := h.DB.First(&u, userID).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return profileDTO{}, httpx.NotFound("хэрэглэгч олдсонгүй")
		}
		return profileDTO{}, httpx.Internal(err.Error())
	}
	role := u.Role
	if role != string(auth.RoleAdmin) {
		role = string(auth.RoleCustomer)
	}
	return profileDTO{
		UserID: u.ID, Username: u.Username, Email: u.Email,
		Role: role, IsAdmin: u.IsAdmin, Address: u.Address,
	}, nil
}
