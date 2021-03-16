const mongoose = require('mongoose')

// create taskSchema
const taskSchema = new mongoose.Schema({
  // careful: title and imageId (if != null) need to be unique
  title: String,
  description: String,
  // imageId is null if task is not an image task
  imageId: String
})

// create imageSchema
const imageSchema = new mongoose.Schema({
  // type of image (e.g. jpeg)
  type: String,
  // contains image data
  data: Buffer,
  // indicates who took this image
  takenBy: String,
  // assigned labels for this image
  label: [],
  // light value of image
  luxValue: Number
})

// creates chunkSchema
const chunkSchema = new mongoose.Schema({
  // time of image creation
  timestamp: Number,
  // amount of times a chunk has been downloaded already
  downloads: Number,
  // id of file this chunk belongs to
  files_id: mongoose.ObjectId,
  // number of chunk regarding the file it belongs to
  n: Number,
  // actual data to be transmitted
  data: [Buffer]
})

// creates fileSchema
const fileSchema = new mongoose.Schema({
  // amount of times a file has been downloaded already
  downloads: Number,
  // number of chunks
  length: Number,
  // size of a single chunk
  chunkSize: Number,
  // date of file upload
  uploadDate: Number,
  // hash
  md5: String,
  filename: String,
  contentType: String,
  aliases: [String]
})

// export the mongoose model with the name Task (creates collection tasks)
module.exports.task = mongoose.model('Task', taskSchema)
module.exports.image = mongoose.model('Image', imageSchema)
module.exports.chunk = mongoose.model('fs.chunk', chunkSchema)
module.exports.file = mongoose.model('fs.file', fileSchema)
