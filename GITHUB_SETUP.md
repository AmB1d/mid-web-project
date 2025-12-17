# הוראות העלאה ל-GitHub

## שלבים להעלאת הפרויקט ל-GitHub

### 1. צור Repository חדש ב-GitHub
1. היכנס ל-GitHub
2. לחץ על "New repository"
3. תן שם ל-repository (לדוגמה: `mid-web-project`)
4. אל תסמן "Initialize with README"
5. לחץ "Create repository"

### 2. אתחל Git בפרויקט

פתח טרמינל בתיקיית הפרויקט והרץ:

```bash
# אתחל git
git init

# הוסף את כל הקבצים
git add .

# צור commit ראשון
git commit -m "Initial commit: MID Web Project with server and client"

# הוסף את ה-remote repository (החלף את YOUR_USERNAME ו-YOUR_REPO_NAME)
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git

# שנה את השם של ה-branch ל-main
git branch -M main

# העלה ל-GitHub
git push -u origin main
```

### 3. עדכן את הלינקים ב-index.html

לאחר ההעלאה, עדכן את הלינקים ב-`frontend/index.html`:
- לינק ל-GitHub: החלף `https://github.com` בלינק ל-repository שלך
- לינק לדף בלייב: אם יש לך דף בלייב, עדכן את הלינק

### 4. עדכן את פרטי הסטודנט

עדכן ב-`frontend/index.html`:
- שם הסטודנט
- ת"ז

## הערות חשובות

- **אל תעלה** את `node_modules/` - זה כבר ב-`.gitignore`
- **אל תעלה** את `server/data/users.json` - זה כבר ב-`.gitignore`
- **אל תעלה** את `server/data/playlists/*.json` - זה כבר ב-`.gitignore`
- **אל תעלה** את `.env` - זה כבר ב-`.gitignore`

כל הקבצים האלה לא יועלו בגלל ה-`.gitignore`.

