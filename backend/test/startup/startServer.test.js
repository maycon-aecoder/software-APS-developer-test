const assert = require('node:assert/strict');
const test = require('node:test');

const { startServer } = require('../../src/startServer');

function createStartupDouble() {
  const calls = [];
  const server = { close() {} };

  return {
    calls,
    dependencies: {
      app: {
        listen(port) {
          calls.push(['listen', port]);
          return server;
        },
      },
      async connectDatabase() {
        calls.push(['connectDatabase']);
      },
      async initializeApsConfiguration() {
        calls.push(['initializeApsConfiguration']);
      },
      logger: { info() {} },
      port: 5000,
    },
    server,
  };
}

test('awaits MongoDB and the unique APS configuration index before listening', async () => {
  const { calls, dependencies, server } = createStartupDouble();

  const result = await startServer(dependencies);

  assert.equal(result, server);
  assert.deepEqual(calls, [
    ['connectDatabase'],
    ['initializeApsConfiguration'],
    ['listen', 5000],
  ]);
});

test('fails closed without listening when the APS configuration index cannot initialize', async () => {
  const { calls, dependencies } = createStartupDouble();
  dependencies.initializeApsConfiguration = async () => {
    calls.push(['initializeApsConfiguration']);
    throw new Error('synthetic index failure');
  };

  await assert.rejects(startServer(dependencies), /synthetic index failure/);
  assert.deepEqual(calls, [
    ['connectDatabase'],
    ['initializeApsConfiguration'],
  ]);
});

test('preserves the existing fail-closed database startup behavior', async () => {
  const { calls, dependencies } = createStartupDouble();
  dependencies.connectDatabase = async () => {
    calls.push(['connectDatabase']);
    throw new Error('synthetic connection failure');
  };

  await assert.rejects(startServer(dependencies), /synthetic connection failure/);
  assert.deepEqual(calls, [['connectDatabase']]);
});
