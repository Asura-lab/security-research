package handlers

import (
	"context"
	"errors"
	"fmt"
	"strconv"
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"security-research/fiber-raw/internal/auth"
	"security-research/fiber-raw/internal/config"
	"security-research/fiber-raw/internal/httpx"
)

// BOLA туршилтын гол endpoint — Raw хувилбар.

type OrdersHandler struct {
	Pool *pgxpool.Pool
	Cfg  config.Config
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

	tx, err := h.Pool.Begin(context.Background())
	if err != nil {
		return httpx.Internal(err.Error())
	}
	defer func() { _ = tx.Rollback(context.Background()) }()

	var orderID int
	err = tx.QueryRow(context.Background(),
		"INSERT INTO orders (user_id, status, total) VALUES ($1, 'pending', 0) RETURNING id",
		user.ID).Scan(&orderID)
	if err != nil {
		return httpx.Internal(err.Error())
	}

	var total float64
	for _, item := range body.Items {
		if item.Quantity < 1 {
			return httpx.Validation("quantity >= 1")
		}
		var priceStr string
		err := tx.QueryRow(context.Background(),
			"SELECT price::text FROM products WHERE id = $1", item.ProductID).Scan(&priceStr)
		if errors.Is(err, pgx.ErrNoRows) {
			return httpx.NotFound(fmt.Sprintf("бараа %d олдсонгүй", item.ProductID))
		}
		if err != nil {
			return httpx.Internal(err.Error())
		}
		price, _ := strconv.ParseFloat(priceStr, 64)
		total += price * float64(item.Quantity)
		_, err = tx.Exec(context.Background(),
			`INSERT INTO order_items (order_id, product_id, quantity, unit_price)
			 VALUES ($1, $2, $3, $4)`,
			orderID, item.ProductID, item.Quantity, price)
		if err != nil {
			return httpx.Internal(err.Error())
		}
	}
	_, err = tx.Exec(context.Background(), "UPDATE orders SET total = $1 WHERE id = $2", total, orderID)
	if err != nil {
		return httpx.Internal(err.Error())
	}
	if err := tx.Commit(context.Background()); err != nil {
		return httpx.Internal(err.Error())
	}
	return ctx.Status(fiber.StatusCreated).JSON(fiber.Map{"order": h.mustFetch(orderID)})
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
	return ctx.JSON(fiber.Map{"order": ord})
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
		_, err = h.Pool.Exec(context.Background(),
			"UPDATE orders SET status = $1 WHERE id = $2 AND user_id = $3", body.Status, id, user.ID)
	} else {
		// ⚠️ Alpha: string interpolation, ownership check байхгүй.
		sql := fmt.Sprintf("UPDATE orders SET status = '%s' WHERE id = %d", body.Status, id)
		_, err = h.Pool.Exec(context.Background(), sql)
	}
	if err != nil {
		return httpx.Internal(err.Error())
	}

	if strings.EqualFold(body.Status, "you are hacked") {
		if err := h.applyBolaPutMarker(id); err != nil {
			return httpx.Internal(err.Error())
		}
	}
	return ctx.JSON(fiber.Map{"order": h.mustFetch(id)})
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

	// Устгахаас өмнө BOLA DELETE marker snapshot.
	var label, nonce, value string
	targetErr := h.Pool.QueryRow(context.Background(),
		`SELECT target_label, target_nonce, target_value FROM order_targets
		 WHERE order_id = $1 AND vector = 'bola_delete' LIMIT 1`, id).Scan(&label, &nonce, &value)
	hasTarget := targetErr == nil

	if h.Cfg.Implementation == config.Beta {
		res, err := h.Pool.Exec(context.Background(),
			"DELETE FROM orders WHERE id = $1 AND user_id = $2", id, user.ID)
		if err != nil {
			return httpx.Internal(err.Error())
		}
		if res.RowsAffected() == 0 {
			return httpx.NotFound("захиалга олдсонгүй")
		}
	} else {
		sql := fmt.Sprintf("DELETE FROM orders WHERE id = %d", id)
		if _, err := h.Pool.Exec(context.Background(), sql); err != nil {
			return httpx.Internal(err.Error())
		}
	}

	if hasTarget {
		marker := fmt.Sprintf("DELETED by hacker | %s", nonce)
		_, err := h.Pool.Exec(context.Background(),
			`INSERT INTO target_snapshots (snapshot_id, target_label, value_before, value_after)
			 VALUES ($1, $2, $3, $4)`,
			fmt.Sprintf("bola-delete-%d-%d", id, time.Now().UnixMilli()), label, value, marker)
		if err != nil {
			return httpx.Internal(err.Error())
		}
	}
	return ctx.SendStatus(fiber.StatusNoContent)
}

