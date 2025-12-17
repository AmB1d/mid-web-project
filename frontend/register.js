// Registration form handling with API

document.addEventListener('DOMContentLoaded', function() {
    const form = document.getElementById('registerForm');
    const formAlert = document.getElementById('formAlert');
    
    // If already logged in, redirect to search
    if (isLoggedIn()) {
        window.location.replace('search.html');
        return;
    }
    
    form.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        // Clear previous errors
        clearErrors();
        formAlert.style.display = 'none';
        
        // Get form values
        const username = document.getElementById('username').value.trim();
        const password = document.getElementById('password').value;
        const confirmPassword = document.getElementById('confirmPassword').value;
        const firstName = document.getElementById('firstName').value.trim();
        const imageUrl = document.getElementById('imageUrl').value.trim();
        
        let isValid = true;
        
        // Validate required fields
        if (!username) {
            showError('username', 'Required field');
            isValid = false;
        }
        
        if (!password) {
            showError('password', 'Required field');
            isValid = false;
        }
        
        if (!confirmPassword) {
            showError('confirmPassword', 'Required field');
            isValid = false;
        }
        
        if (!firstName) {
            showError('firstName', 'Required field');
            isValid = false;
        }
        
        if (!isValid) return;
        
        // Validate password
        const passwordValidation = validatePassword(password);
        if (!passwordValidation.isValid) {
            showError('password', passwordValidation.message);
            showAlert('danger', passwordValidation.message);
            return;
        }
        
        // Validate password confirmation
        if (password !== confirmPassword) {
            showError('confirmPassword', 'Passwords do not match');
            showAlert('danger', 'Passwords do not match');
            return;
        }
        
        // All validations passed - register via API
        try {
            formAlert.style.display = 'block';
            formAlert.className = 'alert alert-info';
            formAlert.textContent = 'Registering...';
            
            await api.register({
                username,
                password,
                firstName,
                imageUrl: imageUrl || undefined
            });
            
            // Show success message and redirect
            showAlert('success', 'Registration successful! Redirecting to login page...');
            setTimeout(() => {
                window.location.href = 'login.html';
            }, 1500);
        } catch (error) {
            console.error('Registration error:', error);
            const errorMessage = error.message || 'Registration error';
            
            // Clear previous errors
            clearErrors();
            
            // Handle specific error types
            if (errorMessage.includes('already exists') || errorMessage.includes('Username already exists')) {
                showError('username', 'Username already exists');
                showAlert('danger', `Registration failed: Username already exists in the system`);
            } else if (errorMessage.includes('All fields are required')) {
                showAlert('danger', 'Registration failed: Please fill in all fields');
            } else if (errorMessage.includes('Password must')) {
                showError('password', errorMessage);
                showAlert('danger', `Registration failed: ${errorMessage}`);
            } else if (errorMessage.includes('Cannot connect to server')) {
                showAlert('danger', `Registration failed: ${errorMessage}`);
            } else if (errorMessage.includes('Server error')) {
                showAlert('danger', `Registration failed: ${errorMessage}`);
            } else if (errorMessage.includes('Bad request')) {
                showAlert('danger', `Registration failed: ${errorMessage}`);
            } else {
                // Show the exact error message from the server
                showAlert('danger', `Registration failed: ${errorMessage}`);
            }
        }
    });
    
    function validatePassword(password) {
        // Minimum 6 characters
        if (password.length < 6) {
            return { isValid: false, message: 'Password must contain at least 6 characters' };
        }
        
        // At least one letter
        if (!/[a-zA-Zא-ת]/.test(password)) {
            return { isValid: false, message: 'Password must contain at least one letter' };
        }
        
        // At least one number
        if (!/[0-9]/.test(password)) {
            return { isValid: false, message: 'Password must contain at least one number' };
        }
        
        // At least one non-alphanumeric character
        if (!/[^a-zA-Z0-9א-ת]/.test(password)) {
            return { isValid: false, message: 'Password must contain at least one non-alphanumeric character' };
        }
        
        return { isValid: true };
    }
    
    function showError(fieldId, message) {
        const field = document.getElementById(fieldId);
        field.classList.add('is-invalid');
        const feedback = field.nextElementSibling;
        if (feedback && feedback.classList.contains('invalid-feedback')) {
            feedback.textContent = message;
        }
    }
    
    function clearErrors() {
        const fields = form.querySelectorAll('.is-invalid');
        fields.forEach(field => field.classList.remove('is-invalid'));
    }
    
    function showAlert(type, message) {
        formAlert.className = `alert alert-${type}`;
        formAlert.textContent = message;
        formAlert.style.display = 'block';
    }
});
