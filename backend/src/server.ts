import 'dotenv/config';
import { createServer } from 'http';
import { createApp } from './app';
import { attachSockets } from './sockets';
import { startBotSimulation } from './services/botService';

const PORT = process.env.PORT ?? 3000;

const app = createApp();
const httpServer = createServer(app);
attachSockets(httpServer);

httpServer.listen(PORT, () => {
  console.log(`MotoRadar API listening on :${PORT}`);
  startBotSimulation();
});
