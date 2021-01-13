
const supertest = require('supertest')
const should = require('should')

require('../app')

const server = supertest.agent('http://localhost:8000')

let imageID;

async function setupMongoDB() {
  const schemas = require('../schemas')
  const Task = schemas.task
  const Image = schemas.image

  const buffer = Buffer.from('../dachs.jpg')
  const im = new Image({ type: 'image/jpeg', data: buffer, label: [] })
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
})

describe('/putLabel test', function () {
  it('should add label to array in database', function (done) {
    server
      .post('/api/putLabel')
      .send({ id: imageID, label: 2 })
      .expect(200)
      .end(function (err, res) {
        should(res.body.pop()).equal(2)
        done()
      })
  })
})
