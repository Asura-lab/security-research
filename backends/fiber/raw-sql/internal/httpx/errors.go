package httpx

import (
	"errors"
	"log"

	"github.com/gofiber/fiber/v2"
)

// ErrorCode нь contract-т заасан snake_case алдааны код.
type ErrorCode string

const (
	CodeValidation   ErrorCode = "validation_error"
	CodeUnauthorized ErrorCode = "invalid_token"
	CodeForbidden    ErrorCode = "forbidden"
	CodeNotFound     ErrorCode = "not_found"
	CodeConflict     ErrorCode = "conflict"
	CodeInternal     ErrorCode = "internal"
)

type httpError struct {
	status  int
	code    ErrorCode
	message string
}

func (e *httpError) Error() string { return e.message }

func Validation(msg string) error   { return &httpError{fiber.StatusBadRequest, CodeValidation, msg} }
func Unauthorized(msg string) error { return &httpError{fiber.StatusUnauthorized, CodeUnauthorized, msg} }
func Forbidden(msg string) error    { return &httpError{fiber.StatusForbidden, CodeForbidden, msg} }
func NotFound(msg string) error     { return &httpError{fiber.StatusNotFound, CodeNotFound, msg} }
func Conflict(msg string) error     { return &httpError{fiber.StatusConflict, CodeConflict, msg} }
func Internal(msg string) error     { return &httpError{fiber.StatusInternalServerError, CodeInternal, msg} }

// ErrorHandler нь бүх алдааг contract-т нийцсэн ErrorResponse хэлбэрт буулгана.
func ErrorHandler(ctx *fiber.Ctx, err error) error {
	var he *httpError
	if errors.As(err, &he) {
		body := fiber.Map{"error": string(he.code)}
		if he.message != "" {
			body["message"] = he.message
		}
		return ctx.Status(he.status).JSON(body)
	}
	var fe *fiber.Error
	if errors.As(err, &fe) {
		switch fe.Code {
		case fiber.StatusBadRequest:
			return ctx.Status(fe.Code).JSON(fiber.Map{"error": string(CodeValidation), "message": fe.Message})
		case fiber.StatusUnauthorized:
			return ctx.Status(fe.Code).JSON(fiber.Map{"error": string(CodeUnauthorized)})
		case fiber.StatusForbidden:
			return ctx.Status(fe.Code).JSON(fiber.Map{"error": string(CodeForbidden)})
		case fiber.StatusNotFound:
			return ctx.Status(fe.Code).JSON(fiber.Map{"error": string(CodeNotFound)})
		}
	}
	log.Printf("internal error: %v", err)
	return ctx.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": string(CodeInternal)})
}
