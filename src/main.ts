import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.use(helmet());
  app.enableCors({
    origin: process.env.CORS_ORIGIN?.split(',') ?? '*',
    credentials: true,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const config = new DocumentBuilder()
    .setTitle('Rider Companion API')
    .setDescription('Backend APIs for auth, ride rooms, and rider tracking')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document);

  const port = process.env.PORT ?? 3000;
  await app.listen(port, '0.0.0.0');

  // ── Keep-alive self-ping (prevents Render free-tier from sleeping) ──
  const renderUrl = process.env.RENDER_EXTERNAL_URL;
  if (renderUrl) {
    const KEEP_ALIVE_INTERVAL_MS = 14 * 60 * 1000; // 14 minutes
    setInterval(async () => {
      try {
        await fetch(`${renderUrl}/health`);
      } catch {
        // Silently ignore — the server will wake on the next external request anyway
      }
    }, KEEP_ALIVE_INTERVAL_MS);
    console.log(`Keep-alive ping enabled → ${renderUrl}/health every 14 min`);
  }
}
void bootstrap();

