// Load environment variables from .env file if it exists
try {
    require('dotenv').config();
} catch (e) {
    console.log('Note: dotenv not installed. Using environment variables or defaults.');
}

const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs').promises;
const multer = require('multer');
const https = require('https');

// Import MVC components
const sessionMiddleware = require('./config/session');
const authRoutes = require('./routes/authRoutes');
const { requireAuth, getCurrentUser } = require('./middleware/auth');
const { getDatabase } = require('./config/database');
const PlaylistRepository = require('./repositories/PlaylistRepository');

// Initialize playlist repository
const playlistRepository = new PlaylistRepository();

const app = express();
const PORT = process.env.PORT || 3000;
const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY || 'YOUR_YOUTUBE_API_KEY';

// Ensure directories exist
const UPLOADS_DIR = path.join(__dirname, 'uploads');
const DATA_DIR = path.join(__dirname, 'data');
const PLAYLISTS_DIR = path.join(DATA_DIR, 'playlists');

async function ensureDirectories() {
    try {
        await fs.mkdir(DATA_DIR, { recursive: true });
        await fs.mkdir(PLAYLISTS_DIR, { recursive: true });
        await fs.mkdir(UPLOADS_DIR, { recursive: true });
    } catch (error) {
        console.error('Error creating directories:', error);
    }
}

// Configure EJS
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Trust proxy (important for Render and other hosting services)
app.set('trust proxy', 1);

