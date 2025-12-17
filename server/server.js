// Load environment variables from .env file if it exists
try {
    require('dotenv').config();
} catch (e) {
    // dotenv not installed, continue without it
    console.log('Note: dotenv not installed. Using environment variables or defaults.');
}

const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs').promises;
const multer = require('multer');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const https = require('https');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY || 'YOUR_YOUTUBE_API_KEY';

// Ensure data directories exist
const DATA_DIR = path.join(__dirname, 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const PLAYLISTS_DIR = path.join(DATA_DIR, 'playlists');
const UPLOADS_DIR = path.join(__dirname, 'uploads');

async function ensureDirectories() {
    try {
        await fs.mkdir(DATA_DIR, { recursive: true });
        await fs.mkdir(PLAYLISTS_DIR, { recursive: true });
        await fs.mkdir(UPLOADS_DIR, { recursive: true });
        
        // Initialize users file if it doesn't exist
        try {
            await fs.access(USERS_FILE);
        } catch {
            await fs.writeFile(USERS_FILE, JSON.stringify([]), 'utf8');
        }
    } catch (error) {
        console.error('Error creating directories:', error);
    }
}

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files from frontend directory
app.use(express.static(path.join(__dirname, '..', 'frontend')));

// Serve uploaded files
app.use('/uploads', express.static(UPLOADS_DIR));

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

// Authentication middleware
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Access token required' });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ error: 'Invalid or expired token' });
        }
        req.user = user;
        next();
    });
}

