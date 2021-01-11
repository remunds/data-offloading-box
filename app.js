//general settings
const boxName = 'pi1';

//express server
const express = require('express')
const bodyParser = require('body-parser')
const app = express()
app.use(express.json())
app.use(bodyParser.urlencoded({
  extended: false
}))
app.use(bodyParser.json())
const port = 8000

const schemas = require('./schemas');
const Task = schemas.task;

//mongoose controls our mongodb
const mongoose = require('mongoose');
mongoose.connect(`mongodb://192.168.0.64/${boxName}`, {useNewUrlParser: true});

const db = mongoose.connection;
db.on('error', console.error.bind(console, 'connection error:'));

app.get('/', (req, res) => {
  res.send('Hello World!')
})

app.get('/getData', (req, res) => {
  console.log('Getting Data!')
  res.send('Getting Data!')
})

app.get('/api/getTasks', (req, res) => {
  Task.find((err, tasks) => {
    if (err) return console.error(err);
    console.log(tasks);
    res.send(tasks)
  });
})

app.post('/api/deleteTask', (req, res) =>{
  var taskDel = req.body;
  Task.deleteOne(taskDel, (err) => {
    if(err) return console.error(err);
    console.log("deleted");
    res.sendStatus(200);
  });
});

app.post('/sendData', (req, res) => {
  res.send('youre trying to send data!')
  console.log(req.body);
})

app.listen(port, () => {
  console.log(`Example app listening at http://localhost:${port}`)
})