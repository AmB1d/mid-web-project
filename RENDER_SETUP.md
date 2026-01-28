# הוראות הגדרת Render

## שלב 1: הגדרת Environment Variables ב-Render

**חשוב מאוד:** יש להגדיר את המשתנים הבאים ב-Render Dashboard:

1. היכנס ל-Render Dashboard: https://dashboard.render.com
2. פתח את ה-Service שלך (`mid-web-project`)
3. לך ל-**Settings** → **Environment**
4. הוסף את המשתנים הבאים:

### SESSION_SECRET (חובה!)
```
SESSION_SECRET=your-very-long-random-secret-key-here
```

**איך ליצור מפתח סודי:**
- Windows PowerShell: `[Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Minimum 0 -Maximum 256 }))`
- או השתמש באתר: https://randomkeygen.com/
- או: `openssl rand -hex 32` (אם יש לך OpenSSL)

**דוגמה:**
```
SESSION_SECRET=a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6
```

### YOUTUBE_API_KEY (חובה!)
```
YOUTUBE_API_KEY=your-youtube-api-key-here
```

**איך להשיג YouTube API Key:**
1. לך ל-Google Cloud Console: https://console.cloud.google.com/
2. צור פרויקט חדש או בחר פרויקט קיים
3. הפעל את YouTube Data API v3
4. צור API Key
5. העתק את המפתח והדבק כאן

### NODE_ENV (אופציונלי - כבר מוגדר)
```
NODE_ENV=production
```

## שלב 2: בדיקת ההגדרות

לאחר שהגדרת את המשתנים:

1. **שמור את השינויים** ב-Render Dashboard
2. Render יתחיל **automatic redeploy** אוטומטית
3. או לחץ על **Manual Deploy** → **Deploy latest commit**

## שלב 3: בדיקת השרת

לאחר שה-Deploy מסתיים:

1. פתח את ה-URL של ה-Service שלך
2. נסה להירשם עם משתמש חדש
3. נסה להתחבר

אם יש בעיות:
- בדוק את ה-Logs ב-Render Dashboard
- ודא ש-SESSION_SECRET מוגדר
- ודא ש-YOUTUBE_API_KEY מוגדר

## בעיות נפוצות

### לא מצליח להתחבר/להירשם
- **פתרון:** ודא ש-SESSION_SECRET מוגדר ב-Render Dashboard
- בדוק את ה-Logs לראות אם יש שגיאות

### שגיאת YouTube API
- **פתרון:** ודא ש-YOUTUBE_API_KEY מוגדר ונכון
- ודא שה-API מופעל ב-Google Cloud Console

### שגיאת Database
- השרת יוצר את ה-DB אוטומטית - זה אמור לעבוד
- אם יש שגיאה, בדוק את ה-Logs

## הערות חשובות

1. **SESSION_SECRET** חייב להיות מפתח סודי חזק וארוך (לפחות 32 תווים)
2. **אל תשתף** את ה-SESSION_SECRET או ה-YOUTUBE_API_KEY בפומבי
3. ה-Database נוצר אוטומטית ב-Render - אין צורך להגדיר אותו
4. ה-Sessions נשמרים ב-SQLite - זה עובד אוטומטית
