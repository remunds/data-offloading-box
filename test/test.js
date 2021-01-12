
const supertest = require('supertest')
const should = require('should')

const server = supertest.agent('http://localhost:8000')

describe('getImage by ID test', function () {
  it('should return image', function (done) {
    // no ID should return error
    server
      .get('/api/getImage/?id=5ff444933dd44d0e8aa05509')
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
      .expect(200)
      .end(function (err, res) {
        should.not.exist(err)
        res.text.should.equal('no image with this ID in database')
        res.status.should.equal(200)
        done()
      })
  })
})

describe('/putLabel test', function () {
  it('should add label to array in database', function (done) {
    server
      .post('/api/putLabel')
      .send({ id: '5ff444933dd44d0e8aa05509', label: 2 })
      .expect(200)
      .end(function (err, res) {
        console.log(res.body)
        should(res.body.pop()).equal(2)
        done()
      })
  })
})
