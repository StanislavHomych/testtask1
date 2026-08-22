import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger:
      process.env.NODE_ENV === 'production'
        ? ['error', 'warn', 'log']
        : ['error', 'warn', 'log', 'debug', 'verbose'],
  });
  const config = app.get(ConfigService);
  const isProduction = config.get<string>('NODE_ENV') === 'production';
  const enableSwagger =
    config.get<string>('ENABLE_SWAGGER') === 'true' || !isProduction;

  app.use(
    helmet({
      contentSecurityPolicy: isProduction,
      crossOriginEmbedderPolicy: false,
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );
  app.setGlobalPrefix('api');
  app.enableCors({
    origin: config.getOrThrow<string>('FRONTEND_URL'),
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Authorization', 'Content-Type'],
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.enableShutdownHooks();

  if (enableSwagger) {
    const openApi = new DocumentBuilder()
      .setTitle('Vault API')
      .setDescription(
        'Virtual Data Room API — data rooms, folders, PDF files, and sharing. Authenticated routes expect a Clerk Bearer JWT.',
      )
      .setVersion('1.0.0')
      .addBearerAuth(
        {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Clerk session JWT',
        },
        'clerk',
      )
      .addTag('system', 'Health and service metadata')
      .addTag('users', 'Local user sync')
      .addTag('data-rooms', 'Owned and shared data rooms')
      .addTag('folders', 'Folder hierarchy and contents')
      .addTag('files', 'PDF upload, view, and metadata')
      .addTag('shares', 'Authenticated share management')
      .addTag('shared', 'Public token access')
      .build();

    const document = SwaggerModule.createDocument(app, openApi);
    SwaggerModule.setup('api/docs', app, document, {
      jsonDocumentUrl: 'api/docs-json',
      customSiteTitle: 'Vault API Docs',
    });
  }

  await app.listen(config.get<number>('PORT', 3000));
}
void bootstrap();
