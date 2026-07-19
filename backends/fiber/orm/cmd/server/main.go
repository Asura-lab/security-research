package main

import (
	"fmt"
	"log"

	"github.com/gofiber/fiber/v2"

	"security-research/fiber-orm/internal/auth"
	"security-research/fiber-orm/internal/config"
	"security-research/fiber-orm/internal/db"
	"security-research/fiber-orm/internal/handlers"
	"security-research/fiber-orm/internal/httpx"
	"security-research/fiber-orm/internal/telemetry"
)

func main() {
	cfg := config.Load()

	gormDB, err := db.Open(cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("gorm open: %v", err)
	}
	sqlDB, err := gormDB.DB()
	if err != nil {
		log.Fatalf("gorm db: %v", err)
	}
	sqlDB.SetMaxOpenConns(10)
	defer sqlDB.Close()

	telem := telemetry.NewClient(cfg)
	defer telem.Close()

	jwt := auth.NewManager(cfg.JWTSecret, cfg.JWTExpiresIn)

	app := fiber.New(fiber.Config{
		AppName:      "security-research/" + config.VariantName,
		ErrorHandler: httpx.ErrorHandler,
	})
	app.Use(telem.Middleware())

	authH := &handlers.AuthHandler{DB: gormDB, JWT: jwt}
	productsH := &handlers.ProductsHandler{DB: gormDB}
	ordersH := &handlers.OrdersHandler{DB: gormDB, Cfg: cfg}
	profileH := &handlers.ProfileHandler{DB: gormDB, Cfg: cfg}
	adminH := &handlers.AdminHandler{DB: gormDB}

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
