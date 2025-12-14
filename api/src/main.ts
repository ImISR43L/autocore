import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common'; // [Novo]
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableCors();

  // [Novo] Ativa validação automática baseada nos DTOs
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // Remove propriedades não listadas no DTO
      forbidNonWhitelisted: true, // Retorna erro se enviar propriedades extras
    }),
  );

  await app.listen(3000);
}
bootstrap();
