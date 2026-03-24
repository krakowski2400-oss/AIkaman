import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { authRouter } from './routes/auth';
import { apiRouter } from './routes/api';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serwowanie plików statycznych frontendu
app.use(express.static(path.join(process.cwd(), 'public')));

// Ścieżki autoryzacji i logowania
app.use('/api/auth', authRouter);

// Główne ścieżki generowania i API
app.use('/api', apiRouter);

// Główna strona aplikacji (fallback dla SPA - obsłuży wszystko co nie jest API)
app.use((req, res) => {
  res.sendFile(path.join(process.cwd(), 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});