package server

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"

	"github.com/gorilla/mux"
)

func getTasks(w http.ResponseWriter, r *http.Request) {
	task := Task{"123", "Clean the box", "please go ahead and clean the box from dirt."}
	task2 := Task{"124", "Photo of upper-tree", "please take a picture of the upper part of the tree."}
	task3 := Task{"125", "Reload battery", "please reload the battery."}
	taskArr := []Task{}
	taskArr = append(taskArr, task)
	taskArr = append(taskArr, task2)
	taskArr = append(taskArr, task3)

	bytes, err := json.Marshal(taskArr)
	if err != nil {
		log.Println(err)
	}
	w.Write(bytes)
}

//SetupServer will set up a HTTP Server with given handler functions
func SetupServer() {
	r := mux.NewRouter()

	//route to get all active Task from the DB
	r.HandleFunc("/api/getTasks", getTasks).Methods("GET").Headers("Content-Type", "application/json")

	fmt.Println("HTTP Server online")

	// Bind to a port and pass our router in
	log.Fatal(http.ListenAndServe(":8000", r))
}