// Middleware
// CORS configuration - allow credentials for sessions
app.use(cors({
    origin: true, // Allow all origins (or specify your Render URL)
    credentials: true, // Allow cookies/sessions
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session configuration (using SQLite store)
// Note: session store will create data directory automatically, but we ensure it exists first
// We initialize session middleware after directories are created in startServer()
app.use(sessionMiddleware);

// Make user available to all views
app.use((req, res, next) => {
    res.locals.user = req.session.user || null;
    next();
});

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, UPLOADS_DIR);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({
    storage: storage,
    fileFilter: function (req, file, cb) {
        if (file.mimetype === 'audio/mpeg' || file.mimetype === 'audio/mp3') {
            cb(null, true);
        } else {
            cb(new Error('Only MP3 files are allowed!'), false);
        }
    },
    limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// ==================== ROUTES ====================

// Home page
app.get('/', (req, res) => {
    res.render('index', {
        title: 'Home',
        user: req.session.user || null
    });
});

// Authentication routes (using separate routes file)
app.use(authRoutes);

// Protected routes
app.get('/search', requireAuth, getCurrentUser, (req, res) => {
    res.render('search', {
        title: 'Search',
        user: req.session.user
    });
});

app.get('/playlists', requireAuth, getCurrentUser, (req, res) => {
    res.render('playlists', {
        title: 'Playlists',
        user: req.session.user
    });
});

// Redirect old HTML files to new routes
app.get('/login.html', (req, res) => res.redirect('/login'));
app.get('/register.html', (req, res) => res.redirect('/register'));
app.get('/index.html', (req, res) => res.redirect('/'));

// Serve static files from frontend directory (AFTER routes, so routes take precedence)
app.use(express.static(path.join(__dirname, '..', 'frontend')));

// Serve uploaded files
app.use('/uploads', express.static(UPLOADS_DIR));

// ==================== API ROUTES (for AJAX calls) ====================

// YouTube Search API
app.get('/api/search', requireAuth, async (req, res) => {
    try {
        const query = req.query.q;
        
        if (!query || query.trim() === '') {
            return res.status(400).json({ error: 'Search query is required' });
        }
        
        console.log('YouTube search request:', { query, hasApiKey: !!YOUTUBE_API_KEY && YOUTUBE_API_KEY !== 'YOUR_YOUTUBE_API_KEY' });
        
        // Check if API key is set
        if (!YOUTUBE_API_KEY || YOUTUBE_API_KEY === 'YOUR_YOUTUBE_API_KEY') {
            console.warn('YouTube API key not configured.');
            return res.status(503).json({ 
                error: 'YouTube API key not configured.',
                items: []
            });
        }
        
        const searchQuery = query.trim();
        const youtubeUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&maxResults=20&q=${encodeURIComponent(searchQuery)}&type=video&videoCategoryId=10&key=${YOUTUBE_API_KEY}&order=relevance`;
        
        console.log('Calling YouTube API:', youtubeUrl.replace(YOUTUBE_API_KEY, '***'));
        
        let data;
        if (typeof fetch !== 'undefined') {
            const response = await fetch(youtubeUrl);
            
            if (!response.ok) {
                const errorText = await response.text();
                console.error('YouTube API error response:', response.status, errorText);
                
                if (response.status === 403) {
                    throw new Error('YouTube API key is invalid or quota exceeded.');
                } else if (response.status === 400) {
                    throw new Error('Invalid YouTube API request.');
                } else {
                    throw new Error(`YouTube API error: ${response.status}`);
                }
            }
            
            data = await response.json();
        } else {
            data = await new Promise((resolve, reject) => {
                https.get(youtubeUrl, (res) => {
                    let body = '';
                    res.on('data', (chunk) => body += chunk);
                    res.on('end', () => {
                        try {
                            if (res.statusCode !== 200) {
                                console.error('YouTube API error:', res.statusCode, body);
                                if (res.statusCode === 403) {
                                    reject(new Error('YouTube API key is invalid or quota exceeded.'));
                                } else {
                                    reject(new Error(`YouTube API error: ${res.statusCode}`));
                                }
                                return;
                            }
                            resolve(JSON.parse(body));
                        } catch (e) {
                            reject(e);
                        }
                    });
                }).on('error', reject);
            });
        }
        
        if (!data.items || data.items.length === 0) {
            console.log('No results found for query:', searchQuery);
            return res.json({ items: [] });
        }
        
        console.log(`Found ${data.items.length} results for query: ${searchQuery}`);
        
        const videoIds = data.items.map(item => item.id.videoId).join(',');
        let videoStats = {};
        
        async function fetchVideoStats(videoIds) {
            const statsUrl = `https://www.googleapis.com/youtube/v3/videos?part=statistics,contentDetails&id=${videoIds}&key=${YOUTUBE_API_KEY}`;
            
            if (typeof fetch !== 'undefined') {
                const statsResponse = await fetch(statsUrl);
                if (statsResponse.ok) {
                    const statsData = await statsResponse.json();
                    const stats = {};
                    if (statsData.items) {
                        statsData.items.forEach(item => {
                            stats[item.id] = {
                                viewCount: parseInt(item.statistics.viewCount || 0),
                                duration: item.contentDetails.duration
                            };
                        });
                    }
                    return stats;
                }
                return {};
            } else {
                return new Promise((resolve, reject) => {
                    https.get(statsUrl, (res) => {
                        let body = '';
                        res.on('data', (chunk) => body += chunk);
                        res.on('end', () => {
                            try {
                                if (res.statusCode === 200) {
                                    const parsed = JSON.parse(body);
                                    const stats = {};
                                    if (parsed.items) {
                                        parsed.items.forEach(item => {
                                            stats[item.id] = {
                                                viewCount: parseInt(item.statistics.viewCount || 0),
                                                duration: item.contentDetails.duration
                                            };
                                        });
                                    }
                                    resolve(stats);
                                } else {
                                    resolve({});
                                }
                            } catch (e) {
                                reject(e);
                            }
                        });
                    }).on('error', reject);
                });
            }
        }
        
        try {
            console.log('Fetching video statistics...');
            videoStats = await fetchVideoStats(videoIds);
        } catch (error) {
            console.error('Error fetching video statistics:', error);
        }
        
        function formatDuration(duration) {
            if (!duration) return null;
            const match = duration.match(/PT(\d+H)?(\d+M)?(\d+S)?/);
            if (!match) return null;
            
            const hours = (match[1] || '').replace('H', '') || '0';
            const minutes = (match[2] || '').replace('M', '') || '0';
            const seconds = (match[3] || '').replace('S', '') || '0';
            
            const h = parseInt(hours);
            const m = parseInt(minutes);
            const s = parseInt(seconds);
            
            if (h > 0) {
                return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
            } else {
                return `${m}:${s.toString().padStart(2, '0')}`;
            }
        }
        
        function formatViewCount(count) {
            if (!count) return '0';
            if (count >= 1000000) {
                return (count / 1000000).toFixed(1) + 'M';
            } else if (count >= 1000) {
                return (count / 1000).toFixed(1) + 'K';
            }
            return count.toString();
        }
        
        const results = data.items.map(item => {
            const thumbnail = item.snippet.thumbnails.medium?.url || 
                            item.snippet.thumbnails.high?.url || 
                            item.snippet.thumbnails.default?.url || 
                            'https://via.placeholder.com/320x180';
            
            const stats = videoStats[item.id.videoId] || {};
            const viewCount = stats.viewCount || 0;
            const duration = stats.duration ? formatDuration(stats.duration) : null;
            
            return {
                videoId: item.id.videoId,
                title: item.snippet.title,
                channelTitle: item.snippet.channelTitle,
                thumbnail: thumbnail,
                description: item.snippet.description,
                publishedAt: item.snippet.publishedAt,
                duration: duration,
                viewCount: formatViewCount(viewCount),
                viewCountRaw: viewCount
            };
        });
        
        res.json({ items: results });
    } catch (error) {
        console.error('YouTube search error:', error);
        return res.status(500).json({ 
            error: `Search failed: ${error.message}`,
            items: []
        });
    }
});

// ==================== PLAYLISTS API (SQLite Database) ====================

// Get all playlists for current user
app.get('/api/playlists', requireAuth, async (req, res) => {
    try {
        const username = req.session.user.username;
        const playlists = await playlistRepository.findAllByUsername(username);
        res.json({ playlists });
    } catch (error) {
        console.error('Get playlists error:', error);
        res.status(500).json({ error: 'Error fetching playlists' });
    }
});

// Save/sync all playlists for current user
app.post('/api/playlists', requireAuth, async (req, res) => {
    try {
        const { playlists } = req.body;
        const username = req.session.user.username;
        
        if (!playlists || !Array.isArray(playlists)) {
            return res.status(400).json({ error: 'Playlists must be an array' });
        }
        
        // Validate playlist names
        for (const playlist of playlists) {
            if (!playlist.name || playlist.name.trim() === '') {
                return res.status(400).json({ error: 'Playlist name cannot be empty' });
            }
        }
        
        // Save all playlists to database
        await playlistRepository.saveAll(username, playlists);
        res.json({ success: true, message: 'Playlists saved successfully' });
    } catch (error) {
        console.error('Save playlists error:', error);
        res.status(500).json({ error: 'Error saving playlists' });
    }
});

// Add item to playlist
app.post('/api/playlists/:id/items', requireAuth, async (req, res) => {
    try {
        const playlistId = parseInt(req.params.id);
        const username = req.session.user.username;
        const item = req.body;
        
        if (!item || (!item.videoId && !item.title)) {
            return res.status(400).json({ error: 'Item must have videoId or title' });
        }
        
        // Check if playlist belongs to user
        const belongsToUser = await playlistRepository.belongsToUser(playlistId, username);
        if (!belongsToUser) {
            return res.status(404).json({ error: 'Playlist not found or does not belong to user' });
        }
        
        // Add song to playlist
        try {
            const song = await playlistRepository.addSong(playlistId, item);
            const playlist = await playlistRepository.findById(playlistId);
            res.json({ success: true, message: 'Item added to playlist successfully', playlist, song });
        } catch (err) {
            if (err.message === 'Song already exists in playlist') {
                return res.status(400).json({ error: 'Item already exists in playlist' });
            }
            throw err;
        }
    } catch (error) {
        console.error('Add item error:', error);
        res.status(500).json({ error: 'Error adding item to playlist' });
    }
});

// Delete item from playlist
app.delete('/api/playlists/:id/items/:videoId', requireAuth, async (req, res) => {
    try {
        const playlistId = parseInt(req.params.id);
        const videoId = req.params.videoId;
        const username = req.session.user.username;
        
        // Check if playlist belongs to user
        const belongsToUser = await playlistRepository.belongsToUser(playlistId, username);
        if (!belongsToUser) {
            return res.status(404).json({ error: 'Playlist not found or does not belong to user' });
        }
        
        // Remove song from playlist
        const removed = await playlistRepository.removeSong(playlistId, videoId);
        
        if (!removed) {
            return res.status(404).json({ error: 'Item not found in playlist' });
        }
        
        const playlist = await playlistRepository.findById(playlistId);
        res.json({ success: true, message: 'Item deleted from playlist successfully', playlist });
    } catch (error) {
        console.error('Delete item error:', error);
        res.status(500).json({ error: 'Error deleting item from playlist' });
    }
});

// Delete a playlist
app.delete('/api/playlists/:id', requireAuth, async (req, res) => {
    try {
        const playlistId = parseInt(req.params.id);
        const username = req.session.user.username;
        
        // Check if playlist belongs to user
        const belongsToUser = await playlistRepository.belongsToUser(playlistId, username);
        if (!belongsToUser) {
            return res.status(404).json({ error: 'Playlist not found or does not belong to user' });
        }
        
        // Delete playlist (songs will be deleted automatically due to CASCADE)
        await playlistRepository.delete(playlistId);
        res.json({ success: true, message: 'Playlist deleted successfully' });
    } catch (error) {
        console.error('Delete playlist error:', error);
        res.status(500).json({ error: 'Error deleting playlist' });
    }
});

app.post('/api/upload/mp3', requireAuth, upload.single('mp3file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        const username = req.session.user.username;
        const fileUrl = `/uploads/${req.file.filename}`;
        
        const songData = {
            videoId: `mp3-${Date.now()}`, // Unique ID for MP3 files
            type: 'mp3',
            title: req.body.title || req.file.originalname.replace('.mp3', ''),
            channelTitle: req.body.artist || 'Unknown Artist',
            thumbnail: '/uploads/default-music.png',
            fileUrl: fileUrl,
            duration: req.body.duration || '0:00',
            viewCount: '0',
            rating: 0
        };

        // Get user's playlists
        let playlists = await playlistRepository.findAllByUsername(username);
        
        // If user has no playlists, create a default one
        if (playlists.length === 0) {
            await playlistRepository.createByUsername(username, 'My Playlist');
            playlists = await playlistRepository.findAllByUsername(username);
        }

        // Find target playlist
        let targetPlaylistId = req.body.playlistId ? parseInt(req.body.playlistId) : parseInt(playlists[0].id);
        
        // Check if playlist belongs to user
        const belongsToUser = await playlistRepository.belongsToUser(targetPlaylistId, username);
        if (!belongsToUser) {
            targetPlaylistId = parseInt(playlists[0].id);
        }
        
        // Add song to playlist
        const song = await playlistRepository.addSong(targetPlaylistId, songData);

        res.json({
            success: true,
            message: 'File uploaded and added to playlist',
            song: song
        });
    } catch (error) {
        console.error('Upload error:', error);
        res.status(500).json({ error: 'Error uploading file' });
    }
});

// Initialize database and start server
async function startServer() {
    try {
        console.log('=== Starting server initialization ===');
        console.log('Current working directory:', process.cwd());
        console.log('__dirname:', __dirname);
        console.log('Node version:', process.version);
        
        // Ensure all directories exist first
        console.log('Step 1: Creating directories...');
        console.log('DATA_DIR:', DATA_DIR);
        console.log('PLAYLISTS_DIR:', PLAYLISTS_DIR);
        console.log('UPLOADS_DIR:', UPLOADS_DIR);
        
        await ensureDirectories();
        console.log('Directories created');
        
        // Verify directories exist
        console.log('Step 2: Verifying directories exist...');
        try {
            await fs.access(DATA_DIR);
            console.log('✓ DATA_DIR exists');
            await fs.access(PLAYLISTS_DIR);
            console.log('✓ PLAYLISTS_DIR exists');
            await fs.access(UPLOADS_DIR);
            console.log('✓ UPLOADS_DIR exists');
            console.log('All directories verified');
        } catch (err) {
            console.error('✗ Directory verification failed:', err);
            console.error('Error details:', err.message);
            console.error('Error stack:', err.stack);
            throw new Error('Failed to create required directories: ' + err.message);
        }
        
        // Initialize database (this will create the database file if it doesn't exist)
        console.log('Step 3: Initializing database...');
        try {
            await getDatabase(); // Initialize database
            console.log('✓ Database initialized successfully');
        } catch (dbError) {
            console.error('✗ Database initialization failed:', dbError);
            console.error('Database error details:', dbError.message);
            console.error('Database error stack:', dbError.stack);
            throw dbError;
        }
        
        console.log('Step 4: Starting HTTP server...');
        app.listen(PORT, () => {
            console.log('=== Server started successfully ===');
            console.log(`Server is running on http://localhost:${PORT}`);
            console.log(`Database: SQLite at ${path.join(DATA_DIR, 'database.db')}`);
            console.log(`Sessions: SQLite at ${path.join(DATA_DIR, 'sessions.sqlite')}`);
            console.log(`Uploads directory: ${UPLOADS_DIR}`);
        });
        
        // Handle server errors
        app.on('error', (err) => {
            console.error('Server error:', err);
        });
        
    } catch (error) {
        console.error('=== SERVER STARTUP FAILED ===');
        console.error('Error type:', error.constructor.name);
        console.error('Error message:', error.message);
        console.error('Error stack:', error.stack);
        if (error.code) {
            console.error('Error code:', error.code);
        }
        if (error.errno) {
            console.error('Error errno:', error.errno);
        }
        console.error('=== END ERROR ===');
        process.exit(1);
    }
}

startServer();
