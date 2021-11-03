const mongoose = require('mongoose')
const { createReadStream, unlinkSync, unlink, readFileSync, writeFileSync } = require('fs')
const { createModel } = require('mongoose-gridfs')
const schemas = require('./schemas')
const Chunk = schemas.chunk
const File = schemas.file
const db = mongoose.connection
var i = 0

function sleep(milliseconds) {
    return new Promise(resolve => setTimeout(resolve, milliseconds));
}

async function deleteDataHourly(){
    console.log("DB Cleaner is running. Deleting Data hourly")
    while(true){
        console.log("DB CLEANER STILL RUNNING")
        var date = new Date()
        mins = date.getMinutes()
        millisecs = date.getMilliseconds()
        if(mins == 0 && millisecs == 0){
            console.log("It's " + date.getHours() + ":00 right now. Deleting all data on DB")
            await db.db.dropDatabase(console.log("Database Dropped"));
        }
        await sleep(60000)
    } 

}

async function saveSensorImage() {
    if(i == 0){
        console.log("Saving a Plot hourly")
        i++
    }
    //console.log("Saving a Plot hourly")
    var date = new Date()
    setTimeout(async function () {
        var mins = date.getMinutes()
        var hour = date.getHours() - 1
        var hourString = hour.toString()
        if(hour < 10){
            hourString = "0" + hourString
        }
        var currentDate = date.toISOString().slice(0, 10).toString()
        if (mins == 1) {
            console.log("uploading the plot")
            const fs = createModel({
                modelName: 'fs'
            })
            let filepath = "/home/pi/sensor_data/cpu_temperature_"+ currentDate +"_"+ hourString +"-54.png"
            const readStream = createReadStream(filepath)
            const options = ({ filename: "cpu_temperature_"+ currentDate +"_"+ hourString +"-54.png", contentType: 'image/png' })
            await fs.write(options, readStream, async (err, file) => {
                if (err) {
                    console.error("Temp Plot could not be chunked")
                }
                else {
                    File.findByIdAndUpdate(file._id, { downloads: 0, onPhones: [] }).exec()
                    Chunk.updateMany({ files_id: file._id }, { downloads: 0, timestamp: Date.now(), onPhones: [] }).exec()
                    console.log("Saved Plot in DB Successfully")
                }
            })
        }
        saveSensorImage()
    }, 60000)
}




module.exports = {deleteDataHourly, saveSensorImage}