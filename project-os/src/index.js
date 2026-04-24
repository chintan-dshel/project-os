import app from './app.js';

const PORT = process.env.PORT ?? 3000;
app.listen(PORT, () => {
  console.log(`[server] AI Project OS API running on port ${PORT}`);
  console.log(`[server] NODE_ENV=${process.env.NODE_ENV ?? 'development'}`);
});
