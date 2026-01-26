import { utilities as nestWinstonModuleUtilities } from 'nest-winston';
import * as winston from 'winston';

export const winstonConfig = {
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.ms(),
        // Em produção, usamos JSON. Em dev, usamos o formato legível colorido.
        process.env.NODE_ENV === 'production'
          ? winston.format.json()
          : nestWinstonModuleUtilities.format.nestLike('Autocore', {
              prettyPrint: true,
              colors: true,
            }),
      ),
    }),
    // Opcional: Salvar erros em arquivo (útil se o container morrer e levar o log junto)
    // new winston.transports.File({ filename: 'error.log', level: 'error' }),
  ],
};
