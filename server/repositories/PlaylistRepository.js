const { getDatabase } = require('../config/database');

class PlaylistRepository {
    constructor() {
        this.db = null;
    }

    async getDb() {
        if (!this.db) {
            this.db = await getDatabase();
        }
        return this.db;
    }

    // ==================== PLAYLIST METHODS ====================

    // Get all playlists for a user
    async findAllByUserId(userId) {
        const db = await this.getDb();
        const playlists = await db.query(
            'SELECT * FROM playlists WHERE user_id = ? ORDER BY created_at DESC',
            [userId]
        );

        // Get songs for each playlist
        for (const playlist of playlists) {
            playlist.songs = await this.getSongsByPlaylistId(playlist.id);
        }

        return playlists.map(p => this.formatPlaylist(p));
    }

    // Get all playlists for a user by username
    async findAllByUsername(username) {
        const db = await this.getDb();
        
        // First get the user ID
        const user = await db.get('SELECT id FROM users WHERE username = ?', [username]);
        if (!user) {
            return [];
        }

        return this.findAllByUserId(user.id);
    }

    // Get a single playlist by ID
    async findById(playlistId) {
        const db = await this.getDb();
        const playlist = await db.get('SELECT * FROM playlists WHERE id = ?', [playlistId]);
        
        if (!playlist) {
            return null;
        }

        playlist.songs = await this.getSongsByPlaylistId(playlist.id);
        return this.formatPlaylist(playlist);
    }

    // Create a new playlist
    async create(userId, name) {
        const db = await this.getDb();
        const result = await db.run(
            'INSERT INTO playlists (user_id, name) VALUES (?, ?)',
            [userId, name]
        );

        return this.findById(result.lastID);
    }

    // Create playlist by username
    async createByUsername(username, name) {
        const db = await this.getDb();
        const user = await db.get('SELECT id FROM users WHERE username = ?', [username]);
        
        if (!user) {
            throw new Error('User not found');
        }

        return this.create(user.id, name);
    }

    // Update playlist name
    async update(playlistId, name) {
        const db = await this.getDb();
        await db.run(
            'UPDATE playlists SET name = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            [name, playlistId]
        );

        return this.findById(playlistId);
    }

    // Delete a playlist (songs will be deleted automatically due to CASCADE)
    async delete(playlistId) {
        const db = await this.getDb();
        const result = await db.run('DELETE FROM playlists WHERE id = ?', [playlistId]);
        return result.changes > 0;
    }

    // Check if playlist belongs to user
    async belongsToUser(playlistId, username) {
        const db = await this.getDb();
        const result = await db.get(`
            SELECT p.id FROM playlists p
            JOIN users u ON p.user_id = u.id
            WHERE p.id = ? AND u.username = ?
        `, [playlistId, username]);
        
        return !!result;
    }

    // ==================== SONG METHODS ====================

    // Get all songs for a playlist
    async getSongsByPlaylistId(playlistId) {
        const db = await this.getDb();
        const songs = await db.query(
            'SELECT * FROM songs WHERE playlist_id = ? ORDER BY added_at ASC',
            [playlistId]
        );

        return songs.map(s => this.formatSong(s));
    }

