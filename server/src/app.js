const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./docs/swagger');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');

const env = require('./config/env');
const errorMiddleware = require('./middlewares/error.middleware');
const routes = require('./routes');

const app = express();

app.use(
  cors({
    origin: env.clientUrl,
    credentials: true,
  })
);

app.use(helmet());
app.use(morgan(env.nodeEnv === 'production' ? 'combined' : 'dev'));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

app.use('/uploads', express.static(path.resolve(process.cwd(), env.uploadDir)));

app.get('/api/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Judo-Arena API is running',
  });
});

app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.use('/api', routes);

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found',
    code: 'ROUTE_NOT_FOUND',
  });
});

app.use(errorMiddleware);

module.exports = app;
