// general settings
const boxName = 'pi1'

// express server
const express = require('express')
const app = express()
app.use(express.json())
const port = 8000

const multer = require('multer')

// this is needed for the gridfs (the splitting of files/chunks)
const { createReadStream, unlinkSync } = require('fs')
const { createModel } = require('mongoose-gridfs')
const fileUpload = require('express-fileupload')
app.use(fileUpload({
  useTempFiles: true,
  tempFileDir: './tmp/'
}))

const schemas = require('./schemas')
const Task = schemas.task
const Image = schemas.image
const Chunk = schemas.chunk
const File = schemas.file

let dbIDsToDownload = new Map()


// gets the file or chunk with the highest priority to send next
// returns: File or Chunk with the highest priority, or
// if not existing: -1
async function getHighestPriorityFile () {
  let highestPriority
  // find oldest and least downloaded chunk + file
  const priorityChunk = await Chunk.findOne().sort({ downloads: 1, timestamp: 1 }).exec()
  const priorityFile = await File.findOne().sort({ downloads: 1, uploadDate: 1 }).exec()

  if (!priorityChunk && priorityFile && priorityFile.downloads != null && priorityFile.uploadDate != null) {
    // only a valid file could be found
    highestPriority = priorityFile
    // count downloads up
    File.updateOne({ _id: priorityFile.id }, { downloads: priorityFile.downloads + 1 }).exec()
  } else if (!priorityFile && priorityChunk && priorityChunk.downloads != null && priorityChunk.timestamp != null) {
    // only a valid chunk could be found
    highestPriority = priorityChunk
    Chunk.updateOne({ _id: priorityChunk.id }, { downloads: priorityChunk.downloads + 1 }).exec()
  } else {
    if (!priorityChunk || !priorityFile || priorityChunk.downloads == null || priorityFile.downloads == null ||
    !priorityChunk.timestamp || !priorityFile.uploadDate) {
    // neither a valid file nor a valid chunk could be found for uploading
      return -1
    }
    if (priorityChunk.downloads > priorityFile.downloads) {
      // the file has the higher priority due to downloads
      highestPriority = priorityFile
      File.updateOne({ _id: priorityFile.id }, { downloads: priorityFile.downloads + 1 }).exec()
    } else if (priorityChunk.downloads < priorityFile.downloads) {
      // the chunk has the higher priority due to downloads
      highestPriority = priorityChunk
      Chunk.updateOne({ _id: priorityChunk.id }, { downloads: priorityChunk.downloads + 1 }).exec()
    } else {
      // compare by timestamps (if all files/chunks have the same downloads)
      if (priorityChunk.timestamp >= priorityFile.uploadDate) {
      // the file has the higher priority due to timestamp
        highestPriority = priorityFile
        File.updateOne({ _id: priorityFile.id }, { downloads: priorityFile.downloads + 1 }).exec()
      } else {
      // the chunk has the higher priority due to timestamp
        highestPriority = priorityChunk
        Chunk.updateOne({ _id: priorityChunk.id }, { downloads: priorityChunk.downloads + 1 }).exec()
      }
    }
  }
  // copy to delete the downloads property
  const toReturn = ({ ...highestPriority }._doc)
  // downloads is not relevant for the application
  delete toReturn.downloads
  return toReturn
}

app.get('/api/register', (req, res) => {
  res.send({ piID: boxName, timestamp: Date.now() })
})

/* Register all ids from devices DB to filter them out of list to download
   as a result we get a new map entry with the devicce id(timestamp) as key
   and an array with all ids that are not downloaded yet as value.
   IDs already on phone are replaced with a "onPhone" string
   If no data found on box the download will be cancelled */
