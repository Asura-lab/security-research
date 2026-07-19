import 'reflect-metadata';
import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './common/error';
import { HTTP_PORT, VARIANT_NAME, loadConfig } from './config';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  const config = loadConfig();

  app.useGlobalFilters(new GlobalExceptionFilter());

  const isBeta = config.implementation === 'beta';
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: isBeta,
      forbidNonWhitelisted: isBeta,
    }),
  );

  await app.listen(HTTP_PORT);
  new Logger('bootstrap').log(`${VARIANT_NAME} (${config.implementation}) — port ${HTTP_PORT}`);
}

void bootstrap();
