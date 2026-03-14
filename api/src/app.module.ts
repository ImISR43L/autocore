import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WinstonModule } from 'nest-winston';
import { winstonConfig } from './logger/winston.config';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ReportsModule } from './reports/reports.module';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { ClassroomsModule } from './classrooms/classrooms.module';
import { ProblemsModule } from './problems/problems.module';
import { SubmissionsModule } from './submissions/submissions.module';
import { AnnouncementsModule } from './announcements/announcements.module';
import { HealthModule } from './health/health.module';
import { CacheModule } from '@nestjs/cache-manager';
import * as redisStore from 'cache-manager-redis-store';
import { getSecret } from './common/utils/secrets.util';

@Module({
  imports: [
    WinstonModule.forRoot(winstonConfig),
    ConfigModule.forRoot({ isGlobal: true }),

    CacheModule.registerAsync({
      isGlobal: true,
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        store: redisStore,
        host: configService.get('REDIS_HOST'),
        port: parseInt(configService.get('REDIS_PORT') || '6379'),
        auth_pass: getSecret('REDIS_PASSWORD', 'redis_password'), // auth_pass é o padrão suportado por cache-manager-redis-store
        ttl: 3600,
      }),
      inject: [ConfigService],
    }),

    TypeOrmModule.forRootAsync({
      useFactory: () => ({
        type: 'postgres',
        host: process.env.DB_HOST,
        port: parseInt(process.env.DB_PORT || '6543'),
        username: process.env.DB_USERNAME,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_DATABASE || 'postgres',
        entities: [__dirname + '/**/*.entity{.ts,.js}'],
        synchronize: true,
        ssl: {
          rejectUnauthorized: false,
        },
        extra: {
          max: 20,
          connectionTimeoutMillis: 5000,
        },
      }),
    }),

    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 100,
      },
    ]),

    UsersModule,
    AuthModule,
    ClassroomsModule,
    ProblemsModule,
    SubmissionsModule,
    ReportsModule,
    AnnouncementsModule,
    HealthModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