    // Add a song to a playlist
    async addSong(playlistId, songData) {
        const db = await this.getDb();
        
        // Check if song already exists in playlist
        const existing = await db.get(
            'SELECT id FROM songs WHERE playlist_id = ? AND video_id = ?',
            [playlistId, songData.videoId]
        );

        if (existing) {
            throw new Error('Song already exists in playlist');
        }

        const result = await db.run(`
            INSERT INTO songs (playlist_id, video_id, title, channel_title, thumbnail, duration, view_count, rating, file_url, type)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            playlistId,
            songData.videoId || null,
            songData.title,
            songData.channelTitle || 'Unknown Artist',
            songData.thumbnail || 'https://via.placeholder.com/320x180',
            songData.duration || '0:00',
            songData.viewCount || '0',
            songData.rating || 0,
            songData.fileUrl || null,
            songData.type || 'youtube'
        ]);

        // Update playlist timestamp
        await db.run(
            'UPDATE playlists SET updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            [playlistId]
        );

        return this.getSongById(result.lastID);
    }

    // Get a song by ID
    async getSongById(songId) {
        const db = await this.getDb();
        const song = await db.get('SELECT * FROM songs WHERE id = ?', [songId]);
        return song ? this.formatSong(song) : null;
    }

    // Remove a song from a playlist
    async removeSong(playlistId, videoId) {
        const db = await this.getDb();
        const result = await db.run(
            'DELETE FROM songs WHERE playlist_id = ? AND video_id = ?',
            [playlistId, videoId]
        );

        if (result.changes > 0) {
            // Update playlist timestamp
            await db.run(
                'UPDATE playlists SET updated_at = CURRENT_TIMESTAMP WHERE id = ?',
                [playlistId]
            );
        }

        return result.changes > 0;
    }

    // Remove song by song ID
    async removeSongById(songId) {
        const db = await this.getDb();
        
        // Get playlist ID first for updating timestamp
        const song = await db.get('SELECT playlist_id FROM songs WHERE id = ?', [songId]);
        
        const result = await db.run('DELETE FROM songs WHERE id = ?', [songId]);

        if (result.changes > 0 && song) {
            await db.run(
                'UPDATE playlists SET updated_at = CURRENT_TIMESTAMP WHERE id = ?',
                [song.playlist_id]
            );
        }

        return result.changes > 0;
    }

    // Update song rating
    async updateSongRating(songId, rating) {
        const db = await this.getDb();
        await db.run('UPDATE songs SET rating = ? WHERE id = ?', [rating, songId]);
        return this.getSongById(songId);
    }

    // ==================== HELPER METHODS ====================

    // Format playlist for API response
    formatPlaylist(dbPlaylist) {
        return {
            id: dbPlaylist.id.toString(),
            userId: dbPlaylist.user_id,
            name: dbPlaylist.name,
            songs: dbPlaylist.songs || [],
            createdAt: dbPlaylist.created_at,
            updatedAt: dbPlaylist.updated_at
        };
    }

    // Format song for API response
    formatSong(dbSong) {
        return {
            id: dbSong.id.toString(),
            videoId: dbSong.video_id,
            title: dbSong.title,
            channelTitle: dbSong.channel_title,
            thumbnail: dbSong.thumbnail,
            duration: dbSong.duration,
            viewCount: dbSong.view_count,
            rating: dbSong.rating,
            fileUrl: dbSong.file_url,
            type: dbSong.type,
            addedAt: dbSong.added_at
        };
    }

    // Save multiple playlists (for bulk update)
    async saveAll(username, playlists) {
        const db = await this.getDb();
        const user = await db.get('SELECT id FROM users WHERE username = ?', [username]);
        
        if (!user) {
            throw new Error('User not found');
        }

        // Get existing playlists
        const existingPlaylists = await db.query(
            'SELECT id FROM playlists WHERE user_id = ?',
            [user.id]
        );
        const existingIds = existingPlaylists.map(p => p.id.toString());

        // Process each playlist
        for (const playlist of playlists) {
            if (playlist.id && existingIds.includes(playlist.id.toString())) {
                // Update existing playlist
                await this.update(parseInt(playlist.id), playlist.name);
                
                // Sync songs - delete all and re-add
                await db.run('DELETE FROM songs WHERE playlist_id = ?', [parseInt(playlist.id)]);
                
                if (playlist.songs && playlist.songs.length > 0) {
                    for (const song of playlist.songs) {
                        await this.addSongDirect(parseInt(playlist.id), song);
                    }
                }
            } else {
                // Create new playlist
                const newPlaylist = await this.create(user.id, playlist.name);
                
                if (playlist.songs && playlist.songs.length > 0) {
                    for (const song of playlist.songs) {
                        await this.addSongDirect(parseInt(newPlaylist.id), song);
                    }
                }
            }
        }

        // Delete playlists that are not in the new list
        const newIds = playlists.filter(p => p.id).map(p => p.id.toString());
        for (const existingId of existingIds) {
            if (!newIds.includes(existingId)) {
                await this.delete(parseInt(existingId));
            }
        }

        return this.findAllByUserId(user.id);
    }

    // Add song without duplicate check (for internal use during sync)
    async addSongDirect(playlistId, songData) {
        const db = await this.getDb();
        
        await db.run(`
            INSERT INTO songs (playlist_id, video_id, title, channel_title, thumbnail, duration, view_count, rating, file_url, type)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            playlistId,
            songData.videoId || null,
            songData.title,
            songData.channelTitle || 'Unknown Artist',
            songData.thumbnail || 'https://via.placeholder.com/320x180',
            songData.duration || '0:00',
            songData.viewCount || '0',
            songData.rating || 0,
            songData.fileUrl || null,
            songData.type || 'youtube'
        ]);
    }
}

module.exports = PlaylistRepository;
