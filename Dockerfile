FROM golang:1.24-alpine AS build
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 go build -o /out/kapj-api ./cmd/api

FROM alpine:3.21
RUN adduser -D -u 10001 appuser
WORKDIR /app
COPY --from=build /out/kapj-api /app/kapj-api
COPY --from=build /src/Docs/openapi /app/docs/openapi
RUN mkdir -p /app/uploads && chown -R appuser:appuser /app
USER appuser
EXPOSE 8081
ENTRYPOINT ["/app/kapj-api"]
