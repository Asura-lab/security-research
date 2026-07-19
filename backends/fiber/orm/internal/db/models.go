package db

import "time"

// GORM models — SQL schema-той нэг мөр:
//   - `TableName()` нь табиг зурна
//   - Custom column нэрүүд нь struct field-ээс автоматаар camel_case→snake_case
//     хөрвүүлэлт (`Field:"username"`) хэрэглэгддэг тул зөв map хийнэ.

type User struct {
	ID           int       `gorm:"primaryKey;autoIncrement"`
	Username     string    `gorm:"column:username;size:50;uniqueIndex"`
	Email        string    `gorm:"column:email;size:255;uniqueIndex"`
	PasswordHash string    `gorm:"column:password_hash;size:255"`
	Role         string    `gorm:"column:role;size:20;default:customer"`
	IsAdmin      bool      `gorm:"column:is_admin;default:false"`
	Address      *string   `gorm:"column:address"`
	CreatedAt    time.Time `gorm:"column:created_at;autoCreateTime"`
}

func (User) TableName() string { return "users" }

type Category struct {
	ID   int    `gorm:"primaryKey;autoIncrement"`
	Name string `gorm:"column:name;size:100"`
}

func (Category) TableName() string { return "categories" }

type Product struct {
	ID          int       `gorm:"primaryKey;autoIncrement"`
	Name        string    `gorm:"column:name;size:200"`
	Description *string   `gorm:"column:description"`
	Price       float64   `gorm:"column:price;type:numeric(10,2)"`
	CategoryID  *int      `gorm:"column:category_id"`
	CreatedAt   time.Time `gorm:"column:created_at;autoCreateTime"`
}

func (Product) TableName() string { return "products" }

type Order struct {
	ID        int       `gorm:"primaryKey;autoIncrement"`
	UserID    int       `gorm:"column:user_id"`
	Status    string    `gorm:"column:status;size:20;default:pending"`
	Total     float64   `gorm:"column:total;type:numeric(10,2)"`
	CreatedAt time.Time `gorm:"column:created_at;autoCreateTime"`

	Items []OrderItem `gorm:"foreignKey:OrderID"`
}

func (Order) TableName() string { return "orders" }

type OrderItem struct {
	ID        int     `gorm:"primaryKey;autoIncrement"`
	OrderID   int     `gorm:"column:order_id"`
	ProductID *int    `gorm:"column:product_id"`
	Quantity  int     `gorm:"column:quantity"`
	UnitPrice float64 `gorm:"column:unit_price;type:numeric(10,2)"`
}

func (OrderItem) TableName() string { return "order_items" }

type Secret struct {
	ID          int       `gorm:"primaryKey;autoIncrement"`
	OwnerID     *int      `gorm:"column:owner_id"`
	SecretValue string    `gorm:"column:secret_value;size:255"`
	SecretNonce string    `gorm:"column:secret_nonce;size:64"`
	SecretLabel string    `gorm:"column:secret_label;size:100"`
	Vector      string    `gorm:"column:vector;size:20"`
	CreatedAt   time.Time `gorm:"column:created_at;autoCreateTime"`
}

func (Secret) TableName() string { return "secrets" }

type OrderTarget struct {
	ID          int       `gorm:"primaryKey;autoIncrement"`
	OrderID     int       `gorm:"column:order_id"`
	TargetValue string    `gorm:"column:target_value;size:255"`
	TargetNonce string    `gorm:"column:target_nonce;size:64"`
	TargetLabel string    `gorm:"column:target_label;size:100"`
	Vector      string    `gorm:"column:vector;size:20"`
	UpdatedAt   time.Time `gorm:"column:updated_at;autoUpdateTime"`
}

func (OrderTarget) TableName() string { return "order_targets" }

type ProfileTarget struct {
	ID          int       `gorm:"primaryKey;autoIncrement"`
	UserID      int       `gorm:"column:user_id"`
	TargetValue string    `gorm:"column:target_value;size:255"`
	TargetNonce string    `gorm:"column:target_nonce;size:64"`
	TargetLabel string    `gorm:"column:target_label;size:100"`
	UpdatedAt   time.Time `gorm:"column:updated_at;autoUpdateTime"`
}

func (ProfileTarget) TableName() string { return "profile_targets" }

type TargetSnapshot struct {
	ID           int       `gorm:"primaryKey;autoIncrement"`
	SnapshotID   string    `gorm:"column:snapshot_id;size:36"`
	TargetLabel  string    `gorm:"column:target_label;size:100"`
	ValueBefore  string    `gorm:"column:value_before;size:255"`
	ValueAfter   *string   `gorm:"column:value_after;size:255"`
	SnapshotTs   time.Time `gorm:"column:snapshot_ts;autoCreateTime"`
}

func (TargetSnapshot) TableName() string { return "target_snapshots" }
