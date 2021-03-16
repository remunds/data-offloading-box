# Nature 4.0

Conservation strategies require the observation and assessment of landscape. Expert surveys must make trade-offs here between level of detail, spatial coverage, and temporal repetition, which are only partially resolved even by resorting to airborne or satellite-based remote sensing approaches. This limits differentiated conservation planning and response options.

# Getting Started

## Requirements

1. (tested on) Raspberry Pi 4 B, at least 4GB RAM recommended
2. [Raspios 64 bit](https://downloads.raspberrypi.org/raspios_arm64/images/) (raspios_arm64-2020-08-24 and higher), [headless mode](https://www.raspberrypi.org/documentation/configuration/wireless/headless.md) recommended
3. User named "pi"
4. running and configured [backend server](https://github.com/remunds/data-offloading-backend)

## Installation

### Configure

1. Download repository via GitHub.

```bash
cd /home/pi/
git clone https://github.com/remunds/data-offloading-box.git
cd data-offloading-box
nano config_default.json
```

2. Then edit your specific details, such as 

   1. backend IP, 
   2. backend port, 
   3. db IP, 
   4. db port, 
   5. dtnd IP and 
   6. dtnd port.

In a normal use case, you only have to adjust the backend IP to a static and globally available IP address, leading to your backend server.
**Do not change "configuration" and "nodeName". **

**Make sure that the backend server is already set up, online and reachable from your network, before executing the following steps. Otherwise, your Sensorbox will not be able to receive its unique ID and the correct configuration, resulting in a non-functional installation.**


```bash
./setup.sh
sudo mv dtnd.service /lib/systemd/system/
sudo mv offloading.service /lib/systemd/system/ 
sudo ./start.sh
```

3. Now the box server should run in background and should start itself automatically after a restart or a crash.

The Pi will be not longer reachable over WiFi after restart, because [RaspAP](https://github.com/RaspAP/raspap-webgui) is creating a WiFi hotspot. To maintain the Pi you can still connect over WiFi to SSH. 

#### For debugging purposes, you can run

```bash
sudo systemctl status offloading.service
sudo systemctl status dtnd.service
sudo systemctl status mongod.service
```

#### and terminate the process via

```bash
sudo systemctl stop offloading.service
sudo systemctl stop dtnd.service
```

#### or start again via

```bash
sudo ./start.sh
```

or

```bash
sudo systemctl start dtnd.service
sudo systemctl start mongod.service
sudo systemctl start offloading.service
```

## Modifying

### Add new Routes

Modify `app.js` as you wish. Be aware that all data that should be transferred to the backend has to be chunked via [gridFS](https://www.npmjs.com/package/mongoose-gridfs) first!

For example:

```js
app.get('/api/register', (req, res) => {
  res.send({ piId: boxName, timestamp: Date.now() })
})
```

`app.js`

For more detail visit the [node.js](https://nodejs.org/en/docs/) and [express.js](http://expressjs.com/en/5x/api.html) documentation.

### Add Data to Database

We are using MongoDB as a NoSQL Database in combination with Mongoose to structure our data. You have to add your schema in `schema.js`.

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

Be aware that all data that should be transferred to the backend has to be chunked via [gridFS](https://www.npmjs.com/package/mongoose-gridfs) first!

### Add new Tasks

If you want to add new tasks, you have to modify the `function generateTasks()` method in `/taskgenerator.js`. 
For more complex Tasks with more than just text fields (for example image data for image tasks), you can write your own task generator function that inserts the needed data into a new Collection of the database. Therefore you must add a new schema in the `schema.js`. The structure of the Task schema should then also be extended with a field pointing to the correct database entry (for example a field for imageId).

To receive any data from the user, you need to edit your routes. Depending on whether you want other users to interact with that data, you choose to edit the backend or box routes. Be aware that all data that should be transferred to the backend has to be chunked via [gridFS](https://www.npmjs.com/package/mongoose-gridfs) first!

Additionally, you have to modify the app to handle new Tasks in the desired way. For more information have a look at the [data-offloading-app GitHub page](https://github.com/remunds/data-offloading-app). 

#### Simple Task

For example if you want to add a light measurement task to measure the light with the built-in light meter:

```js
function generateTasks () {
  console.log('generating tasks')

  // add new Task
  const TreePhotoTask = new Task({ title: 'Baumkronen Foto', description: 'Bitte nehme ein Foto der Baumkrone auf.' })
  const CleanTask = new Task({ title: 'Box säubern', description: 'Bitte entferne Äste und Schmutz von der Oberfläche der Sensorbox.' })
  const MeasureLightTask = new Task({ title: 'Helligkeit messen', description: 'Bitte messe die Helligkeit bei der Sensorbox mit dem Lichtsensor am Handy.'})

  // insert every day (24 hours)
  insertTaskPeriodic(TreePhotoTask, 24 * 60 * 1000)

  // insert every 3 days (3 * 24 hours)
  insertTaskPeriodic(CleanTask, 3 * 24 * 60 * 1000)

  // insert every hour
  insertTaskPeriodic(MeasureLightTask, 60 * 1000)
    
  [...]
} 
```

`/taskgenerator.js`

#### Complex Task

Here is a function to create a task for each image in the database.

```js
async function createLabelImageTasksHourly () {
  while (true) {
    // search for all images in DB
    Image.find({}, (err, images) => {
      if (err) console.log(err)
      else if (images != null) {
        // create new Task for every found image
        images.forEach(image => {
          const imageTask = new Task({ title: 'Bild beschriften', description: 'Bitte wähle das passende Label aus.', imageId: image.id })
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

## dtn7-go

dtnd is a delay-tolerant networking daemon. It represents a node inside the network and is able to transmit, receive and forward bundles to other nodes. A node's neighbors may be specified in the configuration or detected within the local network through a peer discovery. Bundles might be sent and received through a REST-like web interface. The features and their configuration is described inside the provided example configuration.toml.

https://github.com/dtn7/dtn7-go

# License

This project's code is licensed under the GNU General Public License version 3 (GPL-3.0-or-later).