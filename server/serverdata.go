package server

type Chunck struct {
	_id      string
	files_id string
	n        int
	data     []byte
}

type Files struct {
	_id         string
	chunkSize   int
	uploadDate  string //*time.Time
	md5         string
	filename    string
	contentType string
	aliases     []string
	metadate    string //any
}

type Transfer struct {
	_id        string
	ack        bool
	transfered string //*[]time.Time
}

type Task struct {
	Id 	string `json:"_id"`
	Title	string `json:"title"`
	Description	string `json:"description"`
}

type Test_struct struct {
	Test string
}
