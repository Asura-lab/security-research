package handlers

import (
	"strconv"

	"github.com/gofiber/fiber/v2"
	"gorm.io/gorm"

	"security-research/fiber-orm/internal/db"
	"security-research/fiber-orm/internal/httpx"
)

// GORM `Where("col LIKE ?", pattern)` — параметржүүлсэн. SQLi боломж байхгүй.
// Alpha/Beta ялгаа байхгүй (GORM string interp API-г түгээмэл ашиглах шаардлагагүй).

type ProductsHandler struct {
	DB *gorm.DB
}

type productDTO struct {
	ID          int     `json:"id"`
	Name        string  `json:"name"`
	Description *string `json:"description"`
	Price       float64 `json:"price"`
	CategoryID  *int    `json:"category_id"`
}

func (h *ProductsHandler) List(ctx *fiber.Ctx) error {
	q := h.DB.Model(&db.Product{})
	if v := ctx.Query("search"); v != "" {
		q = q.Where("name LIKE ?", "%"+v+"%")
	}
	if v := ctx.Query("category"); v != "" {
		if n, err := strconv.Atoi(v); err == nil {
			q = q.Where("category_id = ?", n)
		}
	}
	if v := ctx.Query("min_price"); v != "" {
		if n, err := strconv.ParseFloat(v, 64); err == nil {
			q = q.Where("price >= ?", n)
		}
	}
	if v := ctx.Query("max_price"); v != "" {
		if n, err := strconv.ParseFloat(v, 64); err == nil {
			q = q.Where("price <= ?", n)
		}
	}
	limit := parseLimit(ctx.Query("limit"))

	var products []db.Product
	if err := q.Order("id asc").Limit(limit).Find(&products).Error; err != nil {
		return httpx.Internal(err.Error())
	}
	items := make([]productDTO, 0, len(products))
	for _, p := range products {
		items = append(items, productDTO{
			ID: p.ID, Name: p.Name, Description: p.Description, Price: p.Price, CategoryID: p.CategoryID,
		})
	}
	return ctx.JSON(fiber.Map{"items": items})
}

func (h *ProductsHandler) Get(ctx *fiber.Ctx) error {
	id, err := strconv.Atoi(ctx.Params("id"))
	if err != nil {
		return httpx.Validation("id integer байх ёстой")
	}
	var p db.Product
	if err := h.DB.First(&p, id).Error; err != nil {
		return httpx.NotFound("бараа олдсонгүй")
	}
	return ctx.JSON(fiber.Map{"product": productDTO{
		ID: p.ID, Name: p.Name, Description: p.Description, Price: p.Price, CategoryID: p.CategoryID,
	}})
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
