// API utility functions for server communication

const API_BASE_URL = ''; // Empty because we're on the same domain

// Get auth headers (sessions use cookies automatically, no need for tokens)
function getAuthHeaders() {
    return {
        'Content-Type': 'application/json'
        // Session cookie is sent automatically by browser
    };
}

// API calls
const api = {
    // Playlists
    async getPlaylists() {
        const response = await fetch(`${API_BASE_URL}/api/playlists`, {
            method: 'GET',
            headers: getAuthHeaders(),
            credentials: 'include' // Important for sessions
        });
        
        if (!response.ok) {
            if (response.status === 401 || response.status === 403) {
                window.location.href = '/login';
                throw new Error('Not authenticated');
            }
            throw new Error('Failed to fetch playlists');
        }
        
        let data;
        try {
            const text = await response.text();
            data = text ? JSON.parse(text) : { playlists: [] };
        } catch (e) {
            throw new Error('Invalid response from server');
        }
        
        return data;
    },

    async savePlaylists(playlists) {
        const response = await fetch(`${API_BASE_URL}/api/playlists`, {
            method: 'POST',
            headers: getAuthHeaders(),
            credentials: 'include',
            body: JSON.stringify({ playlists })
        });
        
        let data;
        try {
            const text = await response.text();
            data = text ? JSON.parse(text) : {};
        } catch (e) {
            throw new Error('Invalid response from server');
        }
        
        if (!response.ok) {
            if (response.status === 401 || response.status === 403) {
                window.location.href = '/login';
                throw new Error('Not authenticated');
            }
            throw new Error(data.error || 'Failed to save playlists');
        }
        return data;
    },

    async deletePlaylist(playlistId) {
        const response = await fetch(`${API_BASE_URL}/api/playlists/${playlistId}`, {
            method: 'DELETE',
            headers: getAuthHeaders(),
            credentials: 'include'
        });
        
        let data;
        try {
            const text = await response.text();
            data = text ? JSON.parse(text) : {};
        } catch (e) {
            throw new Error('Invalid response from server');
        }
        
        if (!response.ok) {
            if (response.status === 401 || response.status === 403) {
                window.location.href = '/login';
                throw new Error('Not authenticated');
            }
            throw new Error(data.error || 'Failed to delete playlist');
        }
        return data;
    },

    // Add item to playlist
    async addItemToPlaylist(playlistId, item) {
        const response = await fetch(`${API_BASE_URL}/api/playlists/${playlistId}/items`, {
            method: 'POST',
            headers: getAuthHeaders(),
            credentials: 'include',
            body: JSON.stringify(item)
        });
        
        let data;
        try {
            const text = await response.text();
            data = text ? JSON.parse(text) : {};
        } catch (e) {
            throw new Error('Invalid response from server');
        }
        
        if (!response.ok) {
            if (response.status === 401 || response.status === 403) {
                window.location.href = '/login';
                throw new Error('Not authenticated');
            }
            throw new Error(data.error || 'Failed to add item to playlist');
        }
        return data;
    },

    // Delete item from playlist
    async deleteItemFromPlaylist(playlistId, videoId) {
        const response = await fetch(`${API_BASE_URL}/api/playlists/${playlistId}/items/${videoId}`, {
            method: 'DELETE',
            headers: getAuthHeaders(),
            credentials: 'include'
        });
        
        let data;
        try {
            const text = await response.text();
            data = text ? JSON.parse(text) : {};
        } catch (e) {
            throw new Error('Invalid response from server');
        }
        
        if (!response.ok) {
            if (response.status === 401 || response.status === 403) {
                window.location.href = '/login';
                throw new Error('Not authenticated');
            }
            throw new Error(data.error || 'Failed to delete item from playlist');
        }
        return data;
    },

    // YouTube Search
    async searchYouTube(query) {
        const response = await fetch(`${API_BASE_URL}/api/search?q=${encodeURIComponent(query)}`, {
            method: 'GET',
            headers: getAuthHeaders(),
            credentials: 'include'
        });
        
        let data;
        try {
            const text = await response.text();
            data = text ? JSON.parse(text) : { items: [] };
        } catch (e) {
            throw new Error('Invalid response from server');
        }
        
        if (!response.ok) {
            if (response.status === 401 || response.status === 403) {
                window.location.href = '/login';
                throw new Error('Not authenticated');
            }
            // Extract error message from response
            const errorMsg = data.error || `Search failed (${response.status})`;
            throw new Error(errorMsg);
        }
        
        return data;
    },

    // File upload
    async uploadMP3(file, title, artist, playlistId, duration) {
        const formData = new FormData();
        formData.append('mp3file', file);
        if (title) formData.append('title', title);
        if (artist) formData.append('artist', artist);
        if (playlistId) formData.append('playlistId', playlistId);
        if (duration) formData.append('duration', duration);

        // Session cookie is sent automatically
        const response = await fetch(`${API_BASE_URL}/api/upload/mp3`, {
            method: 'POST',
            credentials: 'include',
            body: formData
        });
        
        let data;
        try {
            const text = await response.text();
            data = text ? JSON.parse(text) : {};
        } catch (e) {
            throw new Error('Invalid response from server');
        }
        
        if (!response.ok) {
            if (response.status === 401 || response.status === 403) {
                window.location.href = '/login';
                throw new Error('Not authenticated');
            }
            throw new Error(data.error || 'Upload failed');
        }
        return data;
    }
};
