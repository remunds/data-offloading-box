// general settings
const config = require('./config.json')
const boxName = config.nodeName

// express server
const express = require('express')
const app = express()
app.use(express.json())
const port = config.port

// this is needed for the gridfs (the splitting of files/chunks)
const { createReadStream, unlinkSync, unlink, readFileSync, writeFileSync } = require('fs')
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

/* /api/register registers a device prior to data download
  response contains boxName so that device knows id of sensor box
  the device needs this id in order to communicate with this box
  response also contains a timestamp of the current time, this is
  used as device id assigned to the device by the sensor box
*/
app.get('/api/register', async (req, res) => {
  res.send({ piId: boxName, timestamp: Date.now() })
})

/* /api/getData request body contains field "data"
  if value of this field is old, then send oldest file on box
  if value is new, send newest file on box
  response contains corresponding file
*/
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

/* deletes a task from the database
  request body contains id of task to be deleted
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

/* assigns labels to an image
  request body contains image id
  request body contains labels
  response contains all labels of image including the ones added in this function
*/
app.post('/api/putLabel', async (req, res) => {
  if (!req.body.label || !req.body.id) {
    res.status(400).send({ error: 'empty input parameter' })
    return
  }

  // parse labels
  const labelList = req.body.label.toString().split(',').map((val) => { return val.trim() })
  await Image.findByIdAndUpdate(req.body.id, { $push: { label: { $each: labelList } }, $inc: { people: 1 } }, { new: true, useFindAndModify: false }, (err, result) => {
    if (err) {
      res.status(400).send({ error: 'database error' })
      return
    }
    if (!result) {
      res.status(400).send({ error: 'could not find image in database' })
    } else {
      res.status(200).send(result.label)
    }
  })

  // check for people
  const maxPeople = 5
  const image = await Image.findById(req.body.id).exec()
  if (image == null) {
    console.log({ error: 'could not find image in database' })
  } else {
    if (image.people >= maxPeople) {
      writeFileSync('./uploads/' + req.body.id + '.json', JSON.stringify(image), 'utf8', (err) => {
        console.log(err)
      })
      const fs = createModel({
        modelName: 'fs'
      })
      const readStream = createReadStream('./uploads/' + req.body.id + '.json')
      const options = ({ filename: req.body.id, contentType: 'image/jpeg' })
      await fs.write(options, readStream, async (error, file) => {
        if (error) {
          console.log('could not chunk file')
        } else {
          console.log('wrote file with id: ' + file._id)
          // add the field downloads to file and chunks; add timestamp to chunk
          File.findByIdAndUpdate(file._id, { downloads: 0 }).exec()
          Chunk.updateMany({ files_id: file._id }, { downloads: 0, timestamp: Date.now() }).exec()
          Image.deleteOne({ _id: req.body.id }).exec()
          unlinkSync('./uploads/' + req.body.id + '.json')
        }
      })
    }
  }
})

/* receives multipart data and stores image with label in database
  request body contains:
    - image as ByteStream
    - labels as String
    - takenBy (should be "user")
    - luxValue of image
*/
app.post('/api/saveUserImage', upload.single('data'), (req, res) => {
  if (!req.file) {
    res.status(400).send({ error: 'missing file' })
    return
  }

  if (!req.body.takenBy || !req.body.label) {
    res.status(400).send({ error: 'missing input parameter' })
  } else {
    // parse labels
    const labelList = req.body.label.toString().split(',').map((val) => { return val.trim() })

    const img = new Image({
      type: 'image/jpeg',
      data: Buffer.from(readFileSync(req.file.path), 'base64'),
      takenBy: req.body.takenBy,
      label: labelList,
      luxValue: req.body.luxValue,
      people: 0
    })

    // save image to database
    img.save().catch(() => {
      res.status(500).send({ error: 'image could not be saved to database' })
    })
  }
  unlinkSync(req.file.path)
  res.status(200).send()
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
  const readStream = createReadStream(req.file.path)
  const options = ({ filename: req.file.originalname, contentType: req.file.mimetype })
  await fs.write(options, readStream, async (error, file) => {
    if (error) {
      res.status(500).send({ error: 'could not chunk file' })
    }
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
