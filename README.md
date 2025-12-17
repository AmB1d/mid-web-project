# 🎵 MID Web Project - Music Playlist Management System

A modern, full-stack web application for music discovery, playlist management, and user authentication. Built with Node.js, Express, and vanilla JavaScript with Bootstrap.

![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)
![License](https://img.shields.io/badge/license-ISC-green.svg)
![Node](https://img.shields.io/badge/node-%3E%3D14.0.0-brightgreen.svg)

## 📋 Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Technologies](#technologies)
- [Installation](#installation)
- [Configuration](#configuration)
- [Usage](#usage)
- [Project Structure](#project-structure)
- [API Documentation](#api-documentation)
- [Screenshots](#screenshots)
- [Troubleshooting](#troubleshooting)
- [Contributing](#contributing)
- [License](#license)

## 🎯 Overview

MID Web Project is a comprehensive music playlist management system that allows users to:
- **Search** for music videos using YouTube Data API
- **Create and manage** personalized playlists
- **Upload** MP3 files to their playlists
- **Rate and organize** songs with advanced sorting and filtering
- **Secure authentication** with JWT tokens and password encryption

The application features a modern dark theme UI with smooth animations and responsive design, built entirely with vanilla JavaScript and Bootstrap 5.

## ✨ Features

### 🔐 Authentication & User Management
- **User Registration** with comprehensive validation
  - Username uniqueness check
  - Strong password requirements (min 6 chars, letter, number, special character)
  - Optional profile image URL
  - Real-time form validation with error messages
- **Secure Login** with JWT token-based authentication
- **Session Management** with automatic token verification
- **Password Encryption** using bcrypt (10 rounds)
- **User Profile** display in header with profile image

### 🎵 Music Search & Discovery
- **YouTube Integration** via YouTube Data API v3
- **Real-time Search** with query string synchronization
- **Rich Results Display**:
  - Video thumbnails
  - Title and channel information
  - View count (formatted: 1.2M, 123.5K, etc.)
  - Video duration
  - Play button for instant preview
- **Add to Playlist** functionality with modal selection
- **Duplicate Detection** - prevents adding same song twice

### 📋 Playlist Management
- **Create Multiple Playlists** - unlimited playlists per user
- **Sidebar Navigation** - easy playlist switching
- **Song Management**:
  - Add songs from search results
  - Delete individual songs
  - Delete entire playlists
  - Rate songs (1-5 stars)
- **Advanced Sorting**:
  - Alphabetical (A-Z)
  - By rating (highest first)
  - By date added (newest first)
- **Internal Search** - filter songs within a playlist
- **Play All** - start playing from first song
- **Visual Indicators** - shows which songs are already in playlists

### 🎧 Media Playback
- **YouTube Video Player** - embedded iframe player
- **MP3 Audio Player** - HTML5 audio for uploaded files
- **Modal Player** - full-screen playback experience
- **Track Information** - displays title and artist

### 📤 File Upload
- **MP3 Upload** support (up to 10MB)
- **Automatic Playlist Integration** - uploaded files added to playlists
- **File Management** - organized storage in `server/uploads/`

### 🎨 User Interface
- **Modern Dark Theme** - sleek black design with gradient accents
- **Responsive Design** - works on desktop, tablet, and mobile
- **Smooth Animations** - hover effects, transitions, and loading states
- **Toast Notifications** - user feedback for all actions
- **Bootstrap 5** - modern components and utilities
- **Custom Styling** - professional gradient effects and shadows

## 🛠️ Technologies

### Backend
- **Node.js** (v14+) - JavaScript runtime
- **Express.js** - Web application framework
- **bcryptjs** - Password hashing
- **jsonwebtoken** - JWT authentication
- **multer** - File upload handling
- **dotenv** - Environment variable management
- **CORS** - Cross-origin resource sharing

### Frontend
- **HTML5** - Semantic markup
- **CSS3** - Custom dark theme with advanced styling
- **Vanilla JavaScript** - No frameworks, pure JS
- **Bootstrap 5.3.2** - UI components and grid system
- **Bootstrap Icons** - Icon library
- **Google Fonts (Inter)** - Modern typography

### APIs & Services
- **YouTube Data API v3** - Music video search and metadata
- **RESTful API** - Custom backend endpoints

## 📦 Installation

### Prerequisites
- **Node.js** 14.0.0 or higher
- **npm** (comes with Node.js) or **yarn**
- **Git** (for cloning the repository)


**API Quota**: Free tier provides 10,000 units/day (~100 searches/day)


### Using the Application

#### Search for Music
1. On the search page, enter a song name, artist, or album
2. Click "Search" or press Enter
3. Browse results with thumbnails, view counts, and durations
4. Click "Add" to add songs to playlists
5. Select an existing playlist or create a new one

#### Manage Playlists
1. Navigate to "Playlists" from the menu
2. Click "New Playlist" to create one
3. Select a playlist from the sidebar to view songs
4. Use sorting buttons (A-Z, Rating, Date) to organize
5. Use internal search to filter songs
6. Click stars to rate songs (1-5)
7. Click trash icon to delete songs or playlists

#### Upload MP3 Files
1. Go to Playlists page
2. Select a playlist from sidebar
3. Click "Choose File" under "Upload MP3 File"
4. Select an MP3 file (max 10MB)
5. Click "Upload"
6. The file will be added to your playlist

## 📁 Project Structure

```
MID-WEB-PROJECT/
├── server/                      # Backend server
│   ├── server.js               # Main Express server & API routes
│   ├── package.json            # Server dependencies
│   ├── .env                    # Environment variables 
│   ├── data/                   # Data storage
│   │   ├── users.json          # User accounts (auto-generated)
│   │   └── playlists/          # User playlists
│   │       └── {username}.json # One file per user
│   └── uploads/                # Uploaded MP3 files
│
├── frontend/                    # Frontend client
│   ├── index.html              # Home page
│   ├── register.html           # Registration page
│   ├── login.html              # Login page
│   ├── search.html             # Music search page
│   ├── playlists.html          # Playlist management page
│   ├── api.js                  # API communication utilities
│   ├── auth.js                 # Authentication utilities
│   ├── register.js             # Registration logic
│   ├── login.js                # Login logic
│   ├── search.js               # Search functionality
│   ├── playlists.js            # Playlist management logic
│   └── styles.css              # Custom dark theme styles
│
├── .gitignore                   # Git ignore rules
└── README.md                    # This file
```

## 🔌 API Documentation

### Authentication Endpoints

#### `POST /api/auth/register`
Register a new user account.

**Request Body:**
```json
{
  "username": "string (required, unique)",
  "password": "string (required, min 6 chars)",
  "firstName": "string (required)",
  "imageUrl": "string (optional, valid URL)"
}
```

**Response:**
```json
{
  "success": true,
  "message": "User registered successfully"
}
```

**Error Responses:**
- `400` - Validation error (missing fields, invalid password, username exists)
- `500` - Server error

---

#### `POST /api/auth/login`
Authenticate user and receive JWT token.

**Request Body:**
```json
{
  "username": "string (required)",
  "password": "string (required)"
}
```

**Response:**
```json
{
  "token": "jwt-token-string",
  "user": {
    "id": "string",
    "username": "string",
    "firstName": "string",
    "imageUrl": "string"
  }
}
```

**Error Responses:**
- `400` - Invalid credentials
- `500` - Server error

---

#### `POST /api/auth/logout`
Logout current user (client-side token removal).

**Headers:**
```
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

---

#### `GET /api/auth/me`
Get current authenticated user information.

**Headers:**
```
Authorization: Bearer <token>
```

**Response:**
```json
{
  "user": {
    "id": "string",
    "username": "string",
    "firstName": "string",
    "imageUrl": "string"
  }
}
```

---

### YouTube Search Endpoint

#### `GET /api/search?q=<query>`
Search for music videos on YouTube.

**Headers:**
```
Authorization: Bearer <token>
```

**Query Parameters:**
- `q` (required) - Search query string

**Response:**
```json
{
  "items": [
    {
      "videoId": "string",
      "title": "string",
      "channelTitle": "string",
      "thumbnail": "string (URL)",
      "description": "string",
      "publishedAt": "string (ISO date)",
      "duration": "string (e.g., '4:13')",
      "viewCount": "string (e.g., '1.2M')",
      "viewCountRaw": number
    }
  ]
}
```

**Error Responses:**
- `400` - Missing query parameter
- `401` - Unauthorized (no token)
- `503` - YouTube API key not configured
- `500` - YouTube API error

---

### Playlist Endpoints

#### `GET /api/playlists`
Get all playlists for the authenticated user.

**Headers:**
```
Authorization: Bearer <token>
```

**Response:**
```json
{
  "playlists": [
    {
      "id": "string",
      "userId": "string",
      "name": "string",
      "songs": [
        {
          "videoId": "string",
          "title": "string",
          "channelTitle": "string",
          "thumbnail": "string",
          "duration": "string",
          "viewCount": "string",
          "rating": number (0-5),
          "addedAt": number (timestamp)
        }
      ]
    }
  ]
}
```

---

#### `POST /api/playlists`
Save/update all playlists for the authenticated user.

**Headers:**
```
Authorization: Bearer <token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "playlists": [
    {
      "id": "string",
      "userId": "string",
      "name": "string",
      "songs": []
    }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "message": "Playlists saved successfully"
}
```

---

#### `DELETE /api/playlists/:id`
Delete a specific playlist.

**Headers:**
```
Authorization: Bearer <token>
```

**URL Parameters:**
- `id` - Playlist ID

**Response:**
```json
{
  "success": true,
  "message": "Playlist deleted successfully"
}
```

---

#### `POST /api/playlists/:id/items`
Add a song/item to a playlist.

**Headers:**
```
Authorization: Bearer <token>
Content-Type: application/json
```

**URL Parameters:**
- `id` - Playlist ID

**Request Body:**
```json
{
  "videoId": "string (required)",
  "title": "string",
  "channelTitle": "string",
  "thumbnail": "string",
  "duration": "string",
  "viewCount": "string",
  "rating": number
}
```

**Response:**
```json
{
  "success": true,
  "message": "Item added to playlist"
}
```

**Error Responses:**
- `400` - Item already exists in playlist
- `404` - Playlist not found

---

#### `DELETE /api/playlists/:id/items/:videoId`
Remove a song from a playlist.

**Headers:**
```
Authorization: Bearer <token>
```

**URL Parameters:**
- `id` - Playlist ID
- `videoId` - Video ID to remove

**Response:**
```json
{
  "success": true,
  "message": "Item removed from playlist"
}
```

---

### File Upload Endpoint

#### `POST /api/upload/mp3`
Upload an MP3 file to the server.

**Headers:**
```
Authorization: Bearer <token>
Content-Type: multipart/form-data
```

**Form Data:**
- `mp3file` (required) - MP3 file (max 10MB)
- `title` (optional) - Song title
- `artist` (optional) - Artist name
- `playlistId` (optional) - Playlist ID to add to
- `duration` (optional) - Song duration

**Response:**
```json
{
  "success": true,
  "message": "File uploaded and added to playlist",
  "song": {
    "id": "string",
    "type": "mp3",
    "title": "string",
    "channelTitle": "string",
    "fileUrl": "string",
    "duration": "string"
  }
}
```

---

### User Experience
- **Welcome Message** - Personalized greeting on search page
- **Toast Notifications** - Real-time feedback for all actions
- **Loading States** - Visual feedback during API calls
- **Error Handling** - Clear, user-friendly error messages
- **Form Validation** - Real-time validation with helpful messages


## 🔒 Security Features

- **Password Hashing** - bcrypt with 10 salt rounds
- **JWT Tokens** - Secure token-based authentication
- **Input Validation** - Server-side validation for all inputs
- **SQL Injection Protection** - Using parameterized queries (JSON storage)
- **XSS Protection** - Input sanitization
- **CORS** - Configured for security
- **File Upload Limits** - Size and type restrictions

## 📊 Data Storage

### Server-Side (JSON Files)
- **Users**: `server/data/users.json`
- **Playlists**: `server/data/playlists/{username}.json`
- **Uploads**: `server/uploads/`

### Client-Side (Browser Storage)
- **JWT Token**: `localStorage.authToken`
- **User Data**: `sessionStorage.currentUser`




## 👤 Author

**Student Information**
- Name: Amir bader
- ID: 211614771
- Course: Web Development

## 🙏 Acknowledgments

- **Bootstrap** - UI framework
- **YouTube Data API** - Music search functionality
- **Express.js** - Web framework
- **Bootstrap Icons** - Icon library

