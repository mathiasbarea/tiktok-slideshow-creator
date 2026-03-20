const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const {
  annotateErrorFlags,
  retryImageOperation,
} = require('../scripts/generate-images');

test('annotateErrorFlags treats high-demand image errors as transient', () => {
  const entry = annotateErrorFlags({
    error: 'This model is currently experiencing high demand. Please try again later.',
  });

  assert.equal(entry.rateLimitDetected, false);
  assert.equal(entry.transientFailureDetected, true);
  assert.equal(entry.timeoutDetected, false);
});

test('retryImageOperation retries transient provider overloads with backoff', async () => {
  const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tiktok-image-retry-'));
  const sleepCalls = [];
  let attempts = 0;

  const attemptCount = await retryImageOperation({
    runtime: {
      retry: {
        maxAttempts: 3,
        baseDelayMs: 10,
        maxDelayMs: 25,
      },
    },
    outputDir,
    logPrefix: 'slide 2',
    label: 'slide 2',
    sleepFn: async (ms) => {
      sleepCalls.push(ms);
    },
    operation: async () => {
      attempts += 1;
      if (attempts < 3) {
        throw new Error('This model is currently experiencing high demand. Please try again later.');
      }
    },
  });

  assert.equal(attemptCount, 3);
  assert.equal(attempts, 3);
  assert.deepEqual(sleepCalls, [10, 20]);

  const processLog = fs.readFileSync(path.join(outputDir, 'generation-process.log'), 'utf8');
  assert.match(processLog, /transient retry attempt=1/);
  assert.match(processLog, /transient retry attempt=2/);
});

test('retryImageOperation does not retry non-transient failures', async () => {
  const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tiktok-image-no-retry-'));
  const sleepCalls = [];
  let attempts = 0;

  await assert.rejects(
    () => retryImageOperation({
      runtime: {
        retry: {
          maxAttempts: 3,
          baseDelayMs: 10,
          maxDelayMs: 25,
        },
      },
      outputDir,
      logPrefix: 'slide 3',
      label: 'slide 3',
      sleepFn: async (ms) => {
        sleepCalls.push(ms);
      },
      operation: async () => {
        attempts += 1;
        throw new Error('Prompt is invalid');
      },
    }),
    (error) => {
      assert.equal(error.attemptCount, 1);
      assert.equal(error.transientFailureDetected, false);
      return true;
    },
  );

  assert.equal(attempts, 1);
  assert.deepEqual(sleepCalls, []);
});
