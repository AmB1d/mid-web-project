// Login form handling with API

document.addEventListener('DOMContentLoaded', function() {
    const form = document.getElementById('loginForm');
    const formAlert = document.getElementById('formAlert');
    
    // If already logged in, redirect to search and prevent back navigation
    if (isLoggedIn()) {
        window.location.replace('search.html');
        return;
    }
    
    // Prevent back navigation after login
    window.addEventListener('pageshow', function(event) {
        if (event.persisted || (window.performance && window.performance.navigation.type === 2)) {
            if (isLoggedIn()) {
                window.location.replace('search.html');
            }
        }
    });
    
    form.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        formAlert.style.display = 'none';
        
        const username = document.getElementById('username').value.trim();
        const password = document.getElementById('password').value;
        
        // Validate required fields
        if (!username || !password) {
            showAlert('danger', 'Please fill in all fields');
            return;
        }
        
        try {
            formAlert.style.display = 'block';
            formAlert.className = 'alert alert-info';
            formAlert.textContent = 'Logging in...';
            
            console.log('Attempting to login with username:', username);
            const response = await api.login(username, password);
            console.log('Login successful:', response);
            
            // Save token and user data
            setAuthToken(response.token);
            sessionStorage.setItem('currentUser', JSON.stringify(response.user));
            
            // Show success and redirect (use replace to prevent back navigation)
            showAlert('success', 'Login successful! Redirecting to search page...');
            setTimeout(() => {
                window.location.replace('search.html');
            }, 1000);
        } catch (error) {
            console.error('Login error:', error);
            const errorMessage = error.message || 'Invalid username or password';
            
            if (errorMessage.includes('Invalid username or password')) {
                showAlert('danger', 'Invalid username or password');
            } else if (errorMessage.includes('Invalid response')) {
                showAlert('danger', 'Server communication error. Please make sure the server is running and try again.');
            } else if (errorMessage.includes('Username and password are required')) {
                showAlert('danger', 'Please fill in all fields');
            } else {
                showAlert('danger', errorMessage);
            }
        }
    });
    
    function showAlert(type, message) {
        formAlert.className = `alert alert-${type}`;
        formAlert.textContent = message;
        formAlert.style.display = 'block';
    }
});
