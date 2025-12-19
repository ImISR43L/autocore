import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // 1. Segurança: Ativar CORS para o Frontend acessar
  app.enableCors();

  // 2. Segurança: Ativar Validação Global (ValidationPipe)
  // Isso faz com que os DTOs (@IsString, @IsEmail) funcionem de verdade.
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // Remove campos extras que não estão no DTO
      forbidNonWhitelisted: true, // Retorna erro se enviar campos desconhecidos
      transform: true, // Converte tipos automaticamente (ex: "1" -> 1)
    }),
  );

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
