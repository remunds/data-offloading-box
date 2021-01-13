// general settings
const boxName = 'pi1'

// express server
const express = require('express')
const bodyParser = require('body-parser')
const app = express()
app.use(express.json())
app.use(bodyParser.urlencoded({
  extended: false
}))
app.use(bodyParser.json())
const port = 8000

const schemas = require('./schemas')
const Task = schemas.task
const Image = schemas.image

// mongoose controls our mongodb
const mongoose = require('mongoose')
mongoose.connect(`mongodb://192.168.0.64/${boxName}`, { useNewUrlParser: true })

const db = mongoose.connection
db.on('error', console.error.bind(console, 'connection error:'))

app.get('/', (req, res) => {
  res.send('Hello World!')
})

app.get('/getData', (req, res) => {
  console.log('Getting Data!')
  res.send('Getting Data!')
})

app.get('/api/getTasks', (req, res) => {
  Task.find({}, (err, tasks) => {
    if (err) return console.error(err)
    console.log(tasks)
    res.send(tasks)
  })
})

app.post('/api/deleteTask', (req, res) => {
  const taskDel = req.body
  Task.deleteOne(taskDel, (err) => {
    if (err) return console.error(err)
    console.log('deleted')
    res.sendStatus(200)
  })
})

app.get('/api/getImage', (req, res) => {
  // get query, q.id = x if url ends with ?id=x
  //  var q = url.parse(req.url, true).query;
  const id = req.query.id
  Image.findById(id, (err, image) => {
    if (err) return console.error(err)
    res.send(image)
  })
})

app.post('/api/putLabel', (req, res) => {
  const id = req.body.id
  const lab = req.body.label

  Image.findByIdAndUpdate(id, { $push: { label: lab } }, { new: true, useFindAndModify: false }, function (err, result) {
    if (err) console.log(err)
    else {
      res.send(result.label)
    }
  })
})

app.post('/api/putLabel', (req, res) => {
  const id = req.body.id
  const lab = req.body.label

  Image.findByIdAndUpdate(id, { $push: { label: lab } }, { new: true, useFindAndModify: false }, function (err, result) {
    if (err) console.log(err)
    else {
      res.send(result.label)
    }
  })
})

app.post('/sendData', (req, res) => {
  res.send('youre trying to send data!')
  console.log(req.body)
})

app.listen(port, () => {
  console.log(`Example app listening at http://localhost:${port}`)
})
