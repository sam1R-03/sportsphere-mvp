const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static('public'));

// Путь к файлу базы данных
const dbPath = path.join(__dirname, 'data', 'db.json');

// Инициализация базы данных
function initDB() {
    if (!fs.existsSync(dbPath)) {
        const initialData = {
            users: [],
            workouts: [],
            videos: [],
            challenges: [],
            participations: [],
            reactions: []
        };
        fs.writeFileSync(dbPath, JSON.stringify(initialData, null, 2));
    }
}

// Чтение базы данных
function readDB() {
    const data = fs.readFileSync(dbPath);
    return JSON.parse(data);
}

// Запись в базу данных
function writeDB(data) {
    fs.writeFileSync(dbPath, JSON.stringify(data, null, 2));
}

initDB();

// Функция отправки в Битрикс24
async function sendToBitrix24(userData) {
    const WEBHOOK_URL = 'https://b24-istmml.bitrix24.ru/rest/1/txef51my7nbmkec3/';
    
    const fields = {
        NAME: userData.username,
        EMAIL: [{ VALUE: userData.email, VALUE_TYPE: 'WORK' }],
        UF_CRM_ROLE: userData.role || 'user',
        UF_CRM_SKILL_LEVEL: userData.fitness_level || 'beginner',
        UF_CRM_USER_ID: userData.user_id,
        UF_CRM_ACTIVITY_SCORE: 0,
        UF_CRM_REG_DATE: new Date().toISOString().split('T')[0]
    };
    
    try {
        const response = await fetch(WEBHOOK_URL + 'crm.contact.add.json', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fields })
        });
        const result = await response.json();
        console.log('CRM ответ:', result);
        return result;
    } catch (error) {
        console.error('Ошибка отправки в CRM:', error.message);
        return null;
    }
}

// API: создать тренировку
app.post('/api/workouts', (req, res) => {
    const { user_id, duration, workout_type, date, raw_video_url } = req.body;
    const db = readDB();
    const newWorkout = {
        workout_id: 'wk_' + Date.now(),
        user_id,
        duration,
        workout_type,
        date,
        raw_video_url,
        created_at: new Date().toISOString()
    };
    db.workouts.push(newWorkout);
    writeDB(db);
    res.json(newWorkout);
});

// API: получить все тренировки
app.get('/api/workouts', (req, res) => {
    const db = readDB();
    res.json(db.workouts);
});

// API: создать видео (AI-монтаж)
app.post('/api/videos', (req, res) => {
    const { workout_id, user_id, video_url, style_id, is_ai_generated } = req.body;
    const db = readDB();
    const newVideo = {
        video_id: 'vid_' + Date.now(),
        workout_id,
        user_id,
        video_url,
        duration: 60,
        style_id: style_id || 'style_default',
        music_track: 'default',
        created_at: new Date().toISOString(),
        is_ai_generated: is_ai_generated !== false
    };
    db.videos.push(newVideo);
    writeDB(db);
    res.json(newVideo);
});

// API: получить все видео
app.get('/api/videos', (req, res) => {
    const db = readDB();
    res.json(db.videos);
});

// API: создать челлендж
app.post('/api/challenges', (req, res) => {
    const { title, description, difficulty_level, start_date, end_date, created_by } = req.body;
    const db = readDB();
    const newChallenge = {
        challenge_id: 'ch_' + Date.now(),
        title,
        description,
        difficulty_level,
        start_date,
        end_date,
        created_by,
        status: 'active'
    };
    db.challenges.push(newChallenge);
    writeDB(db);
    res.json(newChallenge);
});

// API: получить челленджи
app.get('/api/challenges', (req, res) => {
    const db = readDB();
    res.json(db.challenges);
});

// API: создать реакцию (лайк/комментарий)
app.post('/api/reactions', (req, res) => {
    const { user_id, video_id, type, comment_text } = req.body;
    const db = readDB();
    const newReaction = {
        reaction_id: 're_' + Date.now(),
        user_id,
        video_id,
        type,
        comment_text: comment_text || '',
        created_at: new Date().toISOString()
    };
    db.reactions.push(newReaction);
    writeDB(db);
    res.json(newReaction);
});

// API: регистрация пользователя (с отправкой в Битрикс24)
app.post('/api/users', async (req, res) => {
    const { username, email, password, role, fitness_level } = req.body;
    const db = readDB();
    const newUser = {
        user_id: 'usr_' + Date.now(),
        username,
        email,
        password_hash: 'hash_' + password,
        role: role || 'user',
        fitness_level: fitness_level || 'beginner',
        created_at: new Date().toISOString()
    };
    db.users.push(newUser);
    writeDB(db);
    
    // Отправка в Битрикс24 (не ждём ответа, чтобы не тормозить регистрацию)
    sendToBitrix24({
        user_id: newUser.user_id,
        username: newUser.username,
        email: newUser.email,
        role: newUser.role,
        fitness_level: newUser.fitness_level
    });
    
    res.json({ user_id: newUser.user_id, username: newUser.username });
});

// Тестовый endpoint для проверки интеграции
app.get('/test-bitrix', async (req, res) => {
    const result = await sendToBitrix24({
        user_id: 'test_123',
        username: 'ТестИзБраузера',
        email: 'test@browser.ru',
        role: 'user',
        fitness_level: 'beginner'
    });
    res.json(result);
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});