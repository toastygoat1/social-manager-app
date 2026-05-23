import 'dotenv/config';
import { Job, UnrecoverableError, Worker } from 'bullmq';
import { Redis } from 'ioredis';

const PUBLISH_QUEUE_NAME = 'content-publishing';
const PUBLISH_SCHEDULED_JOB_NAME = 'publish-scheduled-post';

type ScheduledPublishJob = {
  contentPostId: string;
};

type ApiFailure = {
  message?: string | string[];
  error?: string;
};

const redisUrl = requiredEnv('REDIS_URL');
const apiBaseUrl = requiredEnv('API_BASE_URL').replace(/\/$/, '');
const workerSecret = requiredEnv('WORKER_PUBLISH_SECRET');
const concurrency = positiveInteger(process.env.PUBLISH_WORKER_CONCURRENCY, 1);
const requestTimeoutMs = positiveInteger(
  process.env.PUBLISH_REQUEST_TIMEOUT_MS,
  180_000,
);

const connection = new Redis(redisUrl, {
  maxRetriesPerRequest: null,
});

connection.on('error', (error) => {
  console.error(`Redis connection error: ${error.message}`);
});

const worker = new Worker<ScheduledPublishJob>(
  PUBLISH_QUEUE_NAME,
  processScheduledPublish,
  {
    connection,
    concurrency,
  },
);

worker.on('ready', () => {
  console.info(
    `Publishing worker ready on "${PUBLISH_QUEUE_NAME}" with concurrency ${concurrency}`,
  );
});

worker.on('completed', (job) => {
  console.info(`Published scheduled post for job ${job.id ?? 'unknown'}`);
});

worker.on('failed', (job, error) => {
  console.error(
    `Scheduled publish job ${job?.id ?? 'unknown'} failed: ${error.message}`,
  );
});

worker.on('error', (error) => {
  console.error(`Publishing worker error: ${error.message}`);
});

process.on('SIGTERM', () => {
  void shutdown('SIGTERM');
});
process.on('SIGINT', () => {
  void shutdown('SIGINT');
});

async function processScheduledPublish(job: Job<ScheduledPublishJob>) {
  if (
    job.name !== PUBLISH_SCHEDULED_JOB_NAME ||
    !job.data.contentPostId?.trim()
  ) {
    throw new UnrecoverableError(`Unsupported publishing job: ${job.name}`);
  }

  const abortController = new AbortController();
  const timeout = setTimeout(() => abortController.abort(), requestTimeoutMs);

  try {
    const response = await fetch(
      `${apiBaseUrl}/internal/publishing/scheduled/${encodeURIComponent(job.data.contentPostId)}`,
      {
        method: 'POST',
        headers: {
          'x-worker-publish-secret': workerSecret,
          'x-job-reference': job.id ?? '',
        },
        signal: abortController.signal,
      },
    );
    const body = (await response.json().catch(() => ({}))) as ApiFailure;

    if (!response.ok) {
      const message = readApiFailure(body, response.status);
      if (
        response.status >= 400 &&
        response.status < 500 &&
        response.status !== 408 &&
        response.status !== 404 &&
        response.status !== 429
      ) {
        throw new UnrecoverableError(message);
      }
      throw new Error(message);
    }

    return body;
  } catch (error) {
    if (error instanceof UnrecoverableError) throw error;
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Scheduled publish request timed out');
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

let shuttingDown = false;

async function shutdown(signal: string) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.info(`Received ${signal}; closing publishing worker`);
  await worker.close();
  await connection.quit();
}

function requiredEnv(key: string) {
  const value = process.env[key]?.trim();
  if (!value) throw new Error(`${key} is required for the publishing worker`);
  return value;
}

function positiveInteger(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function readApiFailure(body: ApiFailure, status: number) {
  if (Array.isArray(body.message)) return body.message.join(', ');
  return body.message ?? body.error ?? `Publish API returned status ${status}`;
}
