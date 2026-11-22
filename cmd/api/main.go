package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/Soldaten-Rdt/Coordination-of-Benefits-Insurance-Simulation/internal/server"
)

func main() {
	service := os.Getenv("SERVICE")
	if service == "" {
		log.Fatal("SERVICE must be hospital, bpjs, or insurer")
	}
	port := os.Getenv("PORT")
	if port == "" {
		port = "8081"
	}
	app, err := server.New(context.Background(), service)
	if err != nil {
		log.Fatalf("initialize %s service: %v", service, err)
	}

	srv := &http.Server{
		Addr:              ":" + port,
		Handler:           app.Handler(),
		ReadHeaderTimeout: 5 * time.Second,
	}
	go func() {
		log.Printf("%s service listening on :%s", service, port)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("serve: %v", err)
		}
	}()

	stop := make(chan os.Signal, 1)
	signal.Notify(stop, syscall.SIGINT, syscall.SIGTERM)
	<-stop
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := srv.Shutdown(ctx); err != nil {
		log.Printf("shutdown: %v", err)
	}
}
