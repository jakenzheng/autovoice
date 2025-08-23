# 🚀 AutoVoice Deployment Guide

## 🔒 Security First - API Key Protection

**NEVER commit your actual API keys to the repository!** This guide shows you how to deploy safely.

## 📋 Prerequisites

- Node.js 16+ installed
- OpenAI API key (or Gemini API key)
- Git repository access

## 🎯 Deployment Options

### Option 1: Vercel (Recommended - Easiest)

1. **Install Vercel CLI:**
   ```bash
   npm install -g vercel
   ```

2. **Deploy:**
   ```bash
   vercel
   ```

3. **Set Environment Variables:**
   ```bash
   vercel env add OPENAI_API_KEY
   # Enter your actual API key when prompted
   ```

4. **Redeploy:**
   ```bash
   vercel --prod
   ```

### Option 2: Railway (Server-Side)

1. **Connect Repository:**
   - Go to [railway.app](https://railway.app)
   - Connect your GitHub repository

2. **Set Environment Variables:**
   - In Railway dashboard, go to your project
   - Add environment variable: `OPENAI_API_KEY`
   - Set value to your actual API key

3. **Deploy:**
   - Railway automatically deploys on push

### Option 3: Render (Server-Side)

1. **Create Web Service:**
   - Go to [render.com](https://render.com)
   - Connect your GitHub repository
   - Choose "Web Service"

2. **Configure:**
   - Build Command: `npm install`
   - Start Command: `npm start`
   - Environment: Node

3. **Set Environment Variables:**
   - Add `OPENAI_API_KEY` with your actual key

### Option 4: Heroku (Traditional)

1. **Install Heroku CLI:**
   ```bash
   npm install -g heroku
   ```

2. **Create App:**
   ```bash
   heroku create your-autovoice-app
   ```

3. **Set Environment Variables:**
   ```bash
   heroku config:set OPENAI_API_KEY=your_actual_key_here
   ```

4. **Deploy:**
   ```bash
   git push heroku main
   ```

## 🔧 Environment Variables

Your application uses these environment variables:

```bash
# Required
OPENAI_API_KEY=your_actual_openai_key_here

# Optional (for Gemini)
GEMINI_API_KEY=your_actual_gemini_key_here

# Server Configuration
PORT=3000
NODE_ENV=production
```

## 🛡️ Security Best Practices

### ✅ Do This:
- Use environment variables for API keys
- Set up usage limits on your OpenAI account
- Monitor API usage regularly
- Use different API keys for development/production
- Enable API key rotation

### ❌ Never Do This:
- Commit `.env` files to git
- Hardcode API keys in source code
- Share API keys in public repositories
- Use the same key for multiple projects

## 📊 Monitoring & Limits

### OpenAI Usage Limits:
1. Go to [OpenAI Platform](https://platform.openai.com/usage)
2. Set spending limits
3. Monitor usage daily
4. Set up alerts for high usage

### API Key Rotation:
1. Generate new API key
2. Update environment variable
3. Delete old key after deployment
4. Repeat monthly

## 🚨 Emergency Procedures

If your API key is compromised:

1. **Immediate Actions:**
   - Revoke the compromised key immediately
   - Generate a new API key
   - Update all deployment environments
   - Check for unauthorized usage

2. **Prevention:**
   - Review git history for any accidental commits
   - Check deployment logs
   - Audit environment variables

## 🔍 Testing Deployment

After deployment, test with:

1. **Upload Test Images:**
   - Use the sample images in `input/` directory
   - Verify processing works correctly

2. **Check Environment:**
   ```bash
   # For Vercel
   vercel env ls
   
   # For Railway
   railway variables
   
   # For Render
   # Check in dashboard
   ```

3. **Monitor Logs:**
   - Check for any errors
   - Verify API calls are working
   - Monitor response times

## 📱 Mobile Testing

Test the mobile features:
- Single image upload
- Multiple image upload
- Image viewing modal
- Responsive design

## 🎉 Success Checklist

- [ ] Environment variables set correctly
- [ ] Application deploys without errors
- [ ] File uploads work
- [ ] AI processing functions correctly
- [ ] Mobile interface works
- [ ] Image viewing works
- [ ] No API keys in source code
- [ ] Usage monitoring enabled

## 🆘 Troubleshooting

### Common Issues:

**"API key not found"**
- Check environment variable name
- Verify the variable is set in deployment platform
- Restart the application

**"Upload failed"**
- Check file size limits
- Verify upload directory permissions
- Check storage configuration

**"Processing timeout"**
- Increase timeout limits
- Check API rate limits
- Monitor server resources

## 📞 Support

If you encounter issues:
1. Check deployment platform logs
2. Verify environment variables
3. Test locally first
4. Check OpenAI API status

---

**Remember: Keep your API keys secure and never commit them to version control!** 🔐
