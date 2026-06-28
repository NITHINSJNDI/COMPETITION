# How to Deploy to GitHub in One Go

## Step 1 — Open terminal in this project folder

## Step 2 — Run these commands one by one:

```bash
git init
git add .
git commit -m "initial commit - full project"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git
git push -u origin main
```

Replace YOUR_USERNAME and YOUR_REPO_NAME with your actual GitHub username and repo name.

## Step 3 — Go to GitHub and verify all files are uploaded

## Environment Variables needed for deployment:
- MONGODB_URI = your MongoDB Atlas connection string
- PORT = 5000
- NODE_ENV = production

## Render Deploy Settings:
- Build Command: npm install && npx tsc && npm run build
- Start Command: node dist/server.cjs
- Publish Directory: dist
