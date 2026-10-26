import express from 'express';
import cookieParser from 'cookie-parser';

const app = express();
app.use(express.json({ limit: '2mb' }));
app.use(cookieParser());

app.get('/api/health', (req, res) => res.json({ ok: true }));

// routes get mounted here later

export default app;