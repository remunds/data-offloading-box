# Nature 4.0
Conservation strategies require the observation and assessment of landscape. Expert surveys must make trade-offs here between level of detail, spatial coverage, and temporal repetition, which are only partially resolved even by resorting to airborne or satellite-based remote sensing approaches. This limits differentiated conservation planning and response options.

# Getting Started
## Requirements
1. (tested on) Raspberry Pi 4 B, at least 4GB RAM recommended
2. [Raspios 64 bit](https://downloads.raspberrypi.org/raspios_arm64/images/) (raspios_arm64-2020-08-24 and higher)
3. User named "pi"

## Installation
### Configure
`Download` repository via github

```
cd /home/pi/
git clone https://github.com/remunds/data-offloading-box.git
cd data-offloading-box
nano config_default.json
```
Then edit your specific details, such as Back-End IP, Back-End Port, db IP, db Port, dtnd IP and dtnd Port.
In a normal use case, you just have to adjust the Back-End IP to a static and globally available IP address, leading to your this Back-End server. (TODO)
Do not change "configuration" and "nodeName"


```
./setup.sh
sudo mv dtnd.service /lib/systemd/system/
sudo mv offloading.service /lib/systemd/system/ 
./start.sh
```
Now the box server should run in background and should start itself automatically after restart or crash.
#### For debugging purposes, you can run
```
sudo systemctl status offloading.service
sudo systemctl status dtnd.service
sudo systemctl status mongod.service
```

#### terminate the process
```
sudo systemctl stop offloading.service
sudo systemctl stop dtnd.service
```

#### start again
```
./start.sh
```
or
```
sudo systemctl start dtnd.service
sudo systemctl start mongod.service
sudo systemctl start offloading.service
```

## Modifying

### Add new Routes

Modify `app.js` as you wish. Be aware that all data that should be transfered to the Back-End has to be chunked via [gridFS](https://www.npmjs.com/package/mongoose-gridfs) first!

For example:

```js
app.get('/api/register', (req, res) => {
  res.send({ piId: boxName, timestamp: Date.now() })
})
```

`app.js`

For more detail visit the [node.js](https://nodejs.org/en/docs/) and [express.js](http://expressjs.com/en/5x/api.html) documentation

### Add Data to Database

We are using MongoDB as a NoSQL Database in combination with Mongoose to structure our data. You have to add your schema in `schema.js`

```js
const imageSchema = new mongoose.Schema({
  type: String,
  data: Buffer,
  takenBy: String,
  label: [],
  luxValue: Number
}) 

module.exports.image = mongoose.model('Image', imageSchema)
```

`/schema.js`

Please visit the [Mongoose Documentation](https://mongoosejs.com/) for more details.

Be aware that all data that should be transfered to the Back-End has to be chunked via [gridFS](https://www.npmjs.com/package/mongoose-gridfs) first!

### Add new Tasks

If you want to add new tasks, you just have to modify the `function generateTasks()` method in `/taskgenerator.js`. 
And for more complex Tasks with the need to provide data to the user, you can write your own task generator function that inserts the needed data into a new Collection of the database. Therefore you must add a new schema in the `schema.js`.  

To receive any data from the user, you need to edit your routes. Depending on whether you want other user to interact with that data, you choose to edit the Back-End or box routes. Be aware that all data that should be transfered to the Back-End has to be chunked via [gridFS](https://www.npmjs.com/package/mongoose-gridfs) first!

Additionally, you have to modify the app to handle to new Tasks right. For more information have a look to the [data-offloading-app GitHub page](https://github.com/dtn7/dtn7-go). 

#### Simple Task

For example you want to add a light measurement task to measure the light with the built-in light meter.

```js
function generateTasks () {
  console.log('generating tasks')

  // add new Task
  const TreePhotoTask = new Task({ title: 'Baumkronen Foto', description: 'Bitte nehme ein Foto der Baumkrone auf.' })
  const CleanTask = new Task({ title: 'Box säubern', description: 'Bitte entferne Äste und Schmutz von der Oberfläche der Sensorbox.' })
  const MeasureLight = new Task({ title: 'Helligkeit messen', description: 'Bitte messe die Helligkeit bei der Sensorbox mit deinem Lichtsensor am Handy'})

  // insert every day (24 hours)
  insertTaskPeriodic(TreePhotoTask, 24 * 60 * 1000)

  // insert every 3 days (3 * 24 hours)
  insertTaskPeriodic(CleanTask, 3 * 24 * 60 * 1000)

  // insert every houer
  insertTaskPeriodic(MeasureLight, 60 * 1000)
    
  [...]
} 
```

`/taskgenerator.js`

#### Complex Task

Here is a task to create a task to label the content of an image shot by other users.

```js
async function createLabelImageTasksHourly () {
  while (true) {
    // search for all images in DB
    Image.find({}, (err, images) => {
      if (err) console.log(err)
      else if (images != null) {
        // create new Task for every found image
        images.forEach(image => {
          const imageTask = new Task({ title: 'Fotofallen-Bild beschriften', description: 'Bitte waehle das passende Label aus.', imageId: image.id })
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

function generateTasks () {
  console.log('generating tasks')
  [...]
   
  // create a task for each image in images
  createLabelImageTasksHourly()
}
```

`/taskgenerator.js`

## dtnd
dtnd is a delay-tolerant networking daemon. It represents a node inside the network and is able to transmit, receive and forward bundles to other nodes. A node's neighbors may be specified in the configuration or detected within the local network through a peer discovery. Bundles might be sent and received through a REST-like web interface. The features and their configuration is described inside the provided example configuration.toml.

https://github.com/dtn7/dtn7-go

# License
This project's code is licensed under the GNU General Public License version 3 (GPL-3.0-or-later).
