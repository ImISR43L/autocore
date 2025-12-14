import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Habilita CORS para qualquer origem (Desenvolvimento)
  app.enableCors();

  await app.listen(3000);
}
bootstrap();
