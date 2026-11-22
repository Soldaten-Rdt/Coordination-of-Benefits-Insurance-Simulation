package httpclient

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"strings"
	"time"
)

type Client struct {
	client *http.Client
	key    string
	source string
}

func New(source string) *Client {
	return &Client{
		client: &http.Client{Timeout: 8 * time.Second},
		key:    os.Getenv("KAPJ_SERVICE_KEY"),
		source: source,
	}
}

func (c *Client) PostJSON(ctx context.Context, endpoint string, payload interface{}) error {
	if c.key == "" {
		return fmt.Errorf("KAPJ_SERVICE_KEY is not configured")
	}
	body, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("encode webhook payload: %w", err)
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, bytes.NewReader(body))
	if err != nil {
		return fmt.Errorf("create webhook request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-KAPJ-Service-Key", c.key)
	req.Header.Set("X-KAPJ-Source-Node", c.source)
	resp, err := c.client.Do(req)
	if err != nil {
		return fmt.Errorf("send webhook to %s: %w", endpoint, err)
	}
	defer resp.Body.Close()
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return fmt.Errorf("webhook to %s returned HTTP %d", endpoint, resp.StatusCode)
	}
	return nil
}

func Endpoint(baseURL, path string) string {
	return strings.TrimRight(baseURL, "/") + "/" + strings.TrimLeft(path, "/")
}
