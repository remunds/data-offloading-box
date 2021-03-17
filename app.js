// general settings
const config = require('./config.json')
const boxName = config.nodeName

// express server
const express = require('express')
const app = express()
app.use(express.json())
const port = config.backendPort

// this is needed for the gridfs (the splitting of files/chunks)
const { createReadStream, unlink, readFileSync } = require('fs')
const { createModel } = require('mongoose-gridfs')
const multer = require('multer')

// uploaded files are saved to the uploads directory to handle multipart data
const upload = multer({ dest: 'uploads/' })

const schemas = require('./schemas')
const Task = schemas.task
const Image = schemas.image
const Chunk = schemas.chunk
const File = schemas.file

// gets the file or chunk with the highest priority to send next
// returns: File or Chunk with the highest priority, or
// if not existing: -1
// input: bool priorityOld: true: sort by oldest date first, false: sort by newest date first
async function getHighestPriorityFile (priorityOld, timestamp) {
  let highestPriority
  // find oldest and least downloaded chunk + file
  const sortBy = priorityOld ? 1 : -1
  const priorityChunk = await Chunk.findOne().sort({ downloads: 1, timestamp: sortBy }).exec()
  const priorityFile = await File.findOne().sort({ downloads: 1, uploadDate: sortBy }).exec()

  if (!priorityChunk && priorityFile && priorityFile.downloads != null && priorityFile.uploadDate != null) {
    // only a valid file could be found
    highestPriority = priorityFile
    // count downloads up
    File.updateOne({ _id: priorityFile.id }, { downloads: priorityFile.downloads + 1, $push: { onPhones: timestamp } }).exec()
  } else if (!priorityFile && priorityChunk && priorityChunk.downloads != null && priorityChunk.timestamp != null) {
    // only a valid chunk could be found
    highestPriority = priorityChunk
    Chunk.updateOne({ _id: priorityChunk.id }, { downloads: priorityChunk.downloads + 1, $push: { onPhones: timestamp } }).exec()
  } else {
    if (!priorityChunk || !priorityFile || priorityChunk.downloads == null || priorityFile.downloads == null ||
      !priorityChunk.timestamp || !priorityFile.uploadDate) {
      // neither a valid file nor a valid chunk could be found for uploading
      return null
    }
    if (priorityChunk.downloads > priorityFile.downloads) {
      // the file has the higher priority due to downloads
      highestPriority = priorityFile
      File.updateOne({ _id: priorityFile.id }, { downloads: priorityFile.downloads + 1, $push: { onPhones: timestamp } }).exec()
    } else if (priorityChunk.downloads < priorityFile.downloads) {
      // the chunk has the higher priority due to downloads
      highestPriority = priorityChunk
      Chunk.updateOne({ _id: priorityChunk.id }, { downloads: priorityChunk.downloads + 1, $push: { onPhones: timestamp } }).exec()
    } else {
      // compare by timestamps (if all files/chunks have the same downloads)
      if ((priorityOld && priorityChunk.timestamp >= priorityFile.uploadDate) || (!priorityOld && priorityChunk.timestamp < priorityFile.uploadDate)) {
        // the file has the higher priority due to timestamp
        highestPriority = priorityFile
        File.updateOne({ _id: priorityFile.id }, { downloads: priorityFile.downloads + 1, $push: { onPhones: timestamp } }).exec()
      } else {
        // the chunk has the higher priority due to timestamp
        highestPriority = priorityChunk
        Chunk.updateOne({ _id: priorityChunk.id }, { downloads: priorityChunk.downloads + 1, $push: { onPhones: timestamp } }).exec()
      }
    }
  }
  // copy to delete the downloads property
  const toReturn = ({ ...highestPriority }._doc)
  // downloads is not relevant for the application
  delete toReturn.downloads
  return toReturn
}

// Registers devices and gives every device a unique ID.
app.get('/api/register', async (req, res) => {
  res.send({ piId: boxName, timestamp: Date.now() })
})

app.get('/api/getData', async (req, res) => {
  const timestamp = parseInt(req.query.deviceTimestamp)
  let fileToSend
  // the query data determines which priority we have: newest or oldest first.
  const priority = req.query.data
  if (priority === 'old') {
    fileToSend = await getHighestPriorityFile(true, timestamp)
  } else if (priority === 'new') {
    fileToSend = await getHighestPriorityFile(false, timestamp)
  } else {
    res.status(400).send({ error: 'query needs to be data=old or new' })
  }
  res.status(200).send(fileToSend)
})

/* Every time we call /api/getAllData the first chunk whose timestamp is not contained in the db
 will be sent to the device. After that the timestamp will be saved */