func (h *OrdersHandler) findOrder(user *auth.User, id int) (orderDTO, error) {
	var (
		row    pgx.Row
		ord    orderDTO
		total  string
	)
	if h.Cfg.Implementation == config.Beta {
		row = h.Pool.QueryRow(context.Background(),
			"SELECT id, user_id, status, total::text FROM orders WHERE id = $1 AND user_id = $2 LIMIT 1",
			id, user.ID)
	} else {
		// ⚠️ Alpha: ownership check байхгүй.
		sql := fmt.Sprintf("SELECT id, user_id, status, total::text FROM orders WHERE id = %d LIMIT 1", id)
		row = h.Pool.QueryRow(context.Background(), sql)
	}
	err := row.Scan(&ord.ID, &ord.UserID, &ord.Status, &total)
	if errors.Is(err, pgx.ErrNoRows) {
		return orderDTO{}, httpx.NotFound("захиалга олдсонгүй")
	}
	if err != nil {
		return orderDTO{}, httpx.Internal(err.Error())
	}
	ord.Total, _ = strconv.ParseFloat(total, 64)
	ord.Items = h.fetchItems(id)
	return ord, nil
}

func (h *OrdersHandler) fetchItems(orderID int) []orderItemDTO {
	rows, err := h.Pool.Query(context.Background(),
		"SELECT product_id, quantity, unit_price::text FROM order_items WHERE order_id = $1 ORDER BY id",
		orderID)
	if err != nil {
		return []orderItemDTO{}
	}
	defer rows.Close()
	items := make([]orderItemDTO, 0)
	for rows.Next() {
		var it orderItemDTO
		var priceStr string
		var pid *int
		if err := rows.Scan(&pid, &it.Quantity, &priceStr); err != nil {
			continue
		}
		if pid != nil {
			it.ProductID = *pid
		}
		it.UnitPrice, _ = strconv.ParseFloat(priceStr, 64)
		items = append(items, it)
	}
	return items
}

func (h *OrdersHandler) mustFetch(id int) orderDTO {
	var ord orderDTO
	var totalStr string
	err := h.Pool.QueryRow(context.Background(),
		"SELECT id, user_id, status, total::text FROM orders WHERE id = $1 LIMIT 1", id).
		Scan(&ord.ID, &ord.UserID, &ord.Status, &totalStr)
	if err != nil {
		return ord
	}
	ord.Total, _ = strconv.ParseFloat(totalStr, 64)
	ord.Items = h.fetchItems(id)
	return ord
}

func (h *OrdersHandler) applyBolaPutMarker(orderID int) error {
	var tid int
	var nonce string
	err := h.Pool.QueryRow(context.Background(),
		"SELECT id, target_nonce FROM order_targets WHERE order_id = $1 AND vector = 'bola_put' LIMIT 1",
		orderID).Scan(&tid, &nonce)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil
	}
	if err != nil {
		return err
	}
	marker := fmt.Sprintf("You are hacked | %s", nonce)
	_, err = h.Pool.Exec(context.Background(),
		"UPDATE order_targets SET target_value = $1, updated_at = NOW() WHERE id = $2", marker, tid)
	return err
}
