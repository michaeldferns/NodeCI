const mongoose = require('mongoose')
const redis = require('redis')
const util = require('util')
const keys = require('../config/keys')

const client = redis.createClient(keys.redisUrl)
client.hget = util.promisify(client.hget)

client.flushall()

const exec = mongoose.Query.prototype.exec

mongoose.Query.prototype.cache = async function(options = {}) {
  this.useCache = true
  this.hashKey = JSON.stringify(options.key || '')

  return this
}

mongoose.Query.prototype.exec = async function() {
  if (!this.useCache) {
    return exec.apply(this, arguments)
  }

  const key = JSON.stringify(Object.assign({}, this.getQuery(), {
    collection: this.mongooseCollection.name
  }))

  // Check for 'key' value in Redis
  const cacheValue = await client.hget(this.hashKey, key)

  // If so, return the value
  if (cacheValue) {
    console.log('cache')
    const doc = JSON.parse(cacheValue)

    return Array.isArray(doc) 
      ? doc.map((d) => new this.model(d))
      : new this.model(doc)
  }

  // Otherwise, return the result
  const result = await exec.apply(this, arguments)
  
  client.hset(this.hashKey, key, JSON.stringify(result), 'EX', 10)

  console.log('query')

  return result
};

const clearHash = function (hashKey) {
  client.del(JSON.stringify(hashKey))
}

module.exports = {
  clearHash
}