
const supertest = require('supertest')
const should = require('should')

require('../app')

const server = supertest.agent('http://localhost:8000')

const schemas = require('../schemas')
const Task = schemas.task
const Image = schemas.image
const buffer = Buffer.from('./dachs.jpg')

let imageID;

async function setupMongoDB() {
  const im = new Image({ type: 'image/jpeg', data: buffer, label: [], takenBy: "box" })
  imageID = (await im.save()).id;
  console.log("id: " + imageID)
}

before(async function () {
  await setupMongoDB();
});

describe('getImage by ID test', function () {
  it('should return image', function (done) {
    server
      .get('/api/getImage/?id=' + imageID)
      .expect(200)
      .end(function (err, res) {
        res.status.should.equal(200)

        should.not.exist(err)
        res.body.should.have.property('label')
        res.body.should.have.property('type', 'image/jpeg')
        res.body.should.have.property('data')
        done()
      })
  })

  it('non existing ID should return json with error message', function (done) {
    server
      .get('/api/getImage/?id=000000000000000000000000')
      .expect(400)
      .end(function (err, res) {
        should.not.exist(err)
        res.text.should.equal('{"error":"could not find image in database"}')
        res.status.should.equal(400)
        done()
      })
  })

  it('wrong ID should return json with error message', function (done) {
    server
      .get('/api/getImage/?id=000000')
      .expect(400)
      .end(function (err, res) {
        should.not.exist(err)
        res.text.should.equal('{"error":"database error"}')
        res.status.should.equal(400)
        done()
      })
  })
})

describe('/putLabel test', function () {
  it('should add label to array in database', function (done) {
    server
      .post('/api/putLabel')
      .send({ id: imageID, label: "2" })
      .expect(200)
      .end(function (err, res) {
        // response body contains all image labels
        should(res.body.pop()).equal("2")
        done()
      })
  })

  it('should add two labels to array in database', function (done) {
    server
      .post('/api/putLabel')
      .send({ id: imageID, label: "2,   label with whitespace   " })
      .expect(200)
      .end(function (err, res) {
        // response body contains all image labels
        should(res.body.pop()).equal("label with whitespace")
        should(res.body.pop()).equal("2")
        done()
      })
  })

  it('no id should throw error', function (done) {
    server
      .post('/api/putLabel')
      .send({ id: "", label: "2" })
      .expect(400)
      .end(function (err, res) {
        should.not.exist(err)
        res.text.should.equal('{"error":"empty input parameter"}')
        res.status.should.equal(400)
        done()
      })
  })

  it('no label should throw error', function (done) {
    server
      .post('/api/putLabel')
      .send({ id: imageID, label: null })
      .expect(400)
      .end(function (err, res) {
        should.not.exist(err)
        res.text.should.equal('{"error":"empty input parameter"}')
        res.status.should.equal(400)
        done()
      })
  })

  it('wrong id should throw error', function (done) {
    server
      .post('/api/putLabel')
      .send({ id: "0005", label: "2" })
      .expect(400)
      .end(function (err, res) {
        should.not.exist(err)
        res.text.should.equal('{"error":"database error"}')
        res.status.should.equal(400)
        done()
      })
  })

  it('non existing id should throw error', function (done) {
    server
      .post('/api/putLabel')
      .send({ id: "000000000000000000000000", label: "2" })
      .expect(400)
      .end(function (err, res) {
        should.not.exist(err)
        res.text.should.equal('{"error":"could not find image in database"}')
        res.status.should.equal(400)
        done()
      })
  })
})

describe('/api/saveUserImage test', function () {
  it('should save one image to database', function (done) {
    var n = 0
    Image.countDocuments({}, function(err, c) { n = c })

    server
      .post('/api/saveUserImage')
      .field('label', 'dachs, fuchs')
      .field('takenBy', 'user')
      .attach('data', './dachs.jpg')
      .expect(200)
      .end(async function (err, res) {
        should.not.exist(err)
        await Image.countDocuments({}, function(err, c) {
          // one more image in database than before api call
          c.should.equal(n+1)
        });
        done()
      })
  })
  it('no label should throw error', function (done) {
    var n = 0
    Image.countDocuments({}, function(err, c) { n = c })

    server
      .post('/api/saveUserImage')
      .field('takenBy', 'user')
      .attach('data', './dachs.jpg')
      .expect(400)
      .end(async function (err, res) {
        should.not.exist(err)
        res.text.should.equal('{"error":"missing input parameter"}')
        await Image.countDocuments({}, function(err, c) {
          // no more images in database than before api call
          c.should.equal(n)
        });
        done()
      })
  })
  it('no takenBy field should throw error', function (done) {
    var n = 0
    Image.countDocuments({}, function(err, c) { n = c })

    server
      .post('/api/saveUserImage')
      .field('label', 'dachs')
      .attach('data', './dachs.jpg')
      .expect(400)
      .end(async function (err, res) {
        should.not.exist(err)
        res.text.should.equal('{"error":"missing input parameter"}')
        await Image.countDocuments({}, function(err, c) {
          // no more images in database than before api call
          c.should.equal(n)
        });
        done()
      })
  })
  it('no attached file should throw error', function (done) {
    var n = 0
    Image.countDocuments({}, function(err, c) { n = c })

    server
      .post('/api/saveUserImage')
      .field('label', 'dachs')
      .field('takenBy', 'user')
      .expect(400)
      .end(async function (err, res) {
        should.not.exist(err)
        res.text.should.equal('{"error":"missing file"}')
        await Image.countDocuments({}, function(err, c) {
          // one more image in database than before api call
          c.should.equal(n)
        });
        done()
      })
  })
})

describe('writeData', () => {
  it('write Data', (done) => {
    server
      .post('/api/writeData')
      .attach('sensor', 'test/Mobile_Data_Offloading_QS.pdf')
      .end((err, res) => {
        should.not.exist(err)
        res.status.should.equal(200)
        done()
      })
  })
})

describe('/getTasks test', function () {
  it('get all tasks on sensorbox', function (done) {
    server
      .get('/api/getTasks')
      .end(function (err, res) {
        res.status.should.equal(200)
        done()
      })
  })
})

describe('/deleteTasks test', function () {
  it('delete specific task', function (done) {
    server
      .post('/api/DeleteTask')
      .end(function (err, res) {
        res.status.should.equal(200)
        done()
      })
  })

  it('should return a error when a task is given which is not in db', function (done) {
    server
      .post('/api/DeleteTask')
      .send({_id: 0, title: "TestTask", descpription: "TestDescription", imageId: null})
      .end(function (err, res) {
        res.status.should.equal(400)
        done()
      })
  })
})
