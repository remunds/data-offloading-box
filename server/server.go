package server

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"

	"github.com/gorilla/mux"
)

//TODO: 
//testID of PI_ID, needs to be parsed from the config file
var id string = "testID"

func postChunk(w http.ResponseWriter, r *http.Request) {
	var piID string = mux.Vars(r)["raspberryPiId"]
	var document Test_struct // muss geändert werden
	err := json.NewDecoder(r.Body).Decode(&document)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	statusCode, statusMessage := Insert(piID, "chunk", document)
	w.WriteHeader(statusCode)
	w.Write(statusMessage)
}

// func postFile(w http.ResponseWriter, r *http.Request) {
// 	var piID string = mux.Vars(r)[id]
// 	var document Text //change accordingly to expected filetype
// 	err := json.NewDecoder(r.Body).Decode(&document)
// 	if err != nil {
// 		http.Error(w, err.Error(), http.StatusBadRequest)
// 		return
// 	}
// 	statusCode, statusMessage := InsertText(piID, "file", document)
// 	w.WriteHeader(statusCode)
// 	w.Write(statusMessage)
// }

func getTasks(w http.ResponseWriter, r *http.Request) {
	task := Task{"123", "Clean the box", "please go ahead and clean the box from dirt."}
	task2 := Task{"124", "Photo of upper-tree", "please take a picture of the upper part of the tree."}
	task2 := Task{"125", "Reload battery", "please reload the battery."}
	taskArr := []Task{}
	taskArr = append(taskArr, task)
	taskArr = append(taskArr, task2)

	bytes, err := json.Marshal(taskArr)
	if err != nil {
		log.Println(err)
	}
	w.Write(bytes)
}

func getAllData(w http.ResponseWriter, r *http.Request) {
	w.WriteHeader(501)
}

//SetupServer will set up a HTTP Server with given handler functions
func SetupServer() {
	r := mux.NewRouter()

	// Routes consist of a path and a handler function.
	r.HandleFunc("/api/postData/{raspberryPiId}", postChunk).Methods("POST").Queries("format", "chunk").Headers("Content-Type", "application/json")


	//those two are implemented atm
	//r.HandleFunc("/api/postData", postFile).Methods("POST").Queries("format", "file").Headers("Content-Type", "application/json")
	r.HandleFunc("/api/getTasks", getTasks).Methods("GET").Headers("Content-Type", "application/json")
	// r.HandleFunc("/api/getData", getData).Methods("GET").Headers("Content-Type", "application/json")

	r.HandleFunc("/api/getAllData", getAllData).Methods("GET").Headers("Content-Type", "application/json")
	fmt.Println("HTTP Server only")

	// Bind to a port and pass our router in
	log.Fatal(http.ListenAndServe(":8000", r))
}
