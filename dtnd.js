const axios = require('axios')
const schemas = require('./schemas')
const Chunk = schemas.chunk
const File = schemas.file

const config = require('./config.json')
let dtndUuid = false

// sleep function
function sleep (milliseconds) {
  return new Promise(resolve => setTimeout(resolve, milliseconds))
}

// registers at dtnd rest server and gets the uuid
async function registerDtnd () {
  axios({
    method: 'post',
    url: `http://${config.dtndIp}:${config.dtndPort}/rest/register`,
    data: {
      endpoint_id: `dtn://${config.nodeName}/box`
    }
  }).then((response) => {
    console.log(response.data)
    if (!response.data.err) {
      dtndUuid = response.data.uuid
      console.log('connected to dtnd')
    } else {
      console.log('cannot connect to dtnd')
    }
  }).catch(() => {
    console.log('cannot connect to dtnd')
  })
}

// fetches new bundles from dtnd server
function fetch () {
  return axios({
    method: 'post',
    url: `http://${config.dtndIp}:${config.dtndPort}/rest/fetch`,
    data: {
      uuid: dtndUuid
    }
  }).then((response) => {
    if (response.data.bundles.length !== 0) {
      const collection = {
        messages: []
      }
      for (let i = 0; i < response.data.bundles.length; i++) {
        collection.messages.push(
          JSON.parse(
            new Buffer
              .From(
                response.data.bundles[i].canonicalBlocks[1].data, 'base64'
              ).toString('binary')
          )
        )
      }
      return collection
    } else {
      console.log('message empty')
    }
  })
    .catch((error) => {
      console.log('something bad happend', error)
    })
}

// deletes chunks and files that are transmitted to backend
async function executeDeletion () {
  while (true) {
    if (dtndUuid) {
      const collection = await fetch()
      if (collection) {
        for (const message of collection.messages) {
          if (message.instruction === 'delete') {
            if (message.type === 'chunk') {
              Chunk.deleteOne({ _id: message.objectId }).then(
                console.log('Chunk deleted')
              )
            } else if (message.type === 'file') {
              File.deleteOne({ _id: message.objectId }).then(
                console.log('File deleted')
              )
            } else {
              console.log('wrong type format')
            }
          }
        }
      }
    }
    await sleep(60000)
  }
}

// init function
function listenForDeletionInstructions () {
  console.log('listen for deletion instructions')

  registerDtnd()
  executeDeletion()
}

module.exports = listenForDeletionInstructions
