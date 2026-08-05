async function startServer({
  app,
  connectDatabase,
  initializeApsConfiguration,
  logger = console,
  port,
}) {
  await connectDatabase();
  await initializeApsConfiguration();

  return app.listen(port, () => {
    logger.info(`Server running on port ${port}`);
  });
}

module.exports = { startServer };
