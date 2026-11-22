package database

import (
	"context"
	"embed"
	"fmt"
	"os"
	"sort"
	"strings"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

//go:embed migrations/*.sql
var migrations embed.FS

func Open(ctx context.Context, service string) (*pgxpool.Pool, error) {
	url := strings.TrimSpace(getenv("DATABASE_URL"))
	if url == "" {
		return nil, fmt.Errorf("DATABASE_URL is required")
	}
	pool, err := pgxpool.New(ctx, url)
	if err != nil {
		return nil, fmt.Errorf("connect database: %w", err)
	}
	if err = pool.Ping(ctx); err != nil {
		pool.Close()
		return nil, fmt.Errorf("ping database: %w", err)
	}
	files, err := migrations.ReadDir("migrations")
	if err != nil {
		pool.Close()
		return nil, fmt.Errorf("read migrations: %w", err)
	}
	var selected []string
	for _, file := range files {
		if strings.HasPrefix(file.Name(), service+"_") && strings.HasSuffix(file.Name(), ".sql") {
			selected = append(selected, file.Name())
		}
	}
	sort.Strings(selected)
	if len(selected) == 0 {
		pool.Close()
		return nil, fmt.Errorf("no migrations found for service %q", service)
	}
	for _, name := range selected {
		sql, readErr := migrations.ReadFile("migrations/" + name)
		if readErr != nil {
			pool.Close()
			return nil, fmt.Errorf("read migration %s: %w", name, readErr)
		}
		tx, beginErr := pool.Begin(ctx)
		if beginErr != nil {
			pool.Close()
			return nil, fmt.Errorf("begin migration %s: %w", name, beginErr)
		}
		if _, err = tx.Exec(ctx, string(sql), pgx.QueryExecModeSimpleProtocol); err != nil {
			_ = tx.Rollback(ctx)
			pool.Close()
			return nil, fmt.Errorf("apply migration %s: %w", name, err)
		}
		if err = tx.Commit(ctx); err != nil {
			pool.Close()
			return nil, fmt.Errorf("commit migration %s: %w", name, err)
		}
	}
	return pool, nil
}

func getenv(key string) string {
	return strings.TrimSpace(os.Getenv(key))
}
