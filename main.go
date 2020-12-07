package main

import (
	"github.com/remunds/data-offloading-box/server"
)

func main() {
	server.ConnectToDB("localhost:27017")
	server.SetupServer()
}
