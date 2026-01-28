// Playlists page functionality with sidebar and main content - using API

document.addEventListener('DOMContentLoaded', async function() {
    // Server handles authentication - if not logged in, will redirect to /login
    
    const playlistsList = document.getElementById('playlistsList');
    const playlistContent = document.getElementById('playlistContent');
    const currentPlaylistName = document.getElementById('currentPlaylistName');
    const newPlaylistModal = new bootstrap.Modal(document.getElementById('newPlaylistModal'));
    const playerModal = new bootstrap.Modal(document.getElementById('playerModal'));
    const toastElement = document.getElementById('playlistToast');
    const toastBody = document.getElementById('playlistToastBody');
    
    // Stop Play All when modal is closed
    const playerModalElement = document.getElementById('playerModal');
    if (playerModalElement) {
        playerModalElement.addEventListener('hidden.bs.modal', function() {
            if (playAllMode) {
                // Stop Play All mode when user closes the modal
                playAllMode = false;
                currentPlayAllIndex = -1;
                playAllSongs = [];
                
                // Stop any playing media
                const audioPlayerEl = document.getElementById('audioPlayer');
                if (audioPlayerEl) {
                    audioPlayerEl.pause();
                    audioPlayerEl.src = '';
                }
                
                if (youtubePlayerAPI) {
                    try {
                        youtubePlayerAPI.stopVideo();
                    } catch (e) {
                        console.log('Error stopping YouTube player:', e);
                    }
                }
            }
        });
    }
    
    let currentPlaylistId = null;
    let currentSongs = [];
    let allPlaylists = [];
    
    // Play All mode variables
    let playAllMode = false;
    let currentPlayAllIndex = -1;
    let playAllSongs = [];
    let youtubePlayerAPI = null;
    
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
        
        // Get username from server session (will be handled by server)
        const newPlaylist = {
            id: Date.now().toString(),
            userId: '', // Will be set by server
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
                startPlayAll();
            } else {
                alert('No songs in playlist');
            }
        });
    } else {
        console.error('playAllBtn not found');
    }
    
    function startPlayAll() {
        playAllMode = true;
        playAllSongs = [...currentSongs];
        currentPlayAllIndex = 0;
        playSongAtIndex(0);
    }
    
    function playSongAtIndex(index) {
        if (index < 0 || index >= playAllSongs.length) {
            // Finished playing all songs
            playAllMode = false;
            currentPlayAllIndex = -1;
            playAllSongs = [];
            showToast('Finished playing all songs', 'success');
            return;
        }
        
        currentPlayAllIndex = index;
        const song = playAllSongs[index];
        
        if (song.type === 'mp3') {
            playMP3(song, true);
        } else {
            playVideo(song.videoId, song.title, song.channelTitle, true);
        }
    }
    
    function playNextSong() {
        if (playAllMode && currentPlayAllIndex >= 0) {
            const nextIndex = currentPlayAllIndex + 1;
            if (nextIndex < playAllSongs.length) {
                setTimeout(() => {
                    playSongAtIndex(nextIndex);
                }, 500); // Small delay before next song
            } else {
                // Finished all songs
                playAllMode = false;
                currentPlayAllIndex = -1;
                playAllSongs = [];
                showToast('Finished playing all songs', 'success');
            }
        }
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
    
    function playVideo(videoId, title, channelTitle, isPlayAll = false) {
        console.log('playVideo called:', { videoId, title, channelTitle, isPlayAll });
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
        
        // Load YouTube IFrame API if not already loaded
        if (!window.YT) {
            const tag = document.createElement('script');
            tag.src = 'https://www.youtube.com/iframe_api';
            const firstScriptTag = document.getElementsByTagName('script')[0];
            firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
            
            window.onYouTubeIframeAPIReady = function() {
                initYouTubePlayer(videoId, isPlayAll);
            };
        } else {
            initYouTubePlayer(videoId, isPlayAll);
        }
        
        if (audioPlayerEl) {
            audioPlayerEl.style.display = 'none';
        }
        youtubePlayerEl.style.display = 'block';
        playerModal.show();
    }
    
    function initYouTubePlayer(videoId, isPlayAll) {
        const videoPlayerContainer = document.getElementById('videoPlayerContainer');
        const youtubePlayerEl = document.getElementById('youtubePlayer');
        
        if (!videoPlayerContainer) {
            console.error('Video player container not found');
            return;
        }
        
        // Destroy existing player if it exists
        if (youtubePlayerAPI) {
            try {
                youtubePlayerAPI.destroy();
            } catch (e) {
                console.log('Error destroying existing player:', e);
            }
            youtubePlayerAPI = null;
        }
        
        // Replace iframe with div for YouTube API
        if (youtubePlayerEl && youtubePlayerEl.tagName === 'IFRAME') {
            const newDiv = document.createElement('div');
            newDiv.id = 'youtubePlayer';
            newDiv.style.width = '100%';
            newDiv.style.height = '500px';
            youtubePlayerEl.parentNode.replaceChild(newDiv, youtubePlayerEl);
        }
        
        // Create new player
        youtubePlayerAPI = new YT.Player('youtubePlayer', {
            videoId: videoId,
            playerVars: {
                autoplay: 1,
                controls: 1,
                rel: 0
            },
            events: {
                'onReady': function(event) {
                    console.log('YouTube player ready');
                },
                'onStateChange': function(event) {
                    // YT.PlayerState.ENDED = 0
                    if (event.data === YT.PlayerState.ENDED) {
                        console.log('YouTube video ended');
                        if (isPlayAll || playAllMode) {
                            playNextSong();
                        }
                    }
                },
                'onError': function(event) {
                    console.error('YouTube player error:', event.data);
                    if (isPlayAll || playAllMode) {
                        // Skip to next song on error
                        playNextSong();
                    }
                }
            }
        });
    }
    
    function playMP3(song, isPlayAll = false) {
        console.log('playMP3 called:', song, isPlayAll);
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
        
        // Remove previous event listener if exists
        audioPlayerEl.removeEventListener('ended', handleAudioEnded);
        
        // Add event listener for when audio ends
        if (isPlayAll || playAllMode) {
            audioPlayerEl.addEventListener('ended', handleAudioEnded);
        }
        
        audioPlayerEl.src = song.fileUrl;
        audioPlayerEl.style.display = 'block';
        playerModal.show();
        
        // Play the audio
        audioPlayerEl.play().catch(err => {
            console.error('Error playing audio:', err);
            if (isPlayAll || playAllMode) {
                playNextSong();
            }
        });
    }
    
    function handleAudioEnded() {
        console.log('MP3 audio ended');
        if (playAllMode) {
            playNextSong();
        }
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
