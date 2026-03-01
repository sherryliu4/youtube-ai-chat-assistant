require('dotenv').config();
const express = require('express');
const { MongoClient, ObjectId } = require('mongodb');
const bcrypt = require('bcryptjs');
const cors = require('cors');
const { Innertube, UniversalCache } = require('youtubei.js');
const { YoutubeTranscript } = require('youtube-transcript');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

const URI = process.env.REACT_APP_MONGODB_URI || process.env.MONGODB_URI || process.env.REACT_APP_MONGO_URI;
const DB = 'chatapp';

let db;

async function connect() {
  const client = await MongoClient.connect(URI);
  db = client.db(DB);
  console.log('MongoDB connected');
}

app.get('/', (req, res) => {
  res.send(`
    <html>
      <body style="font-family:sans-serif;padding:2rem;background:#00356b;color:white;min-height:100vh;display:flex;align-items:center;justify-content:center;margin:0">
        <div style="text-align:center">
          <h1>Chat API Server</h1>
          <p>Backend is running. Use the React app at <a href="http://localhost:3000" style="color:#ffd700">localhost:3000</a></p>
          <p><a href="/api/status" style="color:#ffd700">Check DB status</a></p>
        </div>
      </body>
    </html>
  `);
});

app.get('/api/status', async (req, res) => {
  try {
    const usersCount = await db.collection('users').countDocuments();
    const sessionsCount = await db.collection('sessions').countDocuments();
    res.json({ usersCount, sessionsCount });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Users ────────────────────────────────────────────────────────────────────

app.post('/api/users', async (req, res) => {
  try {
    const { username, password, email, firstName, lastName } = req.body;
    if (!username || !password)
      return res.status(400).json({ error: 'Username and password required' });
    if (!firstName || !lastName)
      return res.status(400).json({ error: 'First and Last name required' });

    const name = String(username).trim().toLowerCase();
    const existing = await db.collection('users').findOne({ username: name });
    if (existing) return res.status(400).json({ error: 'Username already exists' });
    const hashed = await bcrypt.hash(password, 10);
    await db.collection('users').insertOne({
      username: name,
      password: hashed,
      email: email ? String(email).trim().toLowerCase() : null,
      firstName: String(firstName).trim(),
      lastName: String(lastName).trim(),
      createdAt: new Date().toISOString(),
    });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/users/:username', async (req, res) => {
  try {
    const name = req.params.username.trim().toLowerCase();
    const user = await db.collection('users').findOne({ username: name });
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ 
      username: user.username, 
      firstName: user.firstName, 
      lastName: user.lastName 
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/users/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password)
      return res.status(400).json({ error: 'Username and password required' });
    const name = username.trim().toLowerCase();
    const user = await db.collection('users').findOne({ username: name });
    if (!user) return res.status(401).json({ error: 'User not found' });
    const ok = await bcrypt.compare(password, user.password);
    if (!ok) return res.status(401).json({ error: 'Invalid password' });
    res.json({ 
      ok: true, 
      username: name, 
      firstName: user.firstName, 
      lastName: user.lastName 
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Sessions ─────────────────────────────────────────────────────────────────

app.get('/api/sessions', async (req, res) => {
  try {
    const { username } = req.query;
    if (!username) return res.status(400).json({ error: 'username required' });
    const sessions = await db
      .collection('sessions')
      .find({ username })
      .sort({ createdAt: -1 })
      .toArray();
    res.json(
      sessions.map((s) => ({
        id: s._id.toString(),
        agent: s.agent || null,
        title: s.title || null,
        createdAt: s.createdAt,
        messageCount: (s.messages || []).length,
      }))
    );
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/sessions', async (req, res) => {
  try {
    const { username, agent } = req.body;
    if (!username) return res.status(400).json({ error: 'username required' });
    const { title } = req.body;
    const result = await db.collection('sessions').insertOne({
      username,
      agent: agent || null,
      title: title || null,
      createdAt: new Date().toISOString(),
      messages: [],
    });
    res.json({ id: result.insertedId.toString() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/sessions/:id', async (req, res) => {
  try {
    await db.collection('sessions').deleteOne({ _id: new ObjectId(req.params.id) });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.patch('/api/sessions/:id/title', async (req, res) => {
  try {
    const { title } = req.body;
    await db.collection('sessions').updateOne(
      { _id: new ObjectId(req.params.id) },
      { $set: { title } }
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Messages ─────────────────────────────────────────────────────────────────

app.post('/api/messages', async (req, res) => {
  try {
    const { session_id, role, content, imageData, charts, toolCalls } = req.body;
    if (!session_id || !role || content === undefined)
      return res.status(400).json({ error: 'session_id, role, content required' });
    const msg = {
      role,
      content,
      timestamp: new Date().toISOString(),
      ...(imageData && {
        imageData: Array.isArray(imageData) ? imageData : [imageData],
      }),
      ...(charts?.length && { charts }),
      ...(toolCalls?.length && { toolCalls }),
    };
    await db.collection('sessions').updateOne(
      { _id: new ObjectId(session_id) },
      { $push: { messages: msg } }
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/messages', async (req, res) => {
  try {
    const { session_id } = req.query;
    if (!session_id) return res.status(400).json({ error: 'session_id required' });
    const doc = await db
      .collection('sessions')
      .findOne({ _id: new ObjectId(session_id) });
    const raw = doc?.messages || [];
    const msgs = raw.map((m, i) => {
      const arr = m.imageData
        ? Array.isArray(m.imageData)
          ? m.imageData
          : [m.imageData]
        : [];
      return {
        id: `${doc._id}-${i}`,
        role: m.role,
        content: m.content,
        timestamp: m.timestamp,
        images: arr.length
          ? arr.map((img) => ({ data: img.data, mimeType: img.mimeType }))
          : undefined,
        charts: m.charts?.length ? m.charts : undefined,
        toolCalls: m.toolCalls?.length ? m.toolCalls : undefined,
      };
    });
    res.json(msgs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── YouTube Download Jobs ────────────────────────────────────────────────────

const jobs = {}; // In-memory job store: { id: { status, progress, message, data, error } }

app.post('/api/youtube/channel-download', async (req, res) => {
  try {
    const { channelUrl, maxVideos = 10 } = req.body;
    if (!channelUrl) return res.status(400).json({ error: 'channelUrl required' });
    
    const limit = Math.min(Math.max(1, parseInt(maxVideos) || 10), 100);
    const jobId = new ObjectId().toString();
    
    jobs[jobId] = { 
      status: 'running', 
      progress: 0, 
      message: 'Initializing...', 
      data: null 
    };

    // Start background processing
    processChannelDownload(jobId, channelUrl, limit).catch(err => {
      console.error(`Job ${jobId} failed:`, err);
      jobs[jobId] = { status: 'error', progress: 0, message: err.message };
    });

    res.json({ jobId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/youtube/job/:id', (req, res) => {
  const job = jobs[req.params.id];
  if (!job) return res.status(404).json({ error: 'Job not found' });
  res.json({ 
    status: job.status, 
    progress: job.progress, 
    message: job.message,
    // Don't send full data here to keep it light, download endpoint does that
  });
});

app.get('/api/youtube/job/:id/download', (req, res) => {
  const job = jobs[req.params.id];
  if (!job || job.status !== 'done') return res.status(404).json({ error: 'Job not ready or found' });
  
  const json = JSON.stringify(job.data, null, 2);
  const filename = `channel_data_${req.params.id}.json`;
  
  res.setHeader('Content-disposition', `attachment; filename=${filename}`);
  res.setHeader('Content-type', 'application/json');
  res.send(json);
});

async function processChannelDownload(jobId, channelUrl, limit) {
  try {
    jobs[jobId].message = 'Connecting to YouTube...';
    const youtube = await Innertube.create({ cache: new UniversalCache(false), generate_session_locally: true });
    
    // Resolve channel
    let channelId;
    try {
      // Try to get navigation endpoint from URL
      const endpoint = await youtube.resolveURL(channelUrl);
      if (!endpoint.payload.browseId) throw new Error('Not a channel URL');
      channelId = endpoint.payload.browseId;
    } catch (e) {
      throw new Error('Could not resolve channel URL: ' + e.message);
    }

    jobs[jobId].message = 'Fetching video list...';
    const channel = await youtube.getChannel(channelId);
    const videos = await channel.getVideos();
    
    let videoList = videos.videos;
    // If not enough videos, try to continue fetching? 
    // For simplicity, we just take what's initially returned or try one continuation if needed.
    // youtubei.js handles pagination but we need to be careful not to fetch too much.
    
    // We only need 'limit' videos.
    const videosToProcess = videoList.slice(0, limit);
    const results = [];

    for (let i = 0; i < videosToProcess.length; i++) {
      const video = videosToProcess[i];
      const videoId = video.id;
      
      jobs[jobId].message = `Processing video ${i + 1}/${videosToProcess.length}: ${video.title.text || 'Unknown'}`;
      jobs[jobId].progress = i / videosToProcess.length;

      try {
        // Fetch video details (stats, description, etc)
        const info = await youtube.getBasicInfo(videoId);
        
        // Fetch transcript
        let transcriptText = null;
        try {
          const transcriptData = await YoutubeTranscript.fetchTranscript(videoId);
          transcriptText = transcriptData.map(t => t.text).join(' ');
        } catch (err) {
          // Transcript unavailable
        }

        const basic = info.basic_info;
        
        results.push({
          title: basic.title,
          description: basic.short_description,
          transcript: transcriptText,
          duration_seconds: basic.duration,
          release_date: new Date(basic.start_timestamp ? basic.start_timestamp * 1000 : Date.now()).toISOString(), // approximate if unavailable
          view_count: basic.view_count,
          like_count: basic.like_count,
          comment_count: 0, // Basic info might not have comment count easily without extra fetch, defaulting to 0 or omitting
          video_url: `https://www.youtube.com/watch?v=${videoId}`
        });

      } catch (err) {
        console.error(`Error processing video ${videoId}:`, err);
        // Continue despite error
      }
    }

    jobs[jobId].data = {
      channel_url: channelUrl,
      fetched_at: new Date().toISOString(),
      max_videos_requested: limit,
      videos: results
    };
    jobs[jobId].status = 'done';
    jobs[jobId].progress = 1;
    jobs[jobId].message = 'Done!';

  } catch (err) {
    console.error(err);
    jobs[jobId].status = 'error';
    jobs[jobId].message = err.message;
  }
}

// ─────────────────────────────────────────────────────────────────────────────

const PORT = process.env.PORT || 3001;

connect()
  .then(() => {
    app.listen(PORT, () => console.log(`Server on http://localhost:${PORT}`));
  })
  .catch((err) => {
    console.error('MongoDB connection failed:', err.message);
    process.exit(1);
  });