app.post('/api/registerCurrentData', async (req, res) => {
  console.log('Registering Device IDs... ')
  const currentIDs = req.body.idList
  const timestamp = req.body.timestamp
  console.log('DeviceID: ' + timestamp)
  let dbIDs = []

  dbIDs = await File.find({}, '_id')
  dbIDs = dbIDs.concat(await Chunk.find({}, '_id'))

  if (dbIDs.length === 0) {
    res.send(201)
  }

  if (currentIDs.length === 0) {
    dbIDsToDownload.set(req.body.timestamp, dbIDs)
  } else {
    let i
    let j

    for (i = 0; i < dbIDs.length; i++) {
      for (j = 0; j < currentIDs.length; j++) {
        if (dbIDs[i].id === currentIDs[j]) {
          dbIDs[i] = 'onPhone'
        }
      }
    }
    dbIDsToDownload.set(req.body.timestamp, dbIDs)
  }
  res.sendStatus(200)
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

/* Every time we call /api/getAllData the first id which is contained in the map will
 be searched in db and sent to the device. After that the id will be replaced with our "onPhone" String */
app.get('/api/getAllData', async (req, res) => {
  console.log('Getting a chunk or file')
  const timestamp = parseInt(req.query.deviceTimestamp)
  const dbIDs = dbIDsToDownload.get(timestamp)
  let i = 0
  while (dbIDs[i] === 'onPhone') {
    i++
  }
  if (i === dbIDs.length) {
    res.sendStatus(201)
    dbIDsToDownload.delete(timestamp)
    return
  }
  File.find({ _id: dbIDs[i].id }, (err, fileOrChunk) => {
    if (err) {
      res.status(400)
      res.send({ error: 'no files or chunks defined by given id' })
    } else if (fileOrChunk.length === 0) {
      Chunk.find({ _id: dbIDs[i].id }, (err, chunk) => {
        if (err) {
          res.status(400)
          res.send({ error: 'could not find file or chunk by given id' })
        }
        if (chunk.length === 0) {
          res.status(400)
          res.send({ error: 'no chunks defined by given id' })
        } else {
          fileOrChunk = chunk
          console.log(fileOrChunk[0], ' von chunk auf file ')
          console.log('sending chunk')
          res.send(fileOrChunk[0])
          dbIDs[i] = 'onPhone'
          dbIDsToDownload.set(timestamp, dbIDs)
          console.log(dbIDs)
        }
      })
    } else {
      console.log('sending file: ', fileOrChunk[0])
      res.send(fileOrChunk[0])
      dbIDs[i] = 'onPhone'
      dbIDsToDownload.set(timestamp, dbIDs)
    }
  })
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

// uploaded files are saved to the uploads directory to handle multipart data
const upload = multer({ dest: 'uploads/' })

app.post('/api/saveUserImage', upload.single('data'), (req, res) => {
  const type = req.body.type
  const label = req.body.label
  const imgBytes = req.body.data
  const data = Buffer.from(imgBytes, 'base64')
  const img = new Image({
    type: type,
    data: data,
    label: label
  })

  img.save(function (err, saved) {
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
app.post('/api/writeData', async (req, res) => {
  if (!req.files) {
    res.status(400)
    res.send({ error: 'no file' })
    return
  }

  // create model so that our collections are called fs.files and fs.chunks
  const fs = createModel({
    modelName: 'fs'
  })

  // write file to db
  const readStream = createReadStream(req.files.sensor.tempFilePath)
  const options = ({ filename: req.files.sensor.name, contentType: req.files.sensor.mimetype })
  await fs.write(options, readStream, async (error, file) => {
    if (!error) {
      res.status(200).send(req.body)
      unlinkSync(req.files.sensor.tempFilePath, (err) => {
        if (err) {
          console.log('something went wrong')
        }
      })
    }
    console.log('wrote file with id: ' + file._id)
    // add the field downloads to file and chunks; add timestamp to chunk
    File.findByIdAndUpdate(file._id, { downloads: 0 }).exec()
    Chunk.updateMany({ files_id: file._id }, { downloads: 0, timestamp: Date.now() }).exec()
  })
})

app.listen(port, () => {
  console.log(`listening at http://localhost:${port}`)
})

// mongoose controls our mongodb
const mongoose = require('mongoose')
mongoose.connect(`mongodb://localhost/${boxName}`, { useNewUrlParser: true, useUnifiedTopology: true, useCreateIndex: true, useFindAndModify: false })

const db = mongoose.connection
db.on('error', console.error.bind(console, 'connection error:'))
db.once('open', () => {
  // we're connected!
  console.log('connected to db')
  // generate tasks
  const generator = require('./taskgenerator')
  generator.apply()
})
