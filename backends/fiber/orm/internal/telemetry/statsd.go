package telemetry

import (
	"fmt"
	"log"
	"time"

	"github.com/DataDog/datadog-go/v5/statsd"
	"github.com/gofiber/fiber/v2"

	"security-research/fiber-orm/internal/config"
)

// Client нь Datadog dogstatsd-той харилцах clientийн wrapper. DD_AGENT_HOST байхгүй
// үед `nil` буцаана (халдлагын script нь statsd-гүйгээр ажиллаж чадна).
type Client struct {
	inner *statsd.Client
	tags  []string
}

func NewClient(cfg config.Config) *Client {
	if !cfg.StatsdEnabled {
		log.Println("telemetry disabled — DD_AGENT_HOST өгөгдөөгүй")
		return &Client{tags: baseTags(cfg)}
	}
	addr := fmt.Sprintf("%s:%d", cfg.StatsdHost, cfg.StatsdPort)
	c, err := statsd.New(addr, statsd.WithTags(baseTags(cfg)))
	if err != nil {
		log.Printf("statsd init failed: %v — telemetry disabled", err)
		return &Client{tags: baseTags(cfg)}
	}
	return &Client{inner: c, tags: baseTags(cfg)}
}

func (c *Client) Close() {
	if c.inner != nil {
		_ = c.inner.Close()
	}
}

func (c *Client) Timing(metric string, d time.Duration, extra ...string) {
	if c.inner == nil {
		return
	}
	_ = c.inner.Timing(metric, d, extra, 1.0)
}

func (c *Client) Increment(metric string, extra ...string) {
	if c.inner == nil {
		return
	}
	_ = c.inner.Incr(metric, extra, 1.0)
}

// Middleware нь хүсэлт бүрд duration + count илгээнэ.
func (c *Client) Middleware() fiber.Handler {
	return func(ctx *fiber.Ctx) error {
		start := time.Now()
		err := ctx.Next()
		d := time.Since(start)
		tags := []string{
			fmt.Sprintf("route:%s", ctx.Route().Path),
			fmt.Sprintf("method:%s", ctx.Method()),
			fmt.Sprintf("status:%d", ctx.Response().StatusCode()),
		}
		c.Timing("http.request.duration", d, tags...)
		c.Increment("http.request.count", tags...)
		return err
	}
}

func baseTags(cfg config.Config) []string {
	return []string{
		fmt.Sprintf("variant:%s", config.VariantName),
		fmt.Sprintf("implementation:%s", cfg.Implementation),
	}
}
