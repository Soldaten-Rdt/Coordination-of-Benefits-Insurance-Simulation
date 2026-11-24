package server

import (
	"fmt"
	"net/http"
	"os"
	"path/filepath"
)

func (a *App) registerSwaggerRoutes() {
	a.mux.HandleFunc("GET /swagger/", a.swaggerUI)
	a.mux.HandleFunc("GET /swagger/openapi.yaml", a.swaggerSpec)
}

func (a *App) swaggerSpec(w http.ResponseWriter, r *http.Request) {
	fileName := fmt.Sprintf("%s-api.yaml", a.service)
	searchPaths := []string{
		filepath.Join("docs", "openapi", fileName),
		filepath.Join("Docs", "openapi", fileName),
		filepath.Join("..", "docs", "openapi", fileName),
		filepath.Join("..", "Docs", "openapi", fileName),
		filepath.Join("/app", "docs", "openapi", fileName),
		filepath.Join("/app", "Docs", "openapi", fileName),
	}

	var lastErr error
	for _, p := range searchPaths {
		data, err := os.ReadFile(p)
		if err == nil {
			w.Header().Set("Content-Type", "text/yaml; charset=utf-8")
			w.WriteHeader(http.StatusOK)
			_, _ = w.Write(data)
			return
		}
		lastErr = err
	}

	http.Error(w, fmt.Sprintf("OpenAPI specification for %s service is unavailable: %v", a.service, lastErr), http.StatusInternalServerError)
}

func (a *App) swaggerUI(w http.ResponseWriter, r *http.Request) {
	html := fmt.Sprintf(`<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <title>KAPJ Flow - %s Service API Documentation</title>
  <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5.18.2/swagger-ui.css" />
  <style>
    body { margin: 0; padding: 0; background: #fafafa; font-family: sans-serif; }
    .topbar { display: none; }
  </style>
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@5.18.2/swagger-ui-bundle.js"></script>
  <script>
    window.onload = function() {
      SwaggerUIBundle({
        url: "/swagger/openapi.yaml",
        dom_id: '#swagger-ui',
        deepLinking: true,
        presets: [
          SwaggerUIBundle.presets.apis,
          SwaggerUIBundle.SwaggerUIStandalonePreset
        ],
        layout: "BaseLayout"
      });
    };
  </script>
</body>
</html>`, a.service)

	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write([]byte(html))
}
