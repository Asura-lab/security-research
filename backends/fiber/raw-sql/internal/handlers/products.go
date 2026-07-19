package handlers

import (
	"context"
	"fmt"
	"strconv"
	"strings"

	"github.com/gofiber/fiber/v2"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"security-research/fiber-raw/internal/config"
	"security-research/fiber-raw/internal/httpx"
)

// SQL Injection туршилтын гол endpoint — Raw хувилбар.
//
// Alpha: query параметрүүд шууд `fmt.Sprintf`-ээр залгагдана — vulnerable-by-design.
// Beta:  `pgx`-ийн parameterized query. SQLi 3 вектор бүгд хаагдана.

type ProductsHandler struct {
	Pool *pgxpool.Pool
	Cfg  config.Config
}

type productDTO struct {
	ID          int      `json:"id"`
	Name        string   `json:"name"`
	Description *string  `json:"description"`
	Price       float64  `json:"price"`
	CategoryID  *int     `json:"category_id"`
}

func (h *ProductsHandler) List(ctx *fiber.Ctx) error {
	query := ctx.Queries()
	limit := parseLimit(query["limit"])

	var rows pgx.Rows
	var err error
	if h.Cfg.Implementation == config.Beta {
		rows, err = h.listBeta(query, limit)
	} else {
		rows, err = h.listAlpha(query, limit)
	}
	if err != nil {
		return httpx.Internal(err.Error())
	}
	defer rows.Close()

	items := make([]productDTO, 0)
	for rows.Next() {
		var p productDTO
		var priceStr string
		if err := rows.Scan(&p.ID, &p.Name, &p.Description, &priceStr, &p.CategoryID); err != nil {
			return httpx.Internal(err.Error())
		}
		p.Price, _ = strconv.ParseFloat(priceStr, 64)
		items = append(items, p)
	}
	if err := rows.Err(); err != nil {
		return httpx.Internal(err.Error())
	}
	return ctx.JSON(fiber.Map{"items": items})
}

// ⚠️ Alpha — string interpolation. SQLi UNION/Boolean/Error бүгд боломжтой.
func (h *ProductsHandler) listAlpha(query map[string]string, limit int) (pgx.Rows, error) {
	clauses := []string{"1=1"}
	if v, ok := query["search"]; ok {
		clauses = append(clauses, fmt.Sprintf("name LIKE '%%%s%%'", v))
	}
	if v, ok := query["category"]; ok {
		clauses = append(clauses, fmt.Sprintf("category_id = %s", v))
	}
	if v, ok := query["min_price"]; ok {
		clauses = append(clauses, fmt.Sprintf("price >= %s", v))
	}
	if v, ok := query["max_price"]; ok {
		clauses = append(clauses, fmt.Sprintf("price <= %s", v))
	}
	sql := fmt.Sprintf(
		`SELECT id, name, description, price::text, category_id FROM products WHERE %s ORDER BY id ASC LIMIT %d`,
		strings.Join(clauses, " AND "), limit,
	)
	return h.Pool.Query(context.Background(), sql)
}

// ✅ Beta — parameterized.
func (h *ProductsHandler) listBeta(query map[string]string, limit int) (pgx.Rows, error) {
	clauses := []string{"1=1"}
	params := []interface{}{}
	if v, ok := query["search"]; ok {
		params = append(params, "%"+v+"%")
		clauses = append(clauses, fmt.Sprintf("name LIKE $%d", len(params)))
	}
	if v, ok := query["category"]; ok {
		n, _ := strconv.Atoi(v)
		params = append(params, n)
		clauses = append(clauses, fmt.Sprintf("category_id = $%d", len(params)))
	}
	if v, ok := query["min_price"]; ok {
		n, _ := strconv.ParseFloat(v, 64)
		params = append(params, n)
		clauses = append(clauses, fmt.Sprintf("price >= $%d", len(params)))
	}
	if v, ok := query["max_price"]; ok {
		n, _ := strconv.ParseFloat(v, 64)
		params = append(params, n)
		clauses = append(clauses, fmt.Sprintf("price <= $%d", len(params)))
	}
	params = append(params, limit)
	sql := fmt.Sprintf(
		`SELECT id, name, description, price::text, category_id FROM products WHERE %s ORDER BY id ASC LIMIT $%d`,
		strings.Join(clauses, " AND "), len(params),
	)
	return h.Pool.Query(context.Background(), sql, params...)
}

func (h *ProductsHandler) Get(ctx *fiber.Ctx) error {
	id, err := strconv.Atoi(ctx.Params("id"))
	if err != nil {
		return httpx.Validation("id integer байх ёстой")
	}
	var p productDTO
	var priceStr string
	err = h.Pool.QueryRow(context.Background(),
		"SELECT id, name, description, price::text, category_id FROM products WHERE id = $1 LIMIT 1",
		id).Scan(&p.ID, &p.Name, &p.Description, &priceStr, &p.CategoryID)
	if err != nil {
		if isNoRows(err) {
			return httpx.NotFound("бараа олдсонгүй")
		}
		return httpx.Internal(err.Error())
	}
	p.Price, _ = strconv.ParseFloat(priceStr, 64)
	return ctx.JSON(fiber.Map{"product": p})
}

func parseLimit(raw string) int {
	if raw == "" {
		return 50
	}
	n, err := strconv.Atoi(raw)
	if err != nil || n <= 0 {
		return 50
	}
	if n > 50 {
		return 50
	}
	return n
}

func isNoRows(err error) bool {
	return err != nil && err.Error() == pgx.ErrNoRows.Error()
}