// Helper functions
async function readUsers() {
    try {
        const data = await fs.readFile(USERS_FILE, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        return [];
    }
}

async function writeUsers(users) {
    await fs.writeFile(USERS_FILE, JSON.stringify(users, null, 2), 'utf8');
}

async function getUserPlaylistFile(username) {
    return path.join(PLAYLISTS_DIR, `${username}.json`);
}

async function readUserPlaylist(username) {
    try {
        const filePath = await getUserPlaylistFile(username);
        const data = await fs.readFile(filePath, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        return { playlists: [] };
    }
}

async function writeUserPlaylist(username, playlistData) {
    const filePath = await getUserPlaylistFile(username);
    await fs.writeFile(filePath, JSON.stringify(playlistData, null, 2), 'utf8');
}

// ==================== AUTHENTICATION API ====================

// Register
app.post('/api/auth/register', async (req, res) => {
    try {
        console.log('Registration request received:', { 
            username: req.body.username, 
            firstName: req.body.firstName,
            hasPassword: !!req.body.password,
            passwordLength: req.body.password ? req.body.password.length : 0
        });

        const { username, password, firstName, imageUrl } = req.body;

        // Validation
        if (!username || !password || !firstName) {
            const missingFields = [];
            if (!username) missingFields.push('username');
            if (!password) missingFields.push('password');
            if (!firstName) missingFields.push('firstName');
            console.log('Validation failed - missing fields:', missingFields);
            return res.status(400).json({ 
                error: `All fields are required. Missing: ${missingFields.join(', ')}` 
            });
        }
        
        // Validate imageUrl if provided
        if (imageUrl && imageUrl.trim() !== '') {
            try {
                new URL(imageUrl);
            } catch (e) {
                console.log('Invalid imageUrl:', imageUrl);
                return res.status(400).json({ 
                    error: 'Invalid image URL format' 
                });
            }
        }

        // Password validation
        if (password.length < 6) {
            console.log('Password validation failed - length:', password.length);
            return res.status(400).json({ 
                error: `Password must be at least 6 characters (current: ${password.length})` 
            });
        }

        if (!/[a-zA-Zא-ת]/.test(password)) {
            console.log('Password validation failed - no letter');
            return res.status(400).json({ 
                error: 'Password must contain at least one letter' 
            });
        }

        if (!/[0-9]/.test(password)) {
            console.log('Password validation failed - no number');
            return res.status(400).json({ 
                error: 'Password must contain at least one number' 
            });
        }

        if (!/[^a-zA-Z0-9א-ת]/.test(password)) {
            console.log('Password validation failed - no non-alphanumeric');
            return res.status(400).json({ 
                error: 'Password must contain at least one non-alphanumeric character (e.g., !, @, #, $, etc.)' 
            });
        }

        const users = await readUsers();
        console.log('Current users count:', users.length);

        // Check if username already exists
        const existingUser = users.find(u => u.username === username);
        if (existingUser) {
            console.log('Username already exists:', username);
            return res.status(400).json({ 
                error: `Username "${username}" already exists. Please choose a different username.` 
            });
        }

        // Hash password
        console.log('Hashing password...');
        const hashedPassword = await bcrypt.hash(password, 10);

        // Create new user with provided image or default
        const newUser = {
            id: Date.now().toString(), // Unique ID
            username,
            password: hashedPassword,
            firstName,
            imageUrl: (imageUrl && imageUrl.trim() !== '') ? imageUrl.trim() : 'https://via.placeholder.com/150' // Use provided image or default placeholder
        };
        
        console.log('Creating user with imageUrl:', newUser.imageUrl);

        users.push(newUser);
        console.log('Saving user to file...');
        await writeUsers(users);
        console.log('User registered successfully:', username);

        res.json({ success: true, message: 'User registered successfully' });
    } catch (error) {
        console.error('Register error:', error);
        console.error('Error stack:', error.stack);
        res.status(500).json({ 
            error: `Server error during registration: ${error.message || 'Unknown error'}` 
        });
    }
});

// Login
app.post('/api/auth/login', async (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({ error: 'Username and password are required' });
        }

        const users = await readUsers();
        const user = users.find(u => u.username === username);

        if (!user) {
            return res.status(401).json({ error: 'Invalid username or password' });
        }

        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) {
            return res.status(401).json({ error: 'Invalid username or password' });
        }

        // Generate JWT token
        const token = jwt.sign(
            { username: user.username, firstName: user.firstName, imageUrl: user.imageUrl },
            JWT_SECRET,
            { expiresIn: '24h' }
        );

        res.json({
            success: true,
            token,
            user: {
                username: user.username,
                firstName: user.firstName,
                imageUrl: user.imageUrl
            }
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Server error during login' });
    }
});

// Logout (client-side token removal, but we can add server-side token blacklist if needed)
app.post('/api/auth/logout', authenticateToken, (req, res) => {
    res.json({ success: true, message: 'Logged out successfully' });
});

// Get current user (verify token)
app.get('/api/auth/me', authenticateToken, (req, res) => {
    res.json({ user: req.user });
});

// ==================== PLAYLISTS API ====================

// Get user playlists
app.get('/api/playlists', authenticateToken, async (req, res) => {
    try {
        const username = req.user.username;
        const playlistData = await readUserPlaylist(username);
        
        // Ensure all playlists have userId
        const playlists = (playlistData.playlists || []).map(playlist => ({
            ...playlist,
            userId: playlist.userId || username // Add userId if missing
        }));
        
        res.json({ playlists });
    } catch (error) {
        console.error('Get playlists error:', error);
        res.status(500).json({ error: 'Error fetching playlists' });
    }
});

// Save user playlists
app.post('/api/playlists', authenticateToken, async (req, res) => {
    try {
        const { playlists } = req.body;
        
        // Validate playlists
        if (!playlists || !Array.isArray(playlists)) {
            return res.status(400).json({ error: 'Playlists must be an array' });
        }
        
        // Validate each playlist
        for (const playlist of playlists) {
            // Check playlist name is not empty
            if (!playlist.name || playlist.name.trim() === '') {
                return res.status(400).json({ error: 'Playlist name cannot be empty' });
            }
            
            // Ensure userId matches logged in user
            playlist.userId = req.user.username;
            
            // Ensure id exists
            if (!playlist.id) {
                playlist.id = Date.now().toString();
            }
        }
        
        await writeUserPlaylist(req.user.username, { playlists });
        res.json({ success: true, message: 'Playlists saved successfully' });
    } catch (error) {
        console.error('Save playlists error:', error);
        res.status(500).json({ error: 'Error saving playlists' });
    }
});

// Add item to playlist
app.post('/api/playlists/:id/items', authenticateToken, async (req, res) => {
    try {
        const playlistId = req.params.id;
        const username = req.user.username;
        const item = req.body;
        
        // Validate item
        if (!item || !item.videoId) {
            return res.status(400).json({ error: 'Item must have videoId' });
        }
        
        const playlistData = await readUserPlaylist(username);
        const playlist = playlistData.playlists.find(p => p.id === playlistId);
        
        if (!playlist) {
            return res.status(404).json({ error: 'Playlist not found' });
        }
        
        // Check if playlist belongs to user
        if (playlist.userId !== username) {
            return res.status(403).json({ error: 'Playlist does not belong to user' });
        }
        
        // Check for duplicates
        const exists = playlist.songs.some(s => s.videoId === item.videoId);
        if (exists) {
            return res.status(400).json({ error: 'Item already exists in playlist' });
        }
        
        // Add item with timestamp
        playlist.songs.push({
            ...item,
            addedAt: Date.now()
        });
        
        await writeUserPlaylist(username, playlistData);
        res.json({ success: true, message: 'Item added to playlist successfully', playlist });
    } catch (error) {
        console.error('Add item error:', error);
        res.status(500).json({ error: 'Error adding item to playlist' });
    }
});

// Delete item from playlist
app.delete('/api/playlists/:id/items/:videoId', authenticateToken, async (req, res) => {
    try {
        const playlistId = req.params.id;
        const videoId = req.params.videoId;
        const username = req.user.username;
        
        const playlistData = await readUserPlaylist(username);
        const playlist = playlistData.playlists.find(p => p.id === playlistId);
        
        if (!playlist) {
            return res.status(404).json({ error: 'Playlist not found' });
        }
        
        // Check if playlist belongs to user
        if (playlist.userId !== username) {
            return res.status(403).json({ error: 'Playlist does not belong to user' });
        }
        
        // Find and remove item
        const initialLength = playlist.songs.length;
        playlist.songs = playlist.songs.filter(s => s.videoId !== videoId);
        
        if (playlist.songs.length === initialLength) {
            return res.status(404).json({ error: 'Item not found in playlist' });
        }
        
        await writeUserPlaylist(username, playlistData);
        res.json({ success: true, message: 'Item deleted from playlist successfully', playlist });
    } catch (error) {
        console.error('Delete item error:', error);
        res.status(500).json({ error: 'Error deleting item from playlist' });
    }
});

// Delete playlist
app.delete('/api/playlists/:id', authenticateToken, async (req, res) => {
    try {
        const playlistId = req.params.id;
        const username = req.user.username;
        
        const playlistData = await readUserPlaylist(username);
        const initialLength = playlistData.playlists.length;
        
        // Filter out the playlist (only if it belongs to the user)
        playlistData.playlists = playlistData.playlists.filter(p => {
            // Ensure playlist belongs to user
            return p.id !== playlistId || p.userId !== username;
        });
        
        // Check if playlist was found and deleted
        if (playlistData.playlists.length === initialLength) {
            return res.status(404).json({ error: 'Playlist not found or does not belong to user' });
        }
        
        await writeUserPlaylist(username, playlistData);
        res.json({ success: true, message: 'Playlist deleted successfully' });
    } catch (error) {
        console.error('Delete playlist error:', error);
        res.status(500).json({ error: 'Error deleting playlist' });
    }
});

// ==================== YOUTUBE SEARCH API ====================

// Search YouTube videos
app.get('/api/search', authenticateToken, async (req, res) => {
    try {
        const query = req.query.q;
        
        if (!query || query.trim() === '') {
            return res.status(400).json({ error: 'Search query is required' });
        }
        
        console.log('YouTube search request:', { query, hasApiKey: !!YOUTUBE_API_KEY && YOUTUBE_API_KEY !== 'YOUR_YOUTUBE_API_KEY' });
        
        // Check if API key is set
        if (!YOUTUBE_API_KEY || YOUTUBE_API_KEY === 'YOUR_YOUTUBE_API_KEY') {
            console.warn('YouTube API key not configured. Please set YOUTUBE_API_KEY environment variable.');
            return res.status(503).json({ 
                error: 'YouTube API key not configured. Please set YOUTUBE_API_KEY environment variable or add it to .env file.',
                items: []
            });
        }
        
        // Call YouTube Data API with better parameters for music search
        const searchQuery = query.trim();
        const youtubeUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&maxResults=20&q=${encodeURIComponent(searchQuery)}&type=video&videoCategoryId=10&key=${YOUTUBE_API_KEY}&order=relevance`;
        
        console.log('Calling YouTube API:', youtubeUrl.replace(YOUTUBE_API_KEY, '***'));
        
        // Use fetch if available (Node.js 18+), otherwise use https
        let data;
        if (typeof fetch !== 'undefined') {
            const response = await fetch(youtubeUrl);
            
            if (!response.ok) {
                const errorText = await response.text();
                console.error('YouTube API error response:', response.status, errorText);
                
                if (response.status === 403) {
                    throw new Error('YouTube API key is invalid or quota exceeded. Please check your API key.');
                } else if (response.status === 400) {
                    throw new Error('Invalid YouTube API request. Please check your search query.');
                } else {
                    throw new Error(`YouTube API error: ${response.status} - ${errorText}`);
                }
            }
            
            data = await response.json();
        } else {
            // Fallback for older Node.js versions
            data = await new Promise((resolve, reject) => {
                https.get(youtubeUrl, (res) => {
                    let body = '';
                    res.on('data', (chunk) => body += chunk);
                    res.on('end', () => {
                        try {
                            if (res.statusCode !== 200) {
                                console.error('YouTube API error:', res.statusCode, body);
                                if (res.statusCode === 403) {
                                    reject(new Error('YouTube API key is invalid or quota exceeded. Please check your API key.'));
                                } else {
                                    reject(new Error(`YouTube API error: ${res.statusCode} - ${body}`));
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
        
        // Check if we got results
        if (!data.items || data.items.length === 0) {
            console.log('No results found for query:', searchQuery);
            return res.json({ items: [] });
        }
        
        console.log(`Found ${data.items.length} results for query: ${searchQuery}`);
        
        // Get video IDs for fetching statistics
        const videoIds = data.items.map(item => item.id.videoId).join(',');
        
        // Fetch video statistics (viewCount, duration, etc.) - optimized helper function
        let videoStats = {};
        
        // Helper function to make HTTP request
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
        
        // Fetch statistics (second API call to get viewCount and duration)
        try {
            console.log('Fetching video statistics...');
            videoStats = await fetchVideoStats(videoIds);
        } catch (error) {
            console.error('Error fetching video statistics:', error);
            // Continue without statistics - results will show N/A for viewCount
        }
        
        // Helper function to format duration (PT4M13S -> 4:13)
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
        
        // Helper function to format view count
        function formatViewCount(count) {
            if (!count) return '0';
            if (count >= 1000000) {
                return (count / 1000000).toFixed(1) + 'M';
            } else if (count >= 1000) {
                return (count / 1000).toFixed(1) + 'K';
            }
            return count.toString();
        }
        
        // Transform YouTube API response to our format
        const results = data.items.map(item => {
            // Get the best thumbnail available
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
        console.error('Error stack:', error.stack);
        
        // Return error instead of mock data
        return res.status(500).json({ 
            error: `Search failed: ${error.message}`,
            items: []
        });
    }
});

// Removed generateMockYouTubeResults - we now return real results or errors

// ==================== FILE UPLOAD API ====================

// Upload MP3 file
app.post('/api/upload/mp3', authenticateToken, upload.single('mp3file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        const fileUrl = `/uploads/${req.file.filename}`;
        const songData = {
            id: Date.now().toString(),
            type: 'mp3',
            title: req.body.title || req.file.originalname.replace('.mp3', ''),
            channelTitle: req.body.artist || 'Unknown Artist',
            thumbnail: '/uploads/default-music.png', // Default thumbnail
            fileUrl: fileUrl,
            duration: req.body.duration || '0:00',
            viewCount: '0',
            rating: 0,
            uploadedAt: new Date().toISOString()
        };

        // Add to user's default playlist or create one
        const playlistData = await readUserPlaylist(req.user.username);
        if (playlistData.playlists.length === 0) {
            playlistData.playlists.push({
                id: Date.now().toString(),
                name: 'My Playlist',
                songs: []
            });
        }

        // Add to first playlist (or you can specify which playlist)
        const playlistId = req.body.playlistId || playlistData.playlists[0].id;
        const playlist = playlistData.playlists.find(p => p.id === playlistId);
        
        if (playlist) {
            playlist.songs.push(songData);
        } else {
            playlistData.playlists[0].songs.push(songData);
        }

        await writeUserPlaylist(req.user.username, playlistData);

        res.json({
            success: true,
            message: 'File uploaded and added to playlist',
            song: songData
        });
    } catch (error) {
        console.error('Upload error:', error);
        res.status(500).json({ error: 'Error uploading file' });
    }
});

// Serve index.html for root route
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'frontend', 'index.html'));
});

// Initialize and start server
ensureDirectories().then(() => {
    app.listen(PORT, () => {
        console.log(`Server is running on http://localhost:${PORT}`);
        console.log(`Data directory: ${DATA_DIR}`);
        console.log(`Uploads directory: ${UPLOADS_DIR}`);
    });
});
