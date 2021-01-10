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

//mongoose controls our mongodb
const mongoose = require('mongoose');
mongoose.connect(`mongodb://192.168.0.64/${boxName}`, {useNewUrlParser: true});

//data
var taskList; 
var Task;

const db = mongoose.connection;
db.on('error', console.error.bind(console, 'connection error:'));

//Sending Tasks "function"
db.once('open', () => {
  // we're connected!
  console.log('connected to db');

  //access task from schemas.js
  Task = require('./schemas').task;
});



app.get('/', (req, res) => {
  res.send('Hello World!')
})

app.get('/getData', (req, res) => {
  console.log('Getting Data!')
  res.send('Getting Data!')
})

app.get('/api/getTasks', (req, res) => {
  //a query would normally need to be executed after save has fully finished:
  // TestTask.save().then(() => {//call find here})
  // await could also work
  Task.find((err, tasks) => {
    if (err) return console.error(err);
    console.log(tasks);
    taskList = tasks
  });
  var taskListJson = JSON.stringify(taskList)
  res.send(taskListJson)
})

app.post('/api/deleteTask', (req, res) =>{
  var taskDel = req.body;
  console.log(req.body, " <- Thats the printed result")
  //taskDel = JSON.parse(taskDel);
  Task.deleteOne(taskDel, (err) => {
    if(err) return console.error(err);
  });
  console.log("Deleted");
  res.sendStatus(200);
});

app.post('/sendData', (req, res) => {
  res.send('youre trying to send ddata!')
  console.log(req.body);
})

app.listen(port, () => {
  console.log(`Example app listening at http://localhost:${port}`)
})


// // db.once('open', () => {
// //   // we're connected!
// //   console.log('connected to db');

// //   //access task from schemas.js
// //   const Task = require('./schemas').task;

// //   //create new task
// //   //const TestTask = new Task({ title: 'testizzda', asdf: 1337});

// //   //call methods of models like this
// //   // TestTask.speak();

// //   //save task to mongodb like this
// //   // TestTask.save();

// //   //a query would normally need to be executed after save has fully finished:
// //   // TestTask.save().then(() => {//call find here})
// //   // await could also work
// //   Task.find((err, tasks) => {
// //     if (err) return console.error(err);
// //     console.log(tasks);
// //   });

// });