app.get('/api/getAllData', async (req, res) => {
  const timestamp = parseInt(req.query.deviceTimestamp)
  File.findOne({ onPhones: { $ne: timestamp } }, (err, file) => {
    if (err) {
      console.log(err)
      res.status(400).send({ error: 'no file found' })
    }
    if (!file) {
      Chunk.findOne({ onPhones: { $ne: timestamp } }, (err, chunk) => {
        if (err) {
          console.log(err)
          res.status(400).send({ error: 'no chunk found' })
        }
        if (!chunk) {
          console.log('download completed')
          res.sendStatus(201)
          return
        }
        console.log('sending chunk: ', chunk)
        res.send(chunk)
        Chunk.updateOne({ _id: chunk.id }, { $push: { onPhones: timestamp } }).exec()
      })
      return
    }
    console.log('sending file: ', file)
    res.send(file)
    File.updateOne({ _id: file.id }, { $push: { onPhones: timestamp } }).exec()
  })
})
app.get('/api/getTasks', (req, res) => {
  Task.find({}, (err, tasks) => {
    if (err) {
      res.status(400).send({ error: 'database not available' })
    }
    if (tasks == null) {
      res.status(400).send({ error: 'no tasks defined' })
    } else {
      res.send(tasks)
    }
  })
})

app.post('/api/deleteTask', (req, res) => {
  Task.deleteOne(req.body, (err) => {
    if (err) {
      res.status(400).send({ error: 'could not delete task' })
    } else {
      res.sendStatus(200)
    }
  })
})

app.get('/api/getImage', (req, res) => {
  // get query, q.id = x if url ends with ?id=x
  Image.findById(req.query.id, (err, image) => {
    if (err) {
      res.status(400).send({ error: 'database error' })
    } else if (!image) {
      res.status(400).send({ error: 'could not find image in database' })
    } else {
      res.send(image)
    }
  })
})

app.post('/api/putLabel', (req, res) => {
  if (!req.body.label || !req.body.id) {
    res.status(400).send({ error: 'empty input parameter' })
    return
  }

  // parse labels
  const labelList = req.body.label.toString().split(',').map((val) => { return val.trim() })

  Image.findByIdAndUpdate(req.body.id, { $push: { label: { $each: labelList } } }, { new: true, useFindAndModify: false }, (err, result) => {
    if (err) {
      res.status(400).send({ error: 'database error' })
      return
    }
    if (!result) {
      res.status(400).send({ error: 'could not find image in database' })
    } else {
      res.send(result.label)
    }
  })
})

app.post('/api/saveUserImage', upload.single('data'), (req, res) => {
  if (!req.body.takenBy || !req.body.label) {
    res.status(400).send({ error: 'missing input parameter' })
    return
  }

  if (!req.file) {
    res.status(400).send({ error: 'missing file' })
    return
  }

  // parse labels
  const labelList = req.body.label.toString().split(',').map((val) => { return val.trim() })

  const img = new Image({
    type: 'image/jpeg',
    data: Buffer.from(readFileSync(req.file.path), 'base64'),
    takenBy: req.body.takenBy,
    label: labelList,
    luxValue: req.body.luxValue
  })
  unlink(req.file.path, (err) => {
    if (err) {
      res.status(500).send({ error: 'temp file could not be deleted' })
    } else {
      console.log('user image saved to db')
      res.sendStatus(200)
    }
  })

  img.save()
    .then((err, saved) => {
      if (err) {
        res.sendStatus(500)
        res.send({ error: 'image could not be saved to database' })
      } else {
        console.log('user image saved to db')
        res.sendStatus(200)
      }
    })
})

// chunks Data and writes it to DB
// Example:
// Query: /api/writeData/
// Body: contains file as form-data type: 'file' and name: 'sensor'
app.post('/api/writeData', upload.single('sensor'), async (req, res) => {
  // create model so that our collections are called fs.files and fs.chunks
  const fs = createModel({
    modelName: 'fs'
  })

  // write file to db
  console.log(req.sensor != null)
  const readStream = createReadStream(req.file.path)
  const options = ({ filename: req.file.originalname, contentType: req.file.mimetype })
  await fs.write(options, readStream, async (error, file) => {
    if (error) {
      res.status(500).send({ error: 'could not chunk file' })
    }
    console.log('wrote file with id: ' + file._id)
    // add the field downloads to file and chunks; add timestamp to chunk
    File.findByIdAndUpdate(file._id, { downloads: 0, onPhones: [] }).exec()
    Chunk.updateMany({ files_id: file._id }, { downloads: 0, timestamp: Date.now(), onPhones: [] }).exec()
    unlink(req.file.path, (err) => {
      if (err) {
        res.status(500).send({ error: 'could not delete tmp file' })
      } else {
        res.status(200).send({ error: '' })
      }
    })
  })
})

const server = app.listen(port, () => {
  console.log(`listening at http://localhost:${port}`)
})

// mongoose controls our mongodb
const mongoose = require('mongoose')
mongoose.connect(`mongodb://${config.dbIp}/${boxName}`, { useNewUrlParser: true, useUnifiedTopology: true, useCreateIndex: true, useFindAndModify: false })

const db = mongoose.connection
db.on('error', console.error.bind(console, 'connection error:'))
db.once('open', () => {
  // we're connected!
  console.log('connected to db')

  const generator = require('./taskgenerator')
  generator.apply()

  const dtnd = require('./dtnd.js')
  dtnd.apply()
})

module.exports = server
