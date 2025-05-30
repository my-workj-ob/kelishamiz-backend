import { NestFactory } from '@nestjs/core';

import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

import cors from 'cors';

import 'dotenv/config';

import express from 'express';

import { join } from 'path';

import { AppModule } from './app.module';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.use('/uploads', express.static(join(__dirname, '..', 'uploads')));
  app.enableCors({
    origin: [
      'http://localhost:5173',
      'https://kelishamiz.uz',
      'https://kelishamiz-backend.vercel.app',
      'https://it-experts-nine.vercel.app',
      'http://localhost:5174',
      'https://kelishamiz-admin-panels.vercel.app',
      'https://kelishamiz-backend.onrender.com',
      'http://185.191.141.159',
      'https://api.kelishamiz.uz',
    ],
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });

  // app.useGlobalPipes(new ValidationPipe());
  app.useGlobalInterceptors(new ResponseInterceptor());

  const config = new DocumentBuilder()
    .setTitle('Auth API')
    .setDescription('NestJS Authentication API')
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);

  SwaggerModule.setup('api/docs', app, document);

  app.use(
    '/api/docs',
    express.static(join(__dirname, '../node_modules/swagger-ui-dist')),
  );

  await app.listen(process.env.PORT || 3333);
}

bootstrap();
