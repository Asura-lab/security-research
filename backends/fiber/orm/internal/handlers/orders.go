package handlers

import (
	"errors"
	"fmt"
	"strconv"
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"
	"gorm.io/gorm"

	"security-research/fiber-orm/internal/auth"
	"security-research/fiber-orm/internal/config"
	"security-research/fiber-orm/internal/db"
	"security-research/fiber-orm/internal/httpx"
)

// GORM хувилбарын BOLA туршилтын endpoint.
//
// Alpha: `First(&order, id)` — ownership check байхгүй, GORM-ын идэвхтэй чадвар.
// Beta:  `Where("id = ? AND user_id = ?", id, uid).First(&order)` — 404.

type OrdersHandler struct {
	DB  *gorm.DB
	Cfg config.Config
}

type orderItemDTO struct {
	ProductID int     `json:"product_id"`
	Quantity  int     `json:"quantity"`
	UnitPrice float64 `json:"unit_price"`
}

type orderDTO struct {
	ID     int            `json:"id"`
	UserID int            `json:"user_id"`
	Status string         `json:"status"`
	Total  float64        `json:"total"`
	Items  []orderItemDTO `json:"items"`
}

type createOrderReq struct {
	Items []struct {
		ProductID int `json:"product_id"`
		Quantity  int `json:"quantity"`
	} `json:"items"`
}

type updateOrderReq struct {
	Status string `json:"status"`
}

func (h *OrdersHandler) Create(ctx *fiber.Ctx) error {
	user, err := auth.FromCtx(ctx)
	if err != nil {
		return err
	}
	var body createOrderReq
	if err := ctx.BodyParser(&body); err != nil {
		return httpx.Validation("JSON алдаатай")
	}
	if len(body.Items) == 0 {
		return httpx.Validation("items хоосон байна")
	}

	err = h.DB.Transaction(func(tx *gorm.DB) error {
		order := db.Order{UserID: user.ID, Status: "pending", Total: 0}
		if err := tx.Create(&order).Error; err != nil {
			return err
		}
		var total float64
		for _, item := range body.Items {
			if item.Quantity < 1 {
				return httpx.Validation("quantity >= 1")
			}
			var p db.Product
			if err := tx.Select("price").First(&p, item.ProductID).Error; err != nil {
				if errors.Is(err, gorm.ErrRecordNotFound) {
					return httpx.NotFound(fmt.Sprintf("бараа %d олдсонгүй", item.ProductID))
				}
				return err
			}
			total += p.Price * float64(item.Quantity)
			pid := item.ProductID
			oi := db.OrderItem{OrderID: order.ID, ProductID: &pid, Quantity: item.Quantity, UnitPrice: p.Price}
			if err := tx.Create(&oi).Error; err != nil {
				return err
			}
		}
		return tx.Model(&db.Order{}).Where("id = ?", order.ID).Update("total", total).Error
	})
	if err != nil {
		if fe, ok := err.(*fiber.Error); ok {
			return fe
		}
		return httpx.Internal(err.Error())
	}
	var recent db.Order
	h.DB.Order("id DESC").First(&recent)
	return ctx.Status(fiber.StatusCreated).JSON(fiber.Map{"order": h.assemble(recent)})
}

func (h *OrdersHandler) Get(ctx *fiber.Ctx) error {
	user, err := auth.FromCtx(ctx)
	if err != nil {
		return err
	}
	id, err := strconv.Atoi(ctx.Params("id"))
	if err != nil {
		return httpx.Validation("id integer байх ёстой")
	}
	ord, err := h.findOrder(user, id)
	if err != nil {
		return err
	}
	return ctx.JSON(fiber.Map{"order": h.assemble(ord)})
}

