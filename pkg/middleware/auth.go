package middleware

import (
	"context"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/Soldaten-Rdt/Coordination-of-Benefits-Insurance-Simulation/pkg/response"
	"github.com/golang-jwt/jwt/v5"
)

type principalKey struct{}

type Principal struct {
	UserID int64
	Email  string
	Name   string
	Role   string
}

func PrincipalFrom(ctx context.Context) (Principal, bool) {
	value, ok := ctx.Value(principalKey{}).(Principal)
	return value, ok
}

func SignToken(userID int64, email, name, role string) (string, error) {
	secret := []byte(os.Getenv("JWT_SECRET"))
	claims := jwt.MapClaims{
		"sub": userID, "email": email, "name": name, "role": role,
		"iat": time.Now().Unix(), "exp": time.Now().Add(8 * time.Hour).Unix(),
	}
	return jwt.NewWithClaims(jwt.SigningMethodHS256, claims).SignedString(secret)
}

func RequireJWT(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if len(os.Getenv("JWT_SECRET")) < 32 {
			response.Fail(w, http.StatusInternalServerError, "AUTH_NOT_CONFIGURED", "JWT_SECRET must contain at least 32 characters")
			return
		}
		header := strings.TrimSpace(r.Header.Get("Authorization"))
		parts := strings.SplitN(header, " ", 2)
		if len(parts) != 2 || !strings.EqualFold(parts[0], "Bearer") {
			response.Fail(w, http.StatusUnauthorized, "UNAUTHORIZED", "A valid bearer token is required")
			return
		}
		claims := jwt.MapClaims{}
		token, err := jwt.ParseWithClaims(parts[1], claims, func(token *jwt.Token) (interface{}, error) {
			if token.Method != jwt.SigningMethodHS256 {
				return nil, jwt.ErrSignatureInvalid
			}
			return []byte(os.Getenv("JWT_SECRET")), nil
		})
		if err != nil || !token.Valid {
			response.Fail(w, http.StatusUnauthorized, "UNAUTHORIZED", "The access token is invalid or expired")
			return
		}
		userID, ok := claims["sub"].(float64)
		email, emailOK := claims["email"].(string)
		name, nameOK := claims["name"].(string)
		role, roleOK := claims["role"].(string)
		if !ok || !emailOK || !nameOK || !roleOK {
			response.Fail(w, http.StatusUnauthorized, "UNAUTHORIZED", "The access token is incomplete")
			return
		}
		ctx := context.WithValue(r.Context(), principalKey{}, Principal{
			UserID: int64(userID), Email: email, Name: name, Role: role,
		})
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

func RequireServiceKey(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		key := os.Getenv("KAPJ_SERVICE_KEY")
		if len(key) < 32 {
			response.Fail(w, http.StatusInternalServerError, "SERVICE_AUTH_NOT_CONFIGURED", "KAPJ_SERVICE_KEY must contain at least 32 characters")
			return
		}
		if r.Header.Get("X-KAPJ-Service-Key") != key {
			response.Fail(w, http.StatusForbidden, "FORBIDDEN", "A valid inter-service key is required")
			return
		}
		source := r.Header.Get("X-KAPJ-Source-Node")
		if source != "hospital" && source != "bpjs" && source != "insurer" {
			response.Fail(w, http.StatusForbidden, "FORBIDDEN", "A valid X-KAPJ-Source-Node is required")
			return
		}
		next.ServeHTTP(w, r)
	})
}
