require('dotenv').config();
const app = require('./src/app');
const connectDB = require('./src/config/db');
const { ApsConfiguration } = require('./src/models/ApsConfiguration');
const { startServer } = require('./src/startServer');

const PORT = process.env.PORT || 5000;

startServer({
  app,
  connectDatabase: connectDB,
  initializeApsConfiguration: () => ApsConfiguration.init(),
  port: PORT,
}).catch((error) => {
  console.error(`Server startup error: ${error.message}`);
  process.exit(1);
});
