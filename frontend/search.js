// Search page functionality with YouTube API

document.addEventListener('DOMContentLoaded', function() {
    // Require login
    if (!requireLogin()) return;
    
    // Prevent back navigation to login/register pages
    window.addEventListener('pageshow', function(event) {
        if (event.persisted || (window.performance && window.performance.navigation.type === 2)) {
            if (!isLoggedIn()) {
                window.location.replace('login.html');
            }
        }
    });
    
    // Display welcome message
    displayWelcomeMessage();
    
    const searchInput = document.getElementById('searchInput');
    const searchBtn = document.getElementById('searchBtn');
    const searchResults = document.getElementById('searchResults');
    const playerModal = new bootstrap.Modal(document.getElementById('playerModal'));
    const playlistModal = new bootstrap.Modal(document.getElementById('playlistModal'));
    
    // Load playlists from server
    let allPlaylists = [];
    
    async function loadPlaylists() {
        try {
            const data = await api.getPlaylists();
            allPlaylists = data.playlists || [];
        } catch (error) {
            console.error('Error loading playlists:', error);
            allPlaylists = [];
        }
    }
    
    // Load playlists on page load
    loadPlaylists();
    
    // Check URL for search query
    const urlParams = new URLSearchParams(window.location.search);
    const searchQuery = urlParams.get('q');
    if (searchQuery) {
        searchInput.value = searchQuery;
        performSearch();
    }
    
    // Search on button click
    searchBtn.addEventListener('click', performSearch);
    
    // Search on Enter key
    searchInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            performSearch();
        }
    });
    
    // Playlist modal handlers
    let currentSongToAdd = null;
    
    document.getElementById('createNewPlaylistBtn').addEventListener('click', function() {
        document.getElementById('newPlaylistForm').style.display = 'block';
    });
    
    document.getElementById('saveNewPlaylistBtn').addEventListener('click', async function() {
        const playlistName = document.getElementById('newPlaylistName').value.trim();
        if (!playlistName) {
            alert('Please enter a playlist name');
            return;
        }
        
        const currentUser = getCurrentUser();
        const newPlaylist = {
            id: Date.now().toString(),
            userId: currentUser.username,
            name: playlistName,
            songs: []
        };
        
        // Add song to new playlist
        if (currentSongToAdd) {
            newPlaylist.songs.push({ ...currentSongToAdd, addedAt: Date.now() });
        }
        
        allPlaylists.push(newPlaylist);
        
        // Save to server
        try {
            await api.savePlaylists(allPlaylists);
            // Update select and select new playlist
            updatePlaylistSelect();
            document.getElementById('playlistSelect').value = newPlaylist.id;
            document.getElementById('newPlaylistForm').style.display = 'none';
            document.getElementById('newPlaylistName').value = '';
        } catch (error) {
            console.error('Error saving new playlist:', error);
            alert('Error saving playlist');
        }
    });
    
    document.getElementById('confirmAddBtn').addEventListener('click', async function() {
        const selectedPlaylistId = document.getElementById('playlistSelect').value;
        if (!selectedPlaylistId && !document.getElementById('newPlaylistForm').style.display === 'block') {
            alert('Please select a playlist or create a new one');
            return;
        }
        
        if (currentSongToAdd) {
            if (selectedPlaylistId) {
                try {
                    // Use the new API endpoint to add item
                    await api.addItemToPlaylist(selectedPlaylistId, currentSongToAdd);
                    const playlist = allPlaylists.find(p => p.id === selectedPlaylistId);
                    // Show toast notification
                    showToast('Saved', `Song added to playlist "${playlist ? playlist.name : ''}"`, selectedPlaylistId);
                } catch (error) {
                    console.error('Error adding item to playlist:', error);
                    if (error.message.includes('already exists')) {
                        showToast('Error', 'Song already exists in playlist', null);
                    } else {
                        showToast('Error', 'Error adding song to playlist: ' + error.message, null);
                    }
                }
            }
            playlistModal.hide();
            currentSongToAdd = null;
            // Reload playlists and refresh search results
            await loadPlaylists();
            performSearch();
        }
    });
    
    function displayWelcomeMessage() {
        const currentUser = getCurrentUser();
        if (currentUser) {
            document.getElementById('welcomeCard').style.display = 'block';
            document.getElementById('welcomeUsername').textContent = currentUser.firstName;
            const imageUrl = currentUser.imageUrl || 'https://via.placeholder.com/60';
            document.getElementById('welcomeUserImage').src = imageUrl;
        }
    }
    
    async function performSearch() {
        const query = searchInput.value.trim();
        if (!query) {
            showAlert('Please enter a search term', 'warning');
            return;
        }
        
        // Update URL with search query
        const newUrl = new URL(window.location);
        newUrl.searchParams.set('q', query);
        window.history.pushState({}, '', newUrl);
        
        searchResults.innerHTML = '<div class="col-12 text-center"><div class="spinner-border" role="status"></div></div>';
        
        // Call server API endpoint for YouTube search
        try {
            const response = await api.searchYouTube(query);
            displayResults(response.items || []);
        } catch (error) {
            console.error('Search error:', error);
            const errorMessage = error.message || 'Search error. Please try again later.';
            
            // Show detailed error message
            let displayMessage = 'Search Error';
            if (errorMessage.includes('API key not configured')) {
                displayMessage = 'YouTube API key is not configured. Please contact the administrator or check YOUTUBE_API_SETUP.md for setup instructions.';
            } else if (errorMessage.includes('quota exceeded')) {
                displayMessage = 'YouTube API quota exceeded. Please try again later.';
            } else if (errorMessage.includes('invalid')) {
                displayMessage = 'YouTube API key is invalid. Please contact the administrator.';
            } else {
                displayMessage = errorMessage;
            }
            
            showAlert(displayMessage, 'warning');
            searchResults.innerHTML = `
                <div class="col-12">
                    <div class="alert alert-warning text-center">
                        <i class="bi bi-exclamation-triangle"></i> ${displayMessage}
                    </div>
                </div>
            `;
        }
    }
    
    
    function displayResults(results) {
        if (results.length === 0) {
            searchResults.innerHTML = `
                <div class="col-12">
                    <div class="alert alert-info text-center">
                        <i class="bi bi-info-circle"></i> No results found
                    </div>
                </div>
            `;
            return;
        }
        
        // Get all songs from all playlists to check if already in favorites
        const allSongs = [];
        allPlaylists.forEach(playlist => {
            playlist.songs.forEach(song => {
                if (song.videoId && !allSongs.some(s => s.videoId === song.videoId)) {
                    allSongs.push(song);
                }
            });
        });
        
        searchResults.innerHTML = results.map(video => {
            const isInPlaylist = allSongs.some(s => s.videoId === video.videoId);
            const titleClass = video.title.length > 50 ? 'card-title-ellipsis' : '';
            const titleTooltip = video.title.length > 50 ? `title="${video.title}"` : '';
            
            return `
                <div class="col-md-4 col-lg-3 mb-4">
                    <div class="card h-100 shadow-sm">
                        <div class="position-relative">
                            <img src="${video.thumbnail}" class="card-img-top" alt="${video.title}" 
                                 style="height: 180px; object-fit: cover; cursor: pointer;"
                                 onclick="playVideo('${video.videoId}', '${video.title.replace(/'/g, "\\'")}', '${video.channelTitle.replace(/'/g, "\\'")}')"
                                 onerror="this.src='https://via.placeholder.com/320x180'">
                            ${isInPlaylist ? '<span class="badge bg-success position-absolute top-0 end-0 m-2"><i class="bi bi-check-circle-fill"></i></span>' : ''}
                            <span class="badge bg-dark position-absolute bottom-0 end-0 m-2">${video.duration || 'N/A'}</span>
                        </div>
                        <div class="card-body">
                            <h6 class="card-title ${titleClass}" ${titleTooltip} style="display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; cursor: pointer;" 
                                onclick="playVideo('${video.videoId}', '${video.title.replace(/'/g, "\\'")}', '${video.channelTitle.replace(/'/g, "\\'")}')">
                                ${video.title}
                            </h6>
                            <p class="card-text text-muted small mb-1">${video.channelTitle}</p>
                            <p class="card-text"><small class="text-muted"><i class="bi bi-eye"></i> ${video.viewCount ? video.viewCount + ' views' : 'N/A'}</small></p>
                        </div>
                        <div class="card-footer bg-white">
                            <div class="btn-group w-100" role="group">
                                <button class="btn btn-sm btn-primary" onclick="playVideo('${video.videoId}', '${video.title.replace(/'/g, "\\'")}', '${video.channelTitle.replace(/'/g, "\\'")}')">
                                    <i class="bi bi-play-circle"></i> Play
                                </button>
                                <button class="btn btn-sm ${isInPlaylist ? 'btn-secondary' : 'btn-outline-primary'}" 
                                        onclick="addToPlaylist('${video.videoId}', '${video.title.replace(/'/g, "\\'")}', '${video.channelTitle.replace(/'/g, "\\'")}', '${video.thumbnail.replace(/'/g, "\\'")}', '${video.duration || ''}', '${video.viewCount || ''}')"
                                        ${isInPlaylist ? 'disabled' : ''}>
                                    <i class="bi ${isInPlaylist ? 'bi-check-circle' : 'bi-plus-circle'}"></i> ${isInPlaylist ? 'In Playlist' : 'Add'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    }
    
    // Global functions
    window.playVideo = function(videoId, title, channelTitle) {
        document.getElementById('playerTitle').textContent = title;
        document.getElementById('playerTrackName').textContent = title;
        document.getElementById('playerArtistName').textContent = channelTitle;
        document.getElementById('youtubePlayer').src = `https://www.youtube.com/embed/${videoId}?autoplay=1`;
        playerModal.show();
    };
    
    window.addToPlaylist = function(videoId, title, channelTitle, thumbnail, duration, viewCount) {
        currentSongToAdd = {
            videoId: videoId,
            title: title,
            channelTitle: channelTitle,
            thumbnail: thumbnail,
            duration: duration,
            viewCount: viewCount,
            rating: 0
        };
        
        updatePlaylistSelect();
        playlistModal.show();
    };
    
    function updatePlaylistSelect() {
        const select = document.getElementById('playlistSelect');
        
        select.innerHTML = '<option value="">-- Select Playlist --</option>';
        allPlaylists.forEach(playlist => {
            const option = document.createElement('option');
            option.value = playlist.id;
            option.textContent = playlist.name;
            select.appendChild(option);
        });
    }
    
    function showToast(title, message, playlistId) {
        const toastElement = document.getElementById('toastNotification');
        const toastBody = document.getElementById('toastBody');
        let linkHtml = '';
        if (playlistId) {
            linkHtml = ` <a href="playlists.html?playlist=${playlistId}" class="alert-link">Go to Playlist</a>`;
        }
        toastBody.innerHTML = `${message}${linkHtml}`;
        
        const toast = new bootstrap.Toast(toastElement, {
            autohide: true,
            delay: 5000
        });
        toast.show();
    }
    
    function showAlert(message, type) {
        const alertDiv = document.createElement('div');
        alertDiv.className = `alert alert-${type} alert-dismissible fade show position-fixed top-0 start-50 translate-middle-x mt-3`;
        alertDiv.style.zIndex = '9999';
        alertDiv.innerHTML = `
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        `;
        document.body.appendChild(alertDiv);
        
        setTimeout(() => {
            alertDiv.remove();
        }, 3000);
    }
});
