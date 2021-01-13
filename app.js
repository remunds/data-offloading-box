// general settings
const boxName = 'pi1'

// express server
const express = require('express')
const app = express()
app.use(express.json())
const port = 8000

const schemas = require('./schemas')
const Task = schemas.task
const Image = schemas.image
const Chunk = schemas.chunk
const File = schemas.file

async function getHighestPriorityFile () {
  let highestPriority
  // find oldest and least downloaded chunk + file
  const priorityChunk = await Chunk.findOne().sort({ downloads: 1, timestamp: 1 }).exec()
  const priorityFile = await File.findOne().sort({ downloads: 1, uploadDate: 1 }).exec()
  if (priorityChunk.downloads == null || priorityFile.downloads == null ||
    priorityChunk.timestamp == null || priorityFile.uploadDate == null) {
    return -1
  }
  if (priorityChunk.downloads > priorityFile.downloads) {
    highestPriority = priorityFile
    // count downloads up
    File.updateOne({ _id: priorityFile.id }, { downloads: priorityFile.downloads + 1 }).exec()
  } else if (priorityChunk.downloads < priorityFile.downloads) {
    highestPriority = priorityChunk
    Chunk.updateOne({ _id: priorityChunk.id }, { downloads: priorityChunk.downloads + 1 }).exec()
  } else {
    if (priorityChunk.timestamp >= priorityFile.uploadDate) {
      highestPriority = priorityFile
      File.updateOne({ _id: priorityFile.id }, { downloads: priorityFile.downloads + 1 }).exec()
    } else {
      highestPriority = priorityChunk
      Chunk.updateOne({ _id: priorityChunk.id }, { downloads: priorityChunk.downloads + 1 }).exec()
    }
  }
  // copy to delete the downloads property
  const toReturn = ({ ...highestPriority }._doc)
  delete toReturn.downloads
  return toReturn
}

app.get('/api/register', (req, res) => {
  res.send({ piID: boxName })
})

app.get('/api/getData', async (req, res) => {
  const fileToSend = await getHighestPriorityFile()
  if (fileToSend === -1) {
    res.status(400)
    res.send({ error: 'could not find highest priority file' })
  } else {
    res.send(fileToSend)
  }
})

app.get('/api/getTasks', (req, res) => {
  Task.find({}, (err, tasks) => {
    if (err) {
      res.status(400)
      res.send({ error: 'database not available' })
    }
    if (tasks == null) {
      res.status(400)
      res.send({ error: 'no tasks defined' })
    } else {
      res.send(tasks)
    }
  })
})

app.post('/api/deleteTask', (req, res) => {
  Task.deleteOne(req.body, (err) => {
    if (err) {
      res.status(400)
      res.send({ error: 'could not delete task' })
    } else {
      res.sendStatus(200)
    }
  })
})

app.get('/api/getImage', (req, res) => {
  // get query, q.id = x if url ends with ?id=x
  Image.findById(req.query.id, (err, image) => {
    if (err) {
      res.status(400)
      res.send({ error: 'database error' })
    } else if (image == null) {
      res.status(400)
      res.send({ error: 'could not find image in database' })
    } else {
      res.send(image)
    }
  })
})

app.post('/api/putLabel', (req, res) => {
  // post query, q.id = x; q.label = y if url ends with ?id=x&?label=y
  Image.findByIdAndUpdate(req.body.id, { $push: { label: req.body.label } }, { new: true, useFindAndModify: false }, (err, result) => {
    if (err) {
      res.status(400)
      res.send({ error: 'database error' })
    }
    if (result == null) {
      res.status(400)
      res.send({ error: 'could not find image in database' })
    } else {
      res.send(result.label)
    }
  })
})

app.listen(port, () => {
  console.log(`listening at http://localhost:${port}`)
})

// mongoose controls our mongodb
const mongoose = require('mongoose')
mongoose.connect(`mongodb://192.168.0.102/${boxName}`, { useNewUrlParser: true, useUnifiedTopology: true })

const db = mongoose.connection
db.on('error', console.error.bind(console, 'connection error:'))
db.once('open', () => {
  // we're connected!
  console.log('connected to db')
  // generate tasks
  const generator = require('./taskgenerator')
  generator.apply()
})
