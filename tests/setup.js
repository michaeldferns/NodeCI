const connectDB = require('../config/db')
require('../models/User')

jest.setTimeout(30000)

connectDB()