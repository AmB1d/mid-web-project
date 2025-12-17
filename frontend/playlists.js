// Playlists page functionality with sidebar and main content - using API

document.addEventListener('DOMContentLoaded', async function() {
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
    
    const playlistsList = document.getElementById('playlistsList');
    const playlistContent = document.getElementById('playlistContent');
    const currentPlaylistName = document.getElementById('currentPlaylistName');
    const newPlaylistModal = new bootstrap.Modal(document.getElementById('newPlaylistModal'));
    const playerModal = new bootstrap.Modal(document.getElementById('playerModal'));
    const toastElement = document.getElementById('playlistToast');
    const toastBody = document.getElementById('playlistToastBody');
    
    let currentPlaylistId = null;
    let currentSongs = [];
    let allPlaylists = [];
    
    // Check URL for playlist ID
    const urlParams = new URLSearchParams(window.location.search);
    const playlistIdFromUrl = urlParams.get('playlist');
    
    // Load playlists from server
    await loadPlaylists();
    
    // If playlist ID in URL, load it
    if (playlistIdFromUrl) {
        selectPlaylist(playlistIdFromUrl);
    } else {
        // Load first playlist by default
        if (allPlaylists.length > 0) {
            selectPlaylist(allPlaylists[0].id);
        }
    }
    
    // New Playlist button
    const newPlaylistBtn = document.getElementById('newPlaylistBtn');
    if (newPlaylistBtn) {
        newPlaylistBtn.addEventListener('click', function(e) {
            e.preventDefault();
            console.log('New Playlist button clicked');
            document.getElementById('newPlaylistNameInput').value = '';
            newPlaylistModal.show();
        });
    } else {
        console.error('newPlaylistBtn not found');
    }
    
    // Create Playlist button
    document.getElementById('createPlaylistBtn').addEventListener('click', async function() {
        const playlistName = document.getElementById('newPlaylistNameInput').value.trim();
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
        
        allPlaylists.push(newPlaylist);
        await savePlaylists();
        
        newPlaylistModal.hide();
        await loadPlaylists();
        selectPlaylist(newPlaylist.id);
        
        // Update URL
        const newUrl = new URL(window.location);
        newUrl.searchParams.set('playlist', newPlaylist.id);
        window.history.pushState({}, '', newUrl);
    });
    
    // Play All button
    const playAllBtn = document.getElementById('playAllBtn');
    if (playAllBtn) {
        playAllBtn.addEventListener('click', function(e) {
            e.preventDefault();
            console.log('Play All button clicked, currentSongs:', currentSongs.length);
            if (currentSongs.length > 0) {
                const firstSong = currentSongs[0];
                console.log('Playing first song:', firstSong);
                if (firstSong.type === 'mp3') {
                    playMP3(firstSong);
                } else {
                    playVideo(firstSong.videoId, firstSong.title, firstSong.channelTitle);
                }
            } else {
                alert('No songs in playlist');
            }
        });
    } else {
        console.error('playAllBtn not found');
    }
    
    // Internal search
    document.getElementById('internalSearch').addEventListener('input', function(e) {
        filterSongs(e.target.value);
    });
    
    // Sort buttons
    document.getElementById('sortAlphaBtn').addEventListener('click', function() {
        sortSongs('alphabetical');
    });
    
    document.getElementById('sortRatingBtn').addEventListener('click', function() {
        sortSongs('rating');
    });

    document.getElementById('sortDateBtn').addEventListener('click', function() {
        sortSongs('date');
    });
    
    async function loadPlaylists() {
        try {
            const data = await api.getPlaylists();
            allPlaylists = data.playlists || [];
            displayPlaylistsList();
        } catch (error) {
            console.error('Error loading playlists:', error);
            allPlaylists = [];
            displayPlaylistsList();
        }
    }
    
    async function savePlaylists() {
        try {
            await api.savePlaylists(allPlaylists);
        } catch (error) {
            console.error('Error saving playlists:', error);
            alert('Error saving playlists');
        }
    }
    
    function displayPlaylistsList() {
        if (allPlaylists.length === 0) {
            playlistsList.innerHTML = `
                <div class="alert alert-info">
                    <small>No playlists. Create a new playlist!</small>
                </div>
            `;
            return;
        }
        
        playlistsList.innerHTML = allPlaylists.map(playlist => `
            <div class="list-group-item ${currentPlaylistId === playlist.id ? 'active' : ''}">
                <div class="d-flex justify-content-between align-items-center">
                    <a href="#" class="text-decoration-none flex-grow-1 playlist-link ${currentPlaylistId === playlist.id ? 'text-white' : ''}" 
                       data-playlist-id="${playlist.id}">
                        <i class="bi bi-music-note-list"></i> ${playlist.name}
                    </a>
                    <div class="d-flex align-items-center gap-2">
                        <span class="badge bg-primary rounded-pill">${playlist.songs.length}</span>
                        <button class="btn btn-sm btn-outline-danger delete-playlist-btn" 
                                data-playlist-id="${playlist.id}"
                                title="Delete Playlist">
                            <i class="bi bi-trash"></i>
                        </button>
                    </div>
                </div>
            </div>
        `).join('');
        
        // Add event listeners using event delegation
        playlistsList.querySelectorAll('.playlist-link').forEach(link => {
            link.addEventListener('click', function(e) {
                e.preventDefault();
                const playlistId = this.getAttribute('data-playlist-id');
                if (playlistId) {
                    selectPlaylist(playlistId);
                }
            });
        });
        
        playlistsList.querySelectorAll('.delete-playlist-btn').forEach(btn => {
            btn.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                const playlistId = this.getAttribute('data-playlist-id');
                if (playlistId) {
                    deletePlaylist(playlistId);
                }
            });
        });
    }
    
    function selectPlaylist(playlistId) {
        currentPlaylistId = playlistId;
        const playlist = allPlaylists.find(p => p.id === playlistId);
        
        if (!playlist) {
            playlistContent.innerHTML = `
                <div class="alert alert-danger text-center">
                    <i class="bi bi-exclamation-triangle"></i> Playlist not found
                </div>
            `;
            return;
        }
        
        currentPlaylistName.textContent = playlist.name;
        currentSongs = normalizeSongs([...playlist.songs]);
        displaySongs(currentSongs);
        
        // Update URL
        const newUrl = new URL(window.location);
        newUrl.searchParams.set('playlist', playlistId);
        window.history.pushState({}, '', newUrl);
        
        // Reload playlist list to update active state
        displayPlaylistsList();
    }
    
    // Make selectPlaylist available globally for backwards compatibility
    window.selectPlaylist = selectPlaylist;
    
    function displaySongs(songs) {
        if (songs.length === 0) {
            playlistContent.innerHTML = `
                <div class="alert alert-info text-center">
                    <i class="bi bi-info-circle"></i> No songs in this playlist
                </div>
            `;
            return;
        }
        
        playlistContent.innerHTML = `
            <div class="table-responsive">
                <table class="table table-hover">
                    <thead>
                        <tr>
                            <th style="width: 60px;">Image</th>
                            <th>Song Name</th>
                            <th>Artist</th>
                            <th>Type</th>
                            <th>Duration</th>
                            <th>Views</th>
                            <th>Rating</th>
                            <th style="width: 200px;">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${songs.map((song, index) => {
                            const songData = JSON.stringify(song).replace(/"/g, '&quot;');
                            const videoId = song.videoId || '';
                            const title = (song.title || '').replace(/'/g, "\\'").replace(/"/g, '&quot;');
                            const channelTitle = (song.channelTitle || '').replace(/'/g, "\\'").replace(/"/g, '&quot;');
                            
                            return `
                            <tr data-song-index="${index}">
                                <td>
                                    <img src="${song.thumbnail || (song.type === 'mp3' ? '/uploads/default-music.png' : '')}" alt="${song.title}" 
                                         class="img-thumbnail song-thumbnail" 
                                         style="width: 60px; height: 60px; object-fit: cover; cursor: pointer;"
                                         data-song-index="${index}"
                                         onerror="this.src='https://via.placeholder.com/60'">
                                </td>
                                <td>
                                    <a href="#" class="text-decoration-none song-title-link" data-song-index="${index}">${song.title}</a>
                                </td>
                                <td>${song.channelTitle || 'Unknown'}</td>
                                <td><span class="badge ${song.type === 'mp3' ? 'bg-success' : 'bg-primary'}">${song.type === 'mp3' ? 'MP3' : 'YouTube'}</span></td>
                                <td>${song.duration || 'N/A'}</td>
                                <td>${song.viewCount || 'N/A'}</td>
                                <td>
                                    <div class="rating" data-song-index="${index}">
                                        ${generateRatingStars(song.rating || 0, index)}
                                    </div>
                                </td>
                                <td>
                                    <button class="btn btn-sm btn-primary play-song-btn" data-song-index="${index}">
                                        <i class="bi bi-play-circle"></i>
                                    </button>
                                    <button class="btn btn-sm btn-danger delete-song-btn" data-song-index="${index}">
                                        <i class="bi bi-trash"></i>
                                    </button>
                                </td>
                            </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>
            </div>
        `;
        
        // Add event listeners using event delegation
        playlistContent.querySelectorAll('.song-thumbnail, .song-title-link').forEach(el => {
            el.addEventListener('click', function(e) {
                e.preventDefault();
                const index = parseInt(this.getAttribute('data-song-index'));
                if (index !== null && currentSongs[index]) {
                    const song = currentSongs[index];
                    if (song.type === 'mp3') {
                        playMP3(song);
                    } else {
                        playVideo(song.videoId, song.title, song.channelTitle);
                    }
                }
            });
        });
        
        playlistContent.querySelectorAll('.play-song-btn').forEach(btn => {
            btn.addEventListener('click', function(e) {
                e.preventDefault();
                const index = parseInt(this.getAttribute('data-song-index'));
                if (index !== null && currentSongs[index]) {
                    const song = currentSongs[index];
                    if (song.type === 'mp3') {
                        playMP3(song);
                    } else {
                        playVideo(song.videoId, song.title, song.channelTitle);
                    }
                }
            });
        });
        
        playlistContent.querySelectorAll('.delete-song-btn').forEach(btn => {
            btn.addEventListener('click', function(e) {
                e.preventDefault();
                const index = parseInt(this.getAttribute('data-song-index'));
                if (index !== null) {
                    deleteSong(index);
                }
            });
        });
        
        playlistContent.querySelectorAll('.rating i').forEach(star => {
            star.addEventListener('click', function(e) {
                const rating = parseInt(this.getAttribute('data-rating'));
                const index = parseInt(this.closest('.rating').getAttribute('data-song-index'));
                if (rating !== null && index !== null) {
                    setRating(index, rating);
                }
            });
        });
    }
    
    function generateRatingStars(rating, index) {
        let stars = '';
        for (let i = 1; i <= 5; i++) {
            if (i <= rating) {
                stars += `<i class="bi bi-star-fill text-warning" style="cursor: pointer;" data-rating="${i}"></i>`;
            } else {
                stars += `<i class="bi bi-star text-warning" style="cursor: pointer;" data-rating="${i}"></i>`;
            }
        }
        return stars;
    }
    
    async function setRating(index, rating) {
        if (currentPlaylistId && currentSongs[index]) {
            currentSongs[index].rating = rating;
            
            // Update in allPlaylists
            const playlist = allPlaylists.find(p => p.id === currentPlaylistId);
            if (playlist) {
                playlist.songs = currentSongs;
                await savePlaylists();
            }
            
            // Refresh display
            displaySongs(currentSongs);
        }
    }
    
    // Make setRating available globally
    window.setRating = setRating;
    
    async function deleteSong(index) {
        if (confirm('Are you sure you want to delete this song?')) {
            if (currentPlaylistId && currentSongs[index]) {
                const song = currentSongs[index];
                const videoId = song.videoId || song.id;
                
                if (!videoId) {
                    console.error('Cannot delete song: no videoId or id found', song);
                    showToast('Error: Cannot identify song to delete', 'danger');
                    return;
                }
                
                try {
                    console.log('Deleting song:', { playlistId: currentPlaylistId, videoId, index });
                    // Use the new API endpoint to delete item
                    await api.deleteItemFromPlaylist(currentPlaylistId, videoId);
                    
                    // Remove from local array
                    currentSongs.splice(index, 1);
                    
                    // Update in allPlaylists
                    const playlist = allPlaylists.find(p => p.id === currentPlaylistId);
                    if (playlist) {
                        playlist.songs = currentSongs;
                    }
                    
                    // Show toast notification
                    showToast('Song deleted successfully', 'success');
                    
                    // Refresh display
                    displaySongs(currentSongs);
                    displayPlaylistsList();
                } catch (error) {
                    console.error('Error deleting song:', error);
                    showToast('Error deleting song: ' + error.message, 'danger');
                }
            }
        }
    }
    
    // Make deleteSong available globally
    window.deleteSong = deleteSong;
    
    function filterSongs(query) {
        const filtered = currentSongs.filter(song => 
            song.title.toLowerCase().includes(query.toLowerCase()) ||
            (song.channelTitle && song.channelTitle.toLowerCase().includes(query.toLowerCase()))
        );
        displaySongs(filtered);
    }
    
    function sortSongs(sortBy) {
        const sorted = [...currentSongs];
        
        if (sortBy === 'alphabetical') {
            sorted.sort((a, b) => a.title.localeCompare(b.title, 'he'));
        } else if (sortBy === 'rating') {
            sorted.sort((a, b) => (b.rating || 0) - (a.rating || 0));
        } else if (sortBy === 'date') {
            sorted.sort((a, b) => (b.addedAt || b.uploadedAt || 0) - (a.addedAt || a.uploadedAt || 0));
        }
        
        displaySongs(sorted);
    }
    
    function playVideo(videoId, title, channelTitle) {
        console.log('playVideo called:', { videoId, title, channelTitle });
        const playerTitleEl = document.getElementById('playerTitle');
        const playerTrackNameEl = document.getElementById('playerTrackName');
        const playerArtistNameEl = document.getElementById('playerArtistName');
        const youtubePlayerEl = document.getElementById('youtubePlayer');
        const audioPlayerEl = document.getElementById('audioPlayer');
        
        if (!playerTitleEl || !playerTrackNameEl || !youtubePlayerEl) {
            console.error('Player elements not found');
            return;
        }
        
        playerTitleEl.textContent = title;
        playerTrackNameEl.textContent = title;
        if (playerArtistNameEl) {
            playerArtistNameEl.textContent = channelTitle;
        }
        youtubePlayerEl.src = `https://www.youtube.com/embed/${videoId}?autoplay=1`;
        if (audioPlayerEl) {
            audioPlayerEl.style.display = 'none';
        }
        youtubePlayerEl.style.display = 'block';
        playerModal.show();
    }
    
    function playMP3(song) {
        console.log('playMP3 called:', song);
        const playerTitleEl = document.getElementById('playerTitle');
        const playerTrackNameEl = document.getElementById('playerTrackName');
        const playerArtistNameEl = document.getElementById('playerArtistName');
        const youtubePlayerEl = document.getElementById('youtubePlayer');
        const audioPlayerEl = document.getElementById('audioPlayer');
        
        if (!playerTitleEl || !playerTrackNameEl || !audioPlayerEl) {
            console.error('Player elements not found');
            return;
        }
        
        playerTitleEl.textContent = song.title;
        playerTrackNameEl.textContent = song.title;
        if (playerArtistNameEl) {
            playerArtistNameEl.textContent = song.channelTitle || 'Unknown Artist';
        }
        if (youtubePlayerEl) {
            youtubePlayerEl.style.display = 'none';
        }
        audioPlayerEl.src = song.fileUrl;
        audioPlayerEl.style.display = 'block';
        playerModal.show();
    }
    
    // Make functions available globally
    window.playVideo = playVideo;
    window.playMP3 = playMP3;
    
    // Delete playlist functionality
    async function deletePlaylist(playlistId) {
        if (confirm('Are you sure you want to delete this playlist? All songs will be deleted.')) {
            try {
                await api.deletePlaylist(playlistId);
                
                // Show toast notification
                showToast('Playlist deleted successfully', 'success');
                
                if (currentPlaylistId === playlistId) {
                    currentPlaylistId = null;
                    currentSongs = [];
                    currentPlaylistName.textContent = 'Select a playlist from the list';
                    playlistContent.innerHTML = `
                        <div class="alert alert-info text-center">
                            <i class="bi bi-info-circle"></i> Select a playlist from the list
                        </div>
                    `;
                }
                
                await loadPlaylists();
                
                // Load first playlist if available
                if (allPlaylists.length > 0) {
                    selectPlaylist(allPlaylists[0].id);
                }
            } catch (error) {
                console.error('Error deleting playlist:', error);
                showToast('Error deleting playlist: ' + error.message, 'danger');
            }
        }
    }
    
    // Make deletePlaylist available globally for backwards compatibility
    window.deletePlaylist = deletePlaylist;
    
    function showToast(message, type) {
        let toastContainer = document.getElementById('toastContainer');
        if (!toastContainer) {
            toastContainer = document.createElement('div');
            toastContainer.id = 'toastContainer';
            toastContainer.className = 'toast-container position-fixed top-0 end-0 p-3';
            toastContainer.style.zIndex = '11000';
            document.body.appendChild(toastContainer);
        }
        
        const toastId = 'toast-' + Date.now();
        const toast = document.createElement('div');
        toast.id = toastId;
        toast.className = `toast align-items-center text-white bg-${type} border-0`;
        toast.setAttribute('role', 'alert');
        toast.innerHTML = `
            <div class="d-flex">
                <div class="toast-body">${message}</div>
                <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button>
            </div>
        `;
        toastContainer.appendChild(toast);
        const bsToast = new bootstrap.Toast(toast);
        bsToast.show();
        
        toast.addEventListener('hidden.bs.toast', () => {
            toast.remove();
        });
    }

    function normalizeSongs(songs) {
        return songs.map(song => ({
            ...song,
            addedAt: song.addedAt || song.uploadedAt || Date.now()
        }));
    }
});
