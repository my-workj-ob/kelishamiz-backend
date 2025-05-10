import createServer from '@vendia/serverless-express';
import { Handler } from 'aws-lambda';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ExpressAdapter } from '@nestjs/platform-express';
import express from 'express';
import { join } from 'path';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';

let cachedServer;

async function bootstrap(): Promise<any> {
  const expressApp = express();

  expressApp.use('/uploads', express.static(join(__dirname, '..', 'uploads')));

  const app = await NestFactory.create(
    AppModule,
    new ExpressAdapter(expressApp),
  );

  app.enableCors({
    origin: [
      'http://localhost:5173',
      'https://kelishamiz.uz',
      'https://kelishamiz-backend.vercel.app',
      'https://it-experts-nine.vercel.app',
    ],
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });

  app.useGlobalInterceptors(new ResponseInterceptor());

  const config = new DocumentBuilder()
    .setTitle('Auth API')
    .setDescription('NestJS Authentication API')
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  await app.init();
  return createServer({ app: expressApp }); // Bu server obyektini qaytaradi (proxy funktsiyasi ham shu obyektda)
}

export const handler: Handler = async (event, context) => {
  if (!cachedServer) {
    cachedServer = await bootstrap();
  }

  return cachedServer(event, context); // Faqat shunchaki serverni chaqirasiz — proxy bu yerda
};
