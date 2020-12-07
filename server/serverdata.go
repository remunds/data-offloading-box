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

type Text struct {
	Text string //if just text was transmitted, e.g. answers to questions etc. (should be changed to Answer struct, Image struct, etc.)
}

type Test_struct struct {
	Test string
}
