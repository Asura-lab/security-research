package handlers

import (
	"context"
	"encoding/json"
	"errors"
	"strings"

	"github.com/gofiber/fiber/v2"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"security-research/fiber-raw/internal/auth"
	"security-research/fiber-raw/internal/config"
	"security-research/fiber-raw/internal/httpx"
)

// Overposting туршилтын endpoint — Raw хувилбар (Go).
//
// Alpha: `map[string]interface{}` рүү raw body-г decode хийж бүх мэдэгдсэн
// талбарыг accept болгоно. `role`, `is_admin`, `targets` бүгд UPDATE-т орно.
// Beta:  `updateProfileBeta`-т зөвхөн `name`, `address` талбарыг сонгоно.

type ProfileHandler struct {
	Pool *pgxpool.Pool
	Cfg  config.Config
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

// ⚠️ Alpha — mass assignment: ирсэн бүх талбарыг UPDATE-д залгана.
func (h *ProfileHandler) updateAlpha(userID int, raw map[string]json.RawMessage) error {
	allowed := map[string]string{
		"name":     "username",
		"address":  "address",
		"role":     "role",
		"is_admin": "is_admin",
	}
	clauses := []string{}
	params := []interface{}{}
	for jsonKey, column := range allowed {
		v, ok := raw[jsonKey]
		if !ok {
			continue
		}
		var val interface{}
		if err := json.Unmarshal(v, &val); err != nil {
			return httpx.Validation("талбар алдаатай: " + jsonKey)
		}
		params = append(params, val)
		clauses = append(clauses, column+" = $"+itoa(len(params)))
	}
	if len(clauses) > 0 {
		params = append(params, userID)
		sql := "UPDATE users SET " + strings.Join(clauses, ", ") + " WHERE id = $" + itoa(len(params))
		if _, err := h.Pool.Exec(context.Background(), sql, params...); err != nil {
			return httpx.Internal(err.Error())
		}
	}

	// Overposting variant 3 — profile_targets marker mutation.
	targetsRaw, ok := raw["targets"]
	if !ok {
		return nil
	}
	var overposts []struct {
		Label string `json:"label"`
		Value string `json:"value"`
	}
	if err := json.Unmarshal(targetsRaw, &overposts); err != nil {
		return nil // silent — Overposting дефинишн: mekдэгдээгүй талбар accept
	}
	rows, err := h.Pool.Query(context.Background(),
		"SELECT id, target_label, target_nonce FROM profile_targets WHERE user_id = $1", userID)
	if err != nil {
		return httpx.Internal(err.Error())
	}
	defer rows.Close()
	type dbTarget struct {
		ID    int
		Label string
		Nonce string
	}
	targets := map[string]dbTarget{}
	for rows.Next() {
		var t dbTarget
		if err := rows.Scan(&t.ID, &t.Label, &t.Nonce); err != nil {
			return httpx.Internal(err.Error())
		}
		targets[t.Label] = t
	}
	for _, o := range overposts {
		t, ok := targets[o.Label]
		if !ok {
			continue
		}
		if !strings.EqualFold(o.Value, "you are hacked") {
			continue
		}
		marker := "You are hacked | " + t.Nonce
		if _, err := h.Pool.Exec(context.Background(),
			"UPDATE profile_targets SET target_value = $1, updated_at = NOW() WHERE id = $2",
			marker, t.ID); err != nil {
			return httpx.Internal(err.Error())
		}
	}
	return nil
}

// ✅ Beta — зөвхөн зөвшөөрөгдсөн талбарууд + мэдэгдээгүй талбар 400.
func (h *ProfileHandler) updateBeta(userID int, raw map[string]json.RawMessage) error {
	allowed := map[string]bool{"name": true, "address": true}
	for key := range raw {
		if !allowed[key] {
			return httpx.Validation("мэдэгдээгүй талбар: " + key)
		}
	}
	clauses := []string{}
	params := []interface{}{}
	if v, ok := raw["name"]; ok {
		var s string
		if err := json.Unmarshal(v, &s); err != nil {
			return httpx.Validation("name string байх ёстой")
		}
		params = append(params, s)
		clauses = append(clauses, "username = $"+itoa(len(params)))
	}
	if v, ok := raw["address"]; ok {
		var s string
		if err := json.Unmarshal(v, &s); err != nil {
			return httpx.Validation("address string байх ёстой")
		}
		params = append(params, s)
		clauses = append(clauses, "address = $"+itoa(len(params)))
	}
	if len(clauses) == 0 {
		return nil
	}
	params = append(params, userID)
	sql := "UPDATE users SET " + strings.Join(clauses, ", ") + " WHERE id = $" + itoa(len(params))
	if _, err := h.Pool.Exec(context.Background(), sql, params...); err != nil {
		return httpx.Internal(err.Error())
	}
	return nil
}

func (h *ProfileHandler) fetch(userID int) (profileDTO, error) {
	var p profileDTO
	err := h.Pool.QueryRow(context.Background(),
		"SELECT id, username, email, role, is_admin, address FROM users WHERE id = $1 LIMIT 1",
		userID).Scan(&p.UserID, &p.Username, &p.Email, &p.Role, &p.IsAdmin, &p.Address)
	if errors.Is(err, pgx.ErrNoRows) {
		return p, httpx.NotFound("хэрэглэгч олдсонгүй")
	}
	if err != nil {
		return p, httpx.Internal(err.Error())
	}
	if p.Role != string(auth.RoleAdmin) {
		p.Role = string(auth.RoleCustomer)
	}
	return p, nil
}

func itoa(n int) string {
	if n == 0 {
		return "0"
	}
	var buf [12]byte
	pos := len(buf)
	for n > 0 {
		pos--
		buf[pos] = byte('0' + n%10)
		n /= 10
	}
	return string(buf[pos:])
}
