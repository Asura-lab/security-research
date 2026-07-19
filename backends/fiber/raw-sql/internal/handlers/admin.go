package handlers

import (
	"context"
	"strings"

	"github.com/gofiber/fiber/v2"
	"github.com/jackc/pgx/v5/pgxpool"

	"security-research/fiber-raw/internal/httpx"
)

// Detection endpoint — админ токенээр хандаж халдлагын дараах target-уудын статусыг буцаана.

type AdminHandler struct {
	Pool *pgxpool.Pool
}

type targetDTO struct {
	Label   string `json:"label"`
	Kind    string `json:"kind"`
	Value   string `json:"value"`
	Nonce   string `json:"nonce"`
	Deleted bool   `json:"deleted,omitempty"`
}

func (h *AdminHandler) TargetsStatus(ctx *fiber.Ctx) error {
	label := ctx.Query("label")
	targets := make([]targetDTO, 0)

	if err := h.appendSecrets(&targets, label); err != nil {
		return httpx.Internal(err.Error())
	}
	if err := h.appendOrderTargets(&targets, label); err != nil {
		return httpx.Internal(err.Error())
	}
	if err := h.appendDeletedSnapshots(&targets, label); err != nil {
		return httpx.Internal(err.Error())
	}
	if err := h.appendProfileTargets(&targets, label); err != nil {
		return httpx.Internal(err.Error())
	}
	return ctx.JSON(fiber.Map{"targets": targets})
}

func (h *AdminHandler) appendSecrets(dst *[]targetDTO, label string) error {
	sql := "SELECT secret_label, secret_value, secret_nonce FROM secrets"
	args := []interface{}{}
	if label != "" {
		sql += " WHERE secret_label = $1"
		args = append(args, label)
	}
	sql += " ORDER BY id ASC"
	rows, err := h.Pool.Query(context.Background(), sql, args...)
	if err != nil {
		return err
	}
	defer rows.Close()
	for rows.Next() {
		var t targetDTO
		t.Kind = "read"
		if err := rows.Scan(&t.Label, &t.Value, &t.Nonce); err != nil {
			return err
		}
		*dst = append(*dst, t)
	}
	return rows.Err()
}

func (h *AdminHandler) appendOrderTargets(dst *[]targetDTO, label string) error {
	sql := "SELECT target_label, target_value, target_nonce FROM order_targets"
	args := []interface{}{}
	if label != "" {
		sql += " WHERE target_label = $1"
		args = append(args, label)
	}
	sql += " ORDER BY id ASC"
	rows, err := h.Pool.Query(context.Background(), sql, args...)
	if err != nil {
		return err
	}
	defer rows.Close()
	for rows.Next() {
		var t targetDTO
		t.Kind = "write"
		if err := rows.Scan(&t.Label, &t.Value, &t.Nonce); err != nil {
			return err
		}
		*dst = append(*dst, t)
	}
	return rows.Err()
}

func (h *AdminHandler) appendDeletedSnapshots(dst *[]targetDTO, label string) error {
	sql := `SELECT DISTINCT ON (target_label) target_label, value_after
	        FROM target_snapshots
	        WHERE target_label LIKE 'WRITE_ORD_DEL_%'`
	args := []interface{}{}
	if label != "" {
		sql += " AND target_label = $1"
		args = append(args, label)
	}
	sql += " ORDER BY target_label, snapshot_ts DESC"
	rows, err := h.Pool.Query(context.Background(), sql, args...)
	if err != nil {
		return err
	}
	defer rows.Close()
	for rows.Next() {
		var t targetDTO
		t.Kind = "write"
		t.Deleted = true
		var value *string
		if err := rows.Scan(&t.Label, &value); err != nil {
			return err
		}
		if value == nil {
			continue
		}
		t.Value = *value
		if idx := strings.LastIndex(t.Value, "|"); idx >= 0 {
			t.Nonce = strings.TrimSpace(t.Value[idx+1:])
		}
		*dst = append(*dst, t)
	}
	return rows.Err()
}

func (h *AdminHandler) appendProfileTargets(dst *[]targetDTO, label string) error {
	sql := "SELECT target_label, target_value, target_nonce FROM profile_targets"
	args := []interface{}{}
	if label != "" {
		sql += " WHERE target_label = $1"
		args = append(args, label)
	}
	sql += " ORDER BY id ASC"
	rows, err := h.Pool.Query(context.Background(), sql, args...)
	if err != nil {
		return err
	}
	defer rows.Close()
	for rows.Next() {
		var t targetDTO
		t.Kind = "write"
		if err := rows.Scan(&t.Label, &t.Value, &t.Nonce); err != nil {
			return err
		}
		*dst = append(*dst, t)
	}
	return rows.Err()
}
