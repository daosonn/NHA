import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

/**
 * Browsers only. The Expo app is native and sends no `Origin`, so CORS is
 * irrelevant to the product — it exists purely so the web dev tier
 * (`pnpm dev:mobile:web`, `docs/04-devops/mobile-development.md`) can reach
 * the API from `localhost:8081`.
 *
 * Set `CORS_ORIGINS` to a comma-separated allowlist to override. Anything
 * outside development defaults to **no allowlist at all**: a deployed API
 * that nothing in a browser is meant to call should not hand out
 * `Access-Control-Allow-Origin` on the strength of a default.
 */
const DEV_ORIGINS = ['http://localhost:8081', 'http://localhost:19006'];

function corsOrigins(): string[] {
  const configured = process.env.CORS_ORIGINS?.trim();
  if (configured !== undefined && configured !== '') {
    return configured.split(',').map((origin) => origin.trim());
  }

  return process.env.NODE_ENV === 'production' ? [] : DEV_ORIGINS;
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const origins = corsOrigins();
  if (origins.length > 0) {
    app.enableCors({
      origin: origins,
      // PUT is here for `PUT /posts/:postId/reactions/me`, the one upsert in
      // the API. Leaving it out failed the preflight rather than the request,
      // so reacting to a post died in the browser with no server log at all.
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
      // Bearer tokens travel in a header, never a cookie, so the browser
      // has no credentials to send and enabling them would only widen what
      // a malicious page could attempt.
      allowedHeaders: ['Authorization', 'Content-Type'],
      credentials: false,
    });
  }

  // API conventions (docs/02-backend/architecture.md)
  app.setGlobalPrefix('api');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  const swaggerConfig = new DocumentBuilder()
    .setTitle('NHA API')
    .setDescription('REST API for the NHA family memories app')
    .setVersion('0.1')
    .addBearerAuth()
    .build();
  SwaggerModule.setup(
    'api/docs',
    app,
    SwaggerModule.createDocument(app, swaggerConfig),
  );

  await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();
