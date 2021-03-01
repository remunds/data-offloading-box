const mongoose = require('mongoose')

// create schema with all needed fields
const taskSchema = new mongoose.Schema({
  // careful: title and imageId(if != null) need to be unique
  title: String,
  description: String,
  imageId: String
})

const imageSchema = new mongoose.Schema({
  type: String,
  data: Buffer,
  takenBy: String,
  label: [],
  luxValue: Number
})

const chunkSchema = new mongoose.Schema({
  timestamp: Number,
  downloads: Number,
  files_id: mongoose.ObjectId,
  n: Number,
  data: [Buffer]
})

const fileSchema = new mongoose.Schema({
  downloads: Number,
  length: Number,
  chunkSize: Number,
  uploadDate: Number,
  md5: String,
  filename: String,
  contentType: String,
  aliases: [String]
})

/* add methods like this:
*/

// taskSchema.methods.speak = function () {
//   const greeting = this.title
//     ? "Meow name is " + this.title
//     : "I don't have a name";
//   console.log(greeting);
// }

// export the mongoose model with the name Task (creates collection tasks)
module.exports.task = mongoose.model('Task', taskSchema)
module.exports.image = mongoose.model('Image', imageSchema)
module.exports.chunk = mongoose.model('fs.chunk', chunkSchema)
module.exports.file = mongoose.model('fs.file', fileSchema)