func (h *OrdersHandler) Update(ctx *fiber.Ctx) error {
	user, err := auth.FromCtx(ctx)
	if err != nil {
		return err
	}
	id, err := strconv.Atoi(ctx.Params("id"))
	if err != nil {
		return httpx.Validation("id integer байх ёстой")
	}
	var body updateOrderReq
	if err := ctx.BodyParser(&body); err != nil {
		return httpx.Validation("JSON алдаатай")
	}
	if _, err := h.findOrder(user, id); err != nil {
		return err
	}

	if h.Cfg.Implementation == config.Beta {
		h.DB.Model(&db.Order{}).
			Where("id = ? AND user_id = ?", id, user.ID).
			Update("status", body.Status)
	} else {
		// ⚠️ Alpha — ownership check байхгүй.
		h.DB.Model(&db.Order{}).Where("id = ?", id).Update("status", body.Status)
	}

	if strings.EqualFold(body.Status, "you are hacked") {
		var target db.OrderTarget
		if err := h.DB.Where("order_id = ? AND vector = ?", id, "bola_put").First(&target).Error; err == nil {
			marker := fmt.Sprintf("You are hacked | %s", target.TargetNonce)
			h.DB.Model(&db.OrderTarget{}).Where("id = ?", target.ID).
				Updates(map[string]interface{}{"target_value": marker, "updated_at": time.Now()})
		}
	}

	var refreshed db.Order
	if err := h.DB.First(&refreshed, id).Error; err != nil {
		return httpx.NotFound("захиалга олдсонгүй")
	}
	return ctx.JSON(fiber.Map{"order": h.assemble(refreshed)})
}

func (h *OrdersHandler) Delete(ctx *fiber.Ctx) error {
	user, err := auth.FromCtx(ctx)
	if err != nil {
		return err
	}
	id, err := strconv.Atoi(ctx.Params("id"))
	if err != nil {
		return httpx.Validation("id integer байх ёстой")
	}
	if _, err := h.findOrder(user, id); err != nil {
		return err
	}

	var target db.OrderTarget
	hasTarget := h.DB.Where("order_id = ? AND vector = ?", id, "bola_delete").First(&target).Error == nil

	if h.Cfg.Implementation == config.Beta {
		res := h.DB.Where("id = ? AND user_id = ?", id, user.ID).Delete(&db.Order{})
		if res.Error != nil {
			return httpx.Internal(res.Error.Error())
		}
		if res.RowsAffected == 0 {
			return httpx.NotFound("захиалга олдсонгүй")
		}
	} else {
		if err := h.DB.Delete(&db.Order{}, id).Error; err != nil {
			return httpx.Internal(err.Error())
		}
	}

	if hasTarget {
		marker := fmt.Sprintf("DELETED by hacker | %s", target.TargetNonce)
		snap := db.TargetSnapshot{
			SnapshotID:  fmt.Sprintf("bola-delete-%d-%d", id, time.Now().UnixMilli()),
			TargetLabel: target.TargetLabel,
			ValueBefore: target.TargetValue,
			ValueAfter:  &marker,
		}
		h.DB.Create(&snap)
	}
	return ctx.SendStatus(fiber.StatusNoContent)
}

func (h *OrdersHandler) findOrder(user *auth.User, id int) (db.Order, error) {
	var ord db.Order
	var err error
	if h.Cfg.Implementation == config.Beta {
		err = h.DB.Where("id = ? AND user_id = ?", id, user.ID).First(&ord).Error
	} else {
		err = h.DB.First(&ord, id).Error
	}
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return ord, httpx.NotFound("захиалга олдсонгүй")
	}
	if err != nil {
		return ord, httpx.Internal(err.Error())
	}
	return ord, nil
}

func (h *OrdersHandler) assemble(order db.Order) orderDTO {
	var items []db.OrderItem
	h.DB.Where("order_id = ?", order.ID).Order("id").Find(&items)
	out := orderDTO{ID: order.ID, UserID: order.UserID, Status: order.Status, Total: order.Total}
	for _, it := range items {
		pid := 0
		if it.ProductID != nil {
			pid = *it.ProductID
		}
		out.Items = append(out.Items, orderItemDTO{ProductID: pid, Quantity: it.Quantity, UnitPrice: it.UnitPrice})
	}
	if out.Items == nil {
		out.Items = []orderItemDTO{}
	}
	return out
}
