import 'reflect-metadata';
import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './common/error';
import { HTTP_PORT, VARIANT_NAME, loadConfig } from './config';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  const config = loadConfig();

  // Contract-т заасан алдааны хэлбэржүүлэлт:
  app.useGlobalFilters(new GlobalExceptionFilter());

  // ⚠️ Overposting — Alpha vs Beta ялгаа энд гардаг:
  //   Alpha: `whitelist: false` → мэдэгдээгүй талбар (role, is_admin, targets) accept болно.
  //   Beta:  `whitelist: true, forbidNonWhitelisted: true` → 400 буцаана.
  const isBeta = config.implementation === 'beta';
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: isBeta,
      forbidNonWhitelisted: isBeta,
    }),
  );

  await app.listen(HTTP_PORT);
  const logger = new Logger('bootstrap');
  logger.log(`${VARIANT_NAME} (${config.implementation}) — port ${HTTP_PORT}`);
}

void bootstrap();
