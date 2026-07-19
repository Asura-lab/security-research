package handlers

import (
	"strings"

	"github.com/gofiber/fiber/v2"
	"gorm.io/gorm"

	"security-research/fiber-orm/internal/db"
	"security-research/fiber-orm/internal/httpx"
)

type AdminHandler struct {
	DB *gorm.DB
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

	var secrets []db.Secret
	q := h.DB.Model(&db.Secret{}).Order("id asc")
	if label != "" {
		q = q.Where("secret_label = ?", label)
	}
	if err := q.Find(&secrets).Error; err != nil {
		return httpx.Internal(err.Error())
	}
	for _, s := range secrets {
		targets = append(targets, targetDTO{
			Label: s.SecretLabel, Kind: "read", Value: s.SecretValue, Nonce: s.SecretNonce,
		})
	}

	var orderTargets []db.OrderTarget
	q2 := h.DB.Model(&db.OrderTarget{}).Order("id asc")
	if label != "" {
		q2 = q2.Where("target_label = ?", label)
	}
	if err := q2.Find(&orderTargets).Error; err != nil {
		return httpx.Internal(err.Error())
	}
	for _, t := range orderTargets {
		targets = append(targets, targetDTO{
			Label: t.TargetLabel, Kind: "write", Value: t.TargetValue, Nonce: t.TargetNonce,
		})
	}

	// BOLA DELETE snapshots — raw SQL — GORM $queryRaw эквивалент.
	type delRow struct {
		Label string
		Value *string
	}
	var rows []delRow
	sql := `SELECT DISTINCT ON (target_label) target_label AS label, value_after AS value
	        FROM target_snapshots WHERE target_label LIKE 'WRITE_ORD_DEL_%'`
	if label != "" {
		sql += " AND target_label = ?"
		h.DB.Raw(sql+" ORDER BY target_label, snapshot_ts DESC", label).Scan(&rows)
	} else {
		h.DB.Raw(sql + " ORDER BY target_label, snapshot_ts DESC").Scan(&rows)
	}
	for _, r := range rows {
		if r.Value == nil {
			continue
		}
		nonce := ""
		if idx := strings.LastIndex(*r.Value, "|"); idx >= 0 {
			nonce = strings.TrimSpace((*r.Value)[idx+1:])
		}
		targets = append(targets, targetDTO{
			Label: r.Label, Kind: "write", Value: *r.Value, Nonce: nonce, Deleted: true,
		})
	}

	var profileTargets []db.ProfileTarget
	q3 := h.DB.Model(&db.ProfileTarget{}).Order("id asc")
	if label != "" {
		q3 = q3.Where("target_label = ?", label)
	}
	if err := q3.Find(&profileTargets).Error; err != nil {
		return httpx.Internal(err.Error())
	}
	for _, t := range profileTargets {
		targets = append(targets, targetDTO{
			Label: t.TargetLabel, Kind: "write", Value: t.TargetValue, Nonce: t.TargetNonce,
		})
	}

	return ctx.JSON(fiber.Map{"targets": targets})
}
