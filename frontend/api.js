// API utility functions for server communication

const API_BASE_URL = ''; // Empty because we're on the same domain

// Get auth token from localStorage
function getAuthToken() {
    return localStorage.getItem('authToken');
}

// Set auth token
function setAuthToken(token) {
    localStorage.setItem('authToken', token);
}

// Remove auth token
function removeAuthToken() {
    localStorage.removeItem('authToken');
}

// Get auth headers
function getAuthHeaders() {
    const token = getAuthToken();
    return {
        'Content-Type': 'application/json',
        ...(token && { 'Authorization': `Bearer ${token}` })
    };
}

// API calls
const api = {
    // Authentication
    async register(userData) {
        try {
            const response = await fetch(`${API_BASE_URL}/api/auth/register`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(userData)
            });
            
            let data = {};
            let errorMessage = 'Registration failed';
            
            try {
                const text = await response.text();
                if (text) {
                    data = JSON.parse(text);
                }
            } catch (e) {
                console.error('Failed to parse response:', e);
                if (!response.ok) {
                    errorMessage = `Server error (${response.status}): ${response.statusText || 'Invalid response format'}`;
                } else {
                    errorMessage = 'Invalid response from server';
                }
            }
            
            if (!response.ok) {
                // Extract detailed error message
                if (data.error) {
                    errorMessage = data.error;
                } else if (response.status === 400) {
                    errorMessage = 'Bad request - Please check your input data';
                } else if (response.status === 500) {
                    errorMessage = 'Server error - Please try again later';
                } else {
                    errorMessage = `Registration failed (${response.status}): ${response.statusText || 'Unknown error'}`;
                }
                throw new Error(errorMessage);
            }
            return data;
        } catch (error) {
            // If it's a network error (server not running)
            if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
                throw new Error('Cannot connect to server. Please make sure the server is running on http://localhost:3000');
            }
            throw error;
        }
    },

    async login(username, password) {
        try {
            const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ username, password })
            });
            
            let data;
            try {
                const text = await response.text();
                data = text ? JSON.parse(text) : {};
            } catch (e) {
                console.error('Failed to parse response:', e);
                throw new Error('Invalid response from server. Please check if the server is running.');
            }
            
            if (!response.ok) {
                const errorMsg = data.error || `Login failed (${response.status})`;
                throw new Error(errorMsg);
            }
            return data;
        } catch (error) {
            // If it's a network error (server not running)
            if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
                throw new Error('Cannot connect to server. Please make sure the server is running on http://localhost:3000');
            }
            throw error;
        }
    },

    async logout() {
        const response = await fetch(`${API_BASE_URL}/api/auth/logout`, {
            method: 'POST',
            headers: getAuthHeaders()
        });
        
        let data = {};
        try {
            const text = await response.text();
            data = text ? JSON.parse(text) : {};
        } catch (e) {
            // Ignore parsing errors on logout
        }
        
        removeAuthToken();
        return data;
    },

    async getCurrentUser() {
        const response = await fetch(`${API_BASE_URL}/api/auth/me`, {
            method: 'GET',
            headers: getAuthHeaders()
        });
        
        if (!response.ok) {
            throw new Error('Not authenticated');
        }
        
        let data;
        try {
            const text = await response.text();
            data = text ? JSON.parse(text) : {};
        } catch (e) {
            throw new Error('Invalid response from server');
        }
        
        return data.user;
    },

    // Playlists
    async getPlaylists() {
        const response = await fetch(`${API_BASE_URL}/api/playlists`, {
            method: 'GET',
            headers: getAuthHeaders()
        });
        
        if (!response.ok) {
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
            throw new Error(data.error || 'Failed to save playlists');
        }
        return data;
    },

    async deletePlaylist(playlistId) {
        const response = await fetch(`${API_BASE_URL}/api/playlists/${playlistId}`, {
            method: 'DELETE',
            headers: getAuthHeaders()
        });
        
        let data;
        try {
            const text = await response.text();
            data = text ? JSON.parse(text) : {};
        } catch (e) {
            throw new Error('Invalid response from server');
        }
        
        if (!response.ok) {
            throw new Error(data.error || 'Failed to delete playlist');
        }
        return data;
    },

    // Add item to playlist
    async addItemToPlaylist(playlistId, item) {
        const response = await fetch(`${API_BASE_URL}/api/playlists/${playlistId}/items`, {
            method: 'POST',
            headers: getAuthHeaders(),
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
            throw new Error(data.error || 'Failed to add item to playlist');
        }
        return data;
    },

    // Delete item from playlist
    async deleteItemFromPlaylist(playlistId, videoId) {
        const response = await fetch(`${API_BASE_URL}/api/playlists/${playlistId}/items/${videoId}`, {
            method: 'DELETE',
            headers: getAuthHeaders()
        });
        
        let data;
        try {
            const text = await response.text();
            data = text ? JSON.parse(text) : {};
        } catch (e) {
            throw new Error('Invalid response from server');
        }
        
        if (!response.ok) {
            throw new Error(data.error || 'Failed to delete item from playlist');
        }
        return data;
    },

    // YouTube Search
    async searchYouTube(query) {
        const response = await fetch(`${API_BASE_URL}/api/search?q=${encodeURIComponent(query)}`, {
            method: 'GET',
            headers: getAuthHeaders()
        });
        
        let data;
        try {
            const text = await response.text();
            data = text ? JSON.parse(text) : { items: [] };
        } catch (e) {
            throw new Error('Invalid response from server');
        }
        
        if (!response.ok) {
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

        const token = getAuthToken();
        const response = await fetch(`${API_BASE_URL}/api/upload/mp3`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`
            },
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
            throw new Error(data.error || 'Upload failed');
        }
        return data;
    }
};

