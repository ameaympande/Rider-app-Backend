type AppEnv = {
  MONGO_URI?: string;
  JWT_SECRET?: string;
  PORT?: string;
  CORS_ORIGIN?: string;
  NODE_ENV?: string;
};

export function validateEnv(config: AppEnv) {
  const mongoUri = config.MONGO_URI;

  if (
    !mongoUri ||
    (!mongoUri.startsWith('mongodb://') &&
      !mongoUri.startsWith('mongodb+srv://'))
  ) {
    throw new Error(
      'MONGO_URI must start with mongodb:// or mongodb+srv://',
    );
  }

  if (!config.JWT_SECRET) {
    throw new Error('JWT_SECRET is required');
  }

  return config;
}
