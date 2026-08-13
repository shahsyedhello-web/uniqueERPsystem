import { defineConfig } from '@prisma/config';
import dotenv from 'dotenv';

dotenv.config();

const dbUrl =
  process.env.DATABASE_URL ||
  `postgresql://postgres:${process.env.POSTGRES_PASSWORD || ''}@localhost:5432/unique_pos?schema=public`;

export default defineConfig({
  schema: './prisma/schema.prisma',
  datasource: {
    url: dbUrl,
  },
});
