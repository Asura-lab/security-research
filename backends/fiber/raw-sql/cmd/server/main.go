package main

import (
	"context"
	"fmt"
	"log"

	"github.com/gofiber/fiber/v2"

	"security-research/fiber-raw/internal/auth"
	"security-research/fiber-raw/internal/config"
	"security-research/fiber-raw/internal/db"
	"security-research/fiber-raw/internal/handlers"
	"security-research/fiber-raw/internal/httpx"
	"security-research/fiber-raw/internal/telemetry"
)

func main() {
	cfg := config.Load()

	pool, err := db.NewPool(context.Background(), cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("pgx pool: %v", err)
	}
	defer pool.Close()

	telem := telemetry.NewClient(cfg)
	defer telem.Close()

	jwt := auth.NewManager(cfg.JWTSecret, cfg.JWTExpiresIn)

	app := fiber.New(fiber.Config{
		AppName:      "security-research/" + config.VariantName,
		ErrorHandler: httpx.ErrorHandler,
	})
	app.Use(telem.Middleware())

	authH := &handlers.AuthHandler{Pool: pool, JWT: jwt}
	productsH := &handlers.ProductsHandler{Pool: pool, Cfg: cfg}
	ordersH := &handlers.OrdersHandler{Pool: pool, Cfg: cfg}
	profileH := &handlers.ProfileHandler{Pool: pool, Cfg: cfg}
	adminH := &handlers.AdminHandler{Pool: pool}

	app.Get("/health", func(c *fiber.Ctx) error {
		return c.JSON(fiber.Map{
			"status":         "ok",
			"variant":        config.VariantName,
			"implementation": string(cfg.Implementation),
		})
	})

	api := app.Group("/api")
	api.Post("/auth/register", authH.Register)
	api.Post("/auth/login", authH.Login)
	api.Get("/products", productsH.List)
	api.Get("/products/:id", productsH.Get)

	protected := api.Use(jwt.Middleware())
	protected.Post("/orders", ordersH.Create)
	protected.Get("/orders/:id", ordersH.Get)
	protected.Put("/orders/:id", ordersH.Update)
	protected.Delete("/orders/:id", ordersH.Delete)
	protected.Get("/profile", profileH.Get)
	protected.Put("/profile", profileH.Update)
	protected.Get("/admin/targets/status", auth.RequireAdmin(), adminH.TargetsStatus)

	addr := fmt.Sprintf(":%d", config.HTTPPort)
	log.Printf("%s (%s) — port %d", config.VariantName, cfg.Implementation, config.HTTPPort)
	if err := app.Listen(addr); err != nil {
		log.Fatalf("listen: %v", err)
	}
}
