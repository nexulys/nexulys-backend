const fs = require('fs');
const path = require('path');
const logsDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true });

const winston = require('winston');

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.printf(({ timestamp, level, message, ...meta }) => {
          return `${timestamp} [${level}]: ${message}${Object.keys(meta).length ? ' ' + JSON.stringify(meta) : ''}`;
        })
      )
    }),
    // Rotation par taille : les journaux contiennent des adresses IP et des chemins
    // d'API, donc des données personnelles. Sans borne, ils croissaient indéfiniment —
    // contraire au principe de limitation de la conservation (RGPD art. 5.1.e), et de
    // quoi saturer le disque du serveur.
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error',
      maxsize: Number(process.env.LOG_MAX_SIZE || 10 * 1024 * 1024),
      maxFiles: Number(process.env.LOG_MAX_FILES || 5),
      tailable: true
    }),
    new winston.transports.File({
      filename: 'logs/combined.log',
      maxsize: Number(process.env.LOG_MAX_SIZE || 10 * 1024 * 1024),
      maxFiles: Number(process.env.LOG_MAX_FILES || 5),
      tailable: true
    })
  ]
});

module.exports = logger;
