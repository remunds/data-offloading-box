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

const dbIDsToDownload = new Map()

// gets the file or chunk with the highest priority to send next
// returns: File or Chunk with the highest priority, or
// if not existing: -1
// input: bool priorityOld: true: sort by oldest date first, false: sort by newest date first
async function getHighestPriorityFile (priorityOld) {
  let highestPriority
  // find oldest and least downloaded chunk + file
  const sortBy = priorityOld ? 1 : -1
  const priorityChunk = await Chunk.findOne().sort({ downloads: 1, timestamp: sortBy }).exec()
  const priorityFile = await File.findOne().sort({ downloads: 1, uploadDate: sortBy }).exec()

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
      return null
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
      if ((priorityOld && priorityChunk.timestamp >= priorityFile.uploadDate) || (!priorityOld && priorityChunk.timestamp < priorityFile.uploadDate)) {
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

/* /api/register registers a device prior to data download
  response contains boxName so that device knows id of sensor box
  the device needs this id in order to communicate with this box
  response also contains a timestamp of the current time, this is
  used as device id assigned to the device by the sensor box
*/
app.get('/api/register', (req, res) => {
  res.send({ piId: boxName, timestamp: Date.now() })
})

/* Register all ids from devices DB to filter them out of list to download
   as a result we get a new map entry with the device id(timestamp) as key
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
    res.sendStatus(201)
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
    res.sendStatus(200)
  }
})

/* /api/getData request body contains field "data"
  if value of this field is old, then send oldest file on box
  if value is new, send newest file on box
  response contains corresponding file
*/
app.get('/api/getData', async (req, res) => {
  let fileToSend
  // the query data determines which priority we have: newest or oldest first.
  const priority = req.query.data
  if (priority === 'old') {
    fileToSend = await getHighestPriorityFile(true)
  } else if (priority === 'new') {
    fileToSend = await getHighestPriorityFile(false)
  } else {
    res.status(400).send({ error: 'query needs to be data=old or new' })
  }
  res.status(200).send(fileToSend)
})

/* Every time we call /api/getAllData the first id contained in the
  dbIDsToDownload map will be searched in db and sent to the device.
  After that the id will be replaced with "onPhone"
  since it's no longer needed.
  */
app.get('/api/getAllData', async (req, res) => {
  console.log('Getting a chunk or file')
  const timestamp = parseInt(req.query.deviceTimestamp)
  const dbIDs = dbIDsToDownload.get(timestamp)

  if (!dbIDs) {
    res.status(400).send({ error: 'Can not find list of ids by given deviceTimestamp' })
  }

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
      res.status(400).send({ error: 'no files or chunks defined by given id' })
    } else if (fileOrChunk.length === 0) {
      Chunk.find({ _id: dbIDs[i].id }, (err, chunk) => {
        if (err) {
          res.status(400).send({ error: 'could not find file or chunk by given id' })
        }
        if (chunk.length === 0) {
          res.status(400).send({ error: 'no chunks defined by given id' })
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

/* fetches all tasks from the database
  response contains list of all tasks or error message
*/
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

/* deletes a task from the database
  request body contains id of task to be deleted
*/
app.post('/api/deleteTask', (req, res) => {
  Task.deleteOne(req.body, (err) => {
    if (err) {
      res.status(400).send({ error: 'could not delete task' })
    } else {
      res.sendStatus(200)
    }
  })
})

/* fetches an image from the database
  Query: /api/getImage?id={imageID}
  imageID is id of image to be fetched
  response contains image or error message
*/
app.get('/api/getImage', (req, res) => {
  // get query, query.id = x if url ends with ?id=x
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

/* assigns labels to an image
  request body contains image id
  request body contains labels
  response contains all labels of image including the ones added in this function
*/
app.post('/api/putLabel', (req, res) => {
  if (!req.body.label || !req.body.id) {
    res.status(400).send({ error: 'empty input parameter' })
    return
  }

  // parse labels
  const labelList = req.body.label.toString().split(',').map((val) => { return val.trim() })

  // $push operation adds all elements of labelList array to label array in database
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

/* receives multipart data and stores image with label in database
  request body contains:
    - image as ByteStream
    - labels as String
    - takenBy (should be "user")
    - luxValue of image
*/
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

  // delete image from temporary storage
  unlink(req.file.path, (err) => {
    if (err) {
      res.status(500).send({ error: 'temp file could not be deleted' })
    } else {
      console.log('user image saved to db')
      res.sendStatus(200)
    }
  })

  // save image to database
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
    File.findByIdAndUpdate(file._id, { downloads: 0 }).exec()
    Chunk.updateMany({ files_id: file._id }, { downloads: 0, timestamp: Date.now() }).exec()
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
