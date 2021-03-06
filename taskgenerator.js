const schemas = require('./schemas')
const Task = schemas.task
const Image = schemas.image

/* sets process to sleep so that no more tasks will be generated for a while
*/
function sleep (milliseconds) {
  return new Promise(resolve => setTimeout(resolve, milliseconds))
}

/* inserts a task into database every timeinMs milliseconds
*/
async function insertTaskPeriodic (task, timeInMs) {
  while (true) {
    // find task in db
    Task.findOne({ title: task.title }, (err, doc) => {
      if (err) return console.error(err)
      if (doc == null) {
        // the task is not active, so create the task
        task.save()
      }
    })
    // activate task by creation only every timeInMs ms.
    await sleep(timeInMs)
  }
}

/* inserts an imageLabel task into database every hour
*/
async function createLabelImageTasksHourly () {
  while (true) {
    // search for all images in DB
    Image.find({}, (err, images) => {
      if (err) console.log(err)
      else if (images != null) {
        // create new Task for every found image
        images.forEach(image => {
          let imageTask
          // distinguish between tasks for labelling Box images and user images
          if (image.takenBy === 'user') {
            imageTask = new Task({ title: 'Nutzerbild beschriften', description: 'Bitte wähle das passende Label aus.', imageId: image.id })
          } else {
            imageTask = new Task({ title: 'Fotofallen-Bild beschriften', description: 'Bitte wähle das passende Label aus.', imageId: image.id })
          }

          // check if task already exists in DB
          Task.findOne({ imageId: imageTask.imageId }, (err, doc) => {
            if (err) return console.error(err)
            // if there is no task with the given imageId, save it.
            if (doc == null) {
              imageTask.save()
              console.log('saved imageTask with imageID: ' + image.id)
            }
          })
        })
      }
    })

    // check every hour for new images
    await sleep(60 * 1000)
  }
}

/* function for creating tasks and periodically inserting them into the database
*/
function generateTasks () {
  console.log('generating tasks')

  const TreePhotoTask = new Task({ title: 'Baumkronen Foto', description: 'Bitte nehme ein Foto der Baumkrone auf.' })
  const CleanTask = new Task({ title: 'Box säubern', description: 'Bitte entferne Äste und Schmutz von der Oberfläche der Sensorbox.' })

  // insert every day (24 hours)
  insertTaskPeriodic(TreePhotoTask, 24 * 60 * 1000)

  // insert every 3 days (3 * 24 hours)
  insertTaskPeriodic(CleanTask, 3 * 24 * 60 * 1000)

  // create a task for each image in images
  createLabelImageTasksHourly()
}

module.exports = generateTasks